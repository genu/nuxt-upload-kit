import { defineStorageAdapter } from "../../types"

export interface S3Options {
  /**
   * Optional path prefix (folder) for uploaded files
   * @example "uploads/images"
   */
  path?: string

  /**
   * Function to get a presigned URL for uploading a file
   * Your backend should generate this using AWS SDK's getSignedUrl
   * The storageKey parameter is the full path (path + filename)
   *
   * @example
   * ```typescript
   * getPresignedUploadUrl: async (storageKey, contentType) => {
   *   const response = await fetch('/api/s3/presign', {
   *     method: 'POST',
   *     body: JSON.stringify({ key: storageKey, contentType })
   *   })
   *   const { uploadUrl, publicUrl } = await response.json()
   *   return { uploadUrl, publicUrl }
   * }
   * ```
   */
  getPresignedUploadUrl: (
    storageKey: string,
    contentType: string,
    metadata: { fileName: string; fileSize: number },
  ) => Promise<{
    /** Presigned URL for PUT upload */
    uploadUrl: string
    /** Public URL where the file will be accessible after upload */
    publicUrl: string
  }>

  /**
   * Optional function to get a presigned URL for downloading/reading a file
   * Required if you want to use getRemoteFile hook
   * The storageKey parameter is the full path (path + filename)
   */
  getPresignedDownloadUrl?: (storageKey: string) => Promise<string>

  /**
   * Optional function to delete a file
   * Your backend should handle the actual deletion
   * The storageKey parameter is the full path (path + filename)
   */
  deleteFile?: (storageKey: string) => Promise<void>

  /**
   * Number of retry attempts for failed operations
   * @default 3
   */
  retries?: number

  /**
   * Initial delay between retries in milliseconds
   * Uses exponential backoff: delay * (2 ^ attempt)
   * @default 1000 (1 second)
   */
  retryDelay?: number
}

export interface S3UploadResult {
  /**
   * Public URL to the uploaded file
   */
  url: string

  /**
   * Identifier to pass to getRemoteFile for retrieval
   */
  storageKey: string

  /**
   * ETag of the uploaded object (from response headers)
   */
  etag?: string
}

/**
 * S3-compatible storage adapter
 *
 * Works with AWS S3 and any S3-compatible service:
 * - Cloudflare R2
 * - DigitalOcean Spaces
 * - MinIO
 * - Backblaze B2
 * - Wasabi
 * - Supabase Storage
 */
export const PluginS3 = defineStorageAdapter<S3Options, S3UploadResult>((options) => {
  // Retry configuration
  const maxRetries = options.retries ?? 3
  const initialRetryDelay = options.retryDelay ?? 1000

  /**
   * Build the full storage key for a file.
   * Combines: options.path + filename
   */
  const buildFullStorageKey = (filename: string): string => {
    if (options.path) {
      const cleanPath = options.path.replace(/^\/+/, "").replace(/\/+$/, "")
      return `${cleanPath}/${filename}`
    }
    return filename
  }

  /**
   * Retry an async operation with exponential backoff
   */
  async function withRetry<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error

        if (attempt === maxRetries) {
          break
        }

        const delay = initialRetryDelay * Math.pow(2, attempt)

        if (import.meta.dev) {
          console.warn(
            `[S3 Storage] ${operationName} failed (attempt ${attempt + 1}/${maxRetries + 1}). ` + `Retrying in ${delay}ms...`,
            error,
          )
        }

        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    throw new Error(`[S3 Storage] ${operationName} failed after ${maxRetries + 1} attempts: ${lastError?.message}`)
  }

  return {
    id: "s3-storage",
    hooks: {
      /**
       * Upload file to S3 using presigned URL
       */
      async upload(file, context) {
        if (file.source !== "local" || file.data === null) {
          throw new Error("Cannot upload remote file - no local data available")
        }

        return withRetry(async () => {
          // Build full storage key upfront
          const storageKey = buildFullStorageKey(file.id)

          // Get presigned URL from backend
          const { uploadUrl, publicUrl } = await options.getPresignedUploadUrl(storageKey, file.mimeType, {
            fileName: file.name,
            fileSize: file.size,
          })

          // Upload using fetch with progress tracking via XMLHttpRequest
          const etag = await uploadWithProgress(uploadUrl, file.data, file.mimeType, context.onProgress)

          return {
            url: publicUrl,
            storageKey,
            etag,
          } satisfies S3UploadResult
        }, `Upload file "${file.name}"`)
      },

      /**
       * Get remote file metadata.
       * Expects the full storageKey (e.g., "uploads/images/filename.jpg").
       */
      async getRemoteFile(storageKey, _context) {
        if (!options.getPresignedDownloadUrl) {
          throw new Error("[S3 Storage] getPresignedDownloadUrl is required to fetch remote files")
        }

        return withRetry(async () => {
          const downloadUrl = await options.getPresignedDownloadUrl!(storageKey)

          // HEAD request to get file metadata
          const response = await fetch(downloadUrl, { method: "HEAD" })

          if (!response.ok) {
            throw new Error(`Failed to get file metadata: ${response.status}`)
          }

          return {
            size: Number.parseInt(response.headers.get("content-length") || "0", 10),
            mimeType: response.headers.get("content-type") || "application/octet-stream",
            remoteUrl: downloadUrl,
            uploadResult: {
              url: downloadUrl,
              storageKey,
            } satisfies S3UploadResult,
          }
        }, `Get remote file "${storageKey}"`)
      },

      /**
       * Delete file from S3.
       * Uses file.storageKey (the full path in storage).
       */
      async remove(file, _context) {
        if (!options.deleteFile) {
          throw new Error("[S3 Storage] deleteFile callback is required to delete files")
        }

        // Use storageKey for deletion - this is set after upload or from initialFiles
        const storageKey = file.storageKey
        if (!storageKey) {
          // File was never uploaded to storage - nothing to delete
          if (import.meta.dev) {
            console.debug(`[S3 Storage] Skipping delete for file "${file.name}" - no storageKey`)
          }
          return
        }

        return withRetry(async () => {
          await options.deleteFile!(storageKey)
        }, `Delete file "${file.name}"`)
      },
    },
  }
})

/**
 * Upload a file using XMLHttpRequest for progress tracking
 */
function uploadWithProgress(
  url: string,
  data: File | Blob,
  contentType: string,
  onProgress: (percentage: number) => void,
): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const percentage = Math.round((event.loaded / event.total) * 100)
        onProgress(percentage)
      }
    })

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader("ETag")?.replaceAll('"', "")
        resolve(etag)
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.statusText}`))
      }
    })

    xhr.addEventListener("error", () => {
      reject(new Error("Upload failed due to network error"))
    })

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload was aborted"))
    })

    xhr.open("PUT", url)
    xhr.setRequestHeader("Content-Type", contentType)
    xhr.send(data)
  })
}
