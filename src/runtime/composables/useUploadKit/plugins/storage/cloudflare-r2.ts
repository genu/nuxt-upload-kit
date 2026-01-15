import { defineStorageAdapter } from "../../types"

export interface CloudflareR2Options {
  /**
   * Function to get a presigned URL for uploading a file
   * Your backend should generate this using AWS SDK's getSignedUrl with R2 endpoint
   *
   * @example
   * ```typescript
   * getPresignedUploadUrl: async (fileId, contentType) => {
   *   const response = await fetch('/api/r2/presign', {
   *     method: 'POST',
   *     body: JSON.stringify({ key: fileId, contentType })
   *   })
   *   const { uploadUrl, publicUrl } = await response.json()
   *   return { uploadUrl, publicUrl }
   * }
   * ```
   */
  getPresignedUploadUrl: (
    fileId: string,
    contentType: string,
    metadata: { fileName: string; fileSize: number },
  ) => Promise<{
    /** Presigned URL for PUT upload */
    uploadUrl: string
    /** Public URL where the file will be accessible after upload (r2.dev or custom domain) */
    publicUrl: string
  }>

  /**
   * Optional function to get a presigned URL for downloading/reading a file
   * Required if you want to use getRemoteFile hook
   */
  getPresignedDownloadUrl?: (fileId: string) => Promise<string>

  /**
   * Optional function to delete a file
   * Your backend should handle the actual deletion
   */
  deleteFile?: (fileId: string) => Promise<void>

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

export interface CloudflareR2UploadResult {
  /**
   * Public URL to the uploaded file
   */
  url: string

  /**
   * R2 object key (file ID used for upload)
   */
  key: string

  /**
   * ETag of the uploaded object (from response headers)
   */
  etag?: string
}

export const PluginCloudflareR2 = defineStorageAdapter<CloudflareR2Options, CloudflareR2UploadResult>((options) => {
  // Retry configuration
  const maxRetries = options.retries ?? 3
  const initialRetryDelay = options.retryDelay ?? 1000

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
            `[R2 Storage] ${operationName} failed (attempt ${attempt + 1}/${maxRetries + 1}). ` + `Retrying in ${delay}ms...`,
            error,
          )
        }

        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    throw new Error(`[R2 Storage] ${operationName} failed after ${maxRetries + 1} attempts: ${lastError?.message}`)
  }

  return {
    id: "cloudflare-r2-storage",
    hooks: {
      /**
       * Upload file to R2 using presigned URL
       */
      async upload(file, context) {
        if (file.source !== "local" || file.data === null) {
          throw new Error("Cannot upload remote file - no local data available")
        }

        return withRetry(async () => {
          // Get presigned URL from backend
          const { uploadUrl, publicUrl } = await options.getPresignedUploadUrl(file.id, file.mimeType, {
            fileName: file.name,
            fileSize: file.size,
          })

          // Upload using XMLHttpRequest for progress tracking
          const etag = await uploadWithProgress(uploadUrl, file.data, file.mimeType, context.onProgress)

          return {
            url: publicUrl,
            key: file.id,
            etag,
          } satisfies CloudflareR2UploadResult
        }, `Upload file "${file.name}"`)
      },

      /**
       * Get remote file metadata from R2
       */
      async getRemoteFile(fileId, _context) {
        if (!options.getPresignedDownloadUrl) {
          throw new Error("[R2 Storage] getPresignedDownloadUrl is required to fetch remote files")
        }

        return withRetry(async () => {
          const downloadUrl = await options.getPresignedDownloadUrl!(fileId)

          // HEAD request to get file metadata
          const response = await fetch(downloadUrl, { method: "HEAD" })

          if (!response.ok) {
            throw new Error(`Failed to get file metadata: ${response.status}`)
          }

          return {
            size: Number.parseInt(response.headers.get("content-length") || "0", 10),
            mimeType: response.headers.get("content-type") || "application/octet-stream",
            remoteUrl: downloadUrl,
          }
        }, `Get remote file "${fileId}"`)
      },

      /**
       * Delete file from R2
       */
      async remove(file, _context) {
        if (!options.deleteFile) {
          throw new Error("[R2 Storage] deleteFile callback is required to delete files")
        }

        return withRetry(async () => {
          await options.deleteFile!(file.id)
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
