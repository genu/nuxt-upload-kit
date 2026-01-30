import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  getMetadata,
  deleteObject,
  type FirebaseStorage,
  type UploadMetadata,
} from "firebase/storage"
import { defineStorageAdapter } from "../../types"

export interface FirebaseStorageOptions {
  /**
   * Firebase Storage instance
   * You must initialize Firebase and pass the storage instance
   * @example
   * ```typescript
   * import { getStorage } from 'firebase/storage'
   * import { initializeApp } from 'firebase/app'
   *
   * const app = initializeApp({ ... })
   * const storage = getStorage(app)
   *
   * PluginFirebaseStorage({ storage })
   * ```
   */
  storage: FirebaseStorage

  /**
   * Optional path prefix (folder) for uploaded files
   * @example "uploads/images"
   */
  path?: string

  /**
   * Custom metadata to attach to uploaded files
   */
  customMetadata?: Record<string, string>

  /**
   * Cache-Control header for uploaded files
   * @example "max-age=31536000" for 1 year caching
   */
  cacheControl?: string

  /**
   * Content-Disposition header
   * @example "attachment; filename=file.pdf"
   */
  contentDisposition?: string

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

export interface FirebaseStorageUploadResult {
  /**
   * Public download URL for the uploaded file
   */
  url: string

  /**
   * Identifier to pass to getRemoteFile for retrieval
   */
  storageKey: string

  /**
   * Storage bucket name
   */
  bucket: string

  /**
   * File generation (version identifier)
   */
  generation?: string

  /**
   * MD5 hash of the uploaded content
   */
  md5Hash?: string
}

export const PluginFirebaseStorage = defineStorageAdapter<FirebaseStorageOptions, FirebaseStorageUploadResult>((options) => {
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
            `[Firebase Storage] ${operationName} failed (attempt ${attempt + 1}/${maxRetries + 1}). ` +
              `Retrying in ${delay}ms...`,
            error,
          )
        }

        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    throw new Error(`[Firebase Storage] ${operationName} failed after ${maxRetries + 1} attempts: ${lastError?.message}`)
  }

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
   * Get a storage reference for a file.
   * Expects the full storage path.
   */
  const getStorageRef = (fullPath: string) => {
    return storageRef(options.storage, fullPath)
  }

  /**
   * Upload a file to Firebase Storage with progress tracking.
   * Expects storageKey to be the full path.
   */
  const uploadToFirebase = (
    storageKey: string,
    data: Blob,
    mimeType: string,
    fileName: string,
    onProgress: (percentage: number) => void,
  ): Promise<FirebaseStorageUploadResult> => {
    const fileRef = getStorageRef(storageKey)

    const metadata: UploadMetadata = {
      contentType: mimeType,
      cacheControl: options.cacheControl,
      contentDisposition: options.contentDisposition,
      customMetadata: {
        ...options.customMetadata,
        originalName: fileName,
        size: String(data.size),
      },
    }

    return new Promise<FirebaseStorageUploadResult>((resolve, reject) => {
      const uploadTask = uploadBytesResumable(fileRef, data, metadata)

      const handleProgress = (snapshot: { bytesTransferred: number; totalBytes: number }) => {
        const percentage = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
        onProgress(percentage)
      }

      const handleError = (error: Error) => reject(error)

      const handleComplete = async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
          const uploadMetadata = uploadTask.snapshot.metadata

          resolve({
            url: downloadURL,
            storageKey,
            bucket: uploadMetadata.bucket,
            generation: uploadMetadata.generation,
            md5Hash: uploadMetadata.md5Hash,
          })
        } catch (error) {
          reject(error)
        }
      }

      uploadTask.on("state_changed", handleProgress, handleError, handleComplete)
    })
  }

  return {
    id: "firebase-storage",
    hooks: {
      /**
       * Upload file to Firebase Storage
       */
      async upload(file, context) {
        if (file.source !== "local" || file.data === null) {
          throw new Error("Cannot upload remote file - no local data available")
        }

        // Build full storage key upfront
        const storageKey = buildFullStorageKey(file.id)

        return withRetry(
          () => uploadToFirebase(storageKey, file.data as Blob, file.mimeType, file.name, context.onProgress),
          `Upload file "${file.name}"`,
        )
      },

      /**
       * Get remote file metadata from Firebase Storage.
       * Expects the full storageKey (e.g., "uploads/images/filename.jpg").
       */
      async getRemoteFile(storageKey, _context) {
        return withRetry(async () => {
          const fileRef = getStorageRef(storageKey)

          const [metadata, downloadURL] = await Promise.all([getMetadata(fileRef), getDownloadURL(fileRef)])

          return {
            size: metadata.size,
            mimeType: metadata.contentType || "application/octet-stream",
            remoteUrl: downloadURL,
            uploadResult: {
              url: downloadURL,
              storageKey,
              bucket: metadata.bucket,
              generation: metadata.generation,
              md5Hash: metadata.md5Hash,
            } satisfies FirebaseStorageUploadResult,
          }
        }, `Get remote file "${storageKey}"`)
      },

      /**
       * Delete file from Firebase Storage.
       * Uses file.storageKey (the full path in storage).
       */
      async remove(file, _context) {
        // Use storageKey for deletion - this is set after upload or from initialFiles
        const storageKey = file.storageKey
        if (!storageKey) {
          // File was never uploaded to storage - nothing to delete
          if (import.meta.dev) {
            console.debug(`[Firebase Storage] Skipping delete for file "${file.name}" - no storageKey`)
          }
          return
        }

        return withRetry(async () => {
          const fileRef = getStorageRef(storageKey)
          await deleteObject(fileRef)
        }, `Delete file "${file.name}"`)
      },
    },
  }
})
