import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  getMetadata,
  deleteObject,
  type FirebaseStorage,
  type UploadMetadata,
} from "firebase/storage"
import { defineStorageAdapter, type StandaloneUploadOptions } from "../../types"

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

    async upload(data: Blob | File, storageKey: string, uploadOptions?: StandaloneUploadOptions) {
      const fullKey = buildFullStorageKey(storageKey)
      const contentType = uploadOptions?.contentType || "application/octet-stream"

      return uploadToFirebase(fullKey, data, contentType, storageKey, uploadOptions?.onProgress || (() => {}))
    },

    hooks: {
      /**
       * Upload file to Firebase Storage
       */
      async upload(file, context) {
        if (file.source !== "local" || file.data === null) {
          throw new Error("Cannot upload remote file - no local data available")
        }

        const storageKey = buildFullStorageKey(file.id)
        return uploadToFirebase(storageKey, file.data as Blob, file.mimeType, file.name, context.onProgress)
      },

      /**
       * Get remote file metadata from Firebase Storage.
       * Expects the full storageKey (e.g., "uploads/images/filename.jpg").
       */
      async getRemoteFile(storageKey, _context) {
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
      },

      /**
       * Delete file from Firebase Storage.
       * Uses file.storageKey (the full path in storage).
       */
      async remove(file, _context) {
        const storageKey = file.storageKey
        if (!storageKey) {
          if (import.meta.dev) console.debug(`[Firebase Storage] Skipping delete for file "${file.name}" - no storageKey`)

          return
        }

        const fileRef = getStorageRef(storageKey)
        await deleteObject(fileRef)
      },
    },
  }
})
