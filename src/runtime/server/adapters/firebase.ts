import { cert, getApps, initializeApp, type App } from "firebase-admin/app"
import { getStorage } from "firebase-admin/storage"
import type { PresignedFileInput, ServerHookContext, StorageAdapter } from "../types"

export interface FirebaseStorageOptions {
  /** GCS bucket name backing Firebase Storage (e.g. `my-project.appspot.com`). */
  bucket: string
  /**
   * Service account credentials. If omitted, the SDK falls back to Application Default
   * Credentials (e.g. `GOOGLE_APPLICATION_CREDENTIALS` env or Cloud Run metadata server).
   */
  credentials?: {
    projectId: string
    clientEmail: string
    privateKey: string
  }
  /** Seconds until signed URLs expire. Defaults to 900 (15 min). */
  expiresIn?: number
  /** Resolve the storage key. Defaults to `uploads/${fileId}`. */
  keyStrategy?: (input: PresignedFileInput) => string
  /**
   * Build the public URL for an uploaded object. Defaults to the canonical GCS URL
   * (accessible only if the object is publicly readable). Override for CDN domains.
   */
  publicUrl?: (key: string) => string
}

export const FirebaseStorage = (options: FirebaseStorageOptions): StorageAdapter => {
  // Namespaced app instance avoids clashing with the user's default `initializeApp()`.
  const appName = `nuxt-upload-kit:${options.bucket}`
  const existing = getApps().find((a): a is App => a?.name === appName)
  const app =
    existing ??
    initializeApp(
      {
        credential: options.credentials ? cert(options.credentials) : undefined,
        storageBucket: options.bucket,
      },
      appName,
    )

  const bucket = getStorage(app).bucket(options.bucket)
  const expiresIn = options.expiresIn ?? 900
  const keyStrategy = options.keyStrategy ?? ((input) => `uploads/${input.fileId}`)
  const encodePath = (key: string): string => key.split("/").map(encodeURIComponent).join("/")
  const defaultPublicUrl = (key: string): string => `https://storage.googleapis.com/${options.bucket}/${encodePath(key)}`
  const publicUrl = options.publicUrl ?? defaultPublicUrl

  return {
    id: "firebase-storage",
    resolveKey: keyStrategy,
    presignUpload: async (input: PresignedFileInput, _ctx: ServerHookContext) => {
      const key = keyStrategy(input)
      const [uploadUrl] = await bucket.file(key).getSignedUrl({
        action: "write",
        version: "v4",
        expires: Date.now() + expiresIn * 1000,
        contentType: input.mimeType,
      })
      return {
        uploadUrl,
        publicUrl: publicUrl(key),
        fileId: key,
      }
    },
    presignDownload: async (key: string) => {
      const [downloadUrl] = await bucket.file(key).getSignedUrl({
        action: "read",
        version: "v4",
        expires: Date.now() + expiresIn * 1000,
      })
      return { downloadUrl }
    },
    delete: async (key: string) => {
      await bucket.file(key).delete({ ignoreNotFound: true })
    },
    put: async (input: { key: string; body: unknown; contentType?: string }) => {
      await bucket.file(input.key).save(input.body as Buffer | Uint8Array | string, {
        contentType: input.contentType,
      })
      return { publicUrl: publicUrl(input.key) }
    },
  }
}
