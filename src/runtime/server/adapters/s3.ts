import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import type { StorageAdapter, PresignedFileInput, ServerHookContext } from "../types"

export interface S3StorageOptions {
  bucket: string
  region: string
  credentials?: {
    accessKeyId: string
    secretAccessKey: string
    sessionToken?: string
  }
  /** Custom endpoint for S3-compatible services (MinIO, R2, Wasabi, etc.). */
  endpoint?: string
  /** Required for path-style endpoints like MinIO. */
  forcePathStyle?: boolean
  /** Seconds until presigned URLs expire. Defaults to 900 (15 min). */
  expiresIn?: number
  /**
   * Resolve the storage key for an incoming file. Receives the descriptor + a generated id;
   * defaults to `uploads/${fileId}` (no extension — caller-provided id may already include one).
   */
  keyStrategy?: (input: PresignedFileInput) => string
  /**
   * Build the public URL for an uploaded object. Defaults to the virtual-hosted-style URL,
   * or path-style when `forcePathStyle` is set. Override for CDN domains.
   */
  publicUrl?: (key: string) => string
}

export const S3Storage = (options: S3StorageOptions): StorageAdapter => {
  const client = new S3Client({
    region: options.region,
    credentials: options.credentials,
    endpoint: options.endpoint,
    forcePathStyle: options.forcePathStyle,
  })

  const expiresIn = options.expiresIn ?? 900
  const keyStrategy = options.keyStrategy ?? ((input) => `uploads/${input.fileId}`)

  const defaultPublicUrl = (key: string): string => {
    if (options.endpoint) {
      // Virtual-hosted style against a custom endpoint requires DNS wildcard config the
      // user is unlikely to have. Force the caller to opt into path-style or supply their own
      // publicUrl resolver (e.g. CDN domain) rather than silently producing wrong URLs.
      if (!options.forcePathStyle) {
        throw new Error(
          "[nuxt-upload-kit] S3Storage: `endpoint` requires `forcePathStyle: true` (or a custom `publicUrl` resolver). " +
            "Virtual-hosted-style URLs against custom endpoints need DNS wildcard configuration.",
        )
      }
      const base = options.endpoint.replace(/\/+$/, "")
      return `${base}/${options.bucket}/${key}`
    }
    return `https://${options.bucket}.s3.${options.region}.amazonaws.com/${key}`
  }
  const publicUrl = options.publicUrl ?? defaultPublicUrl

  return {
    id: "s3-storage",
    presignUpload: async (input: PresignedFileInput, _ctx: ServerHookContext) => {
      const key = keyStrategy(input)
      const command = new PutObjectCommand({
        Bucket: options.bucket,
        Key: key,
        ContentType: input.mimeType,
        ContentLength: input.size,
      })
      const uploadUrl = await getSignedUrl(client, command, { expiresIn })
      return {
        uploadUrl,
        publicUrl: publicUrl(key),
        fileId: key,
      }
    },
    presignDownload: async (key: string) => {
      const command = new GetObjectCommand({ Bucket: options.bucket, Key: key })
      const downloadUrl = await getSignedUrl(client, command, { expiresIn })
      return { downloadUrl }
    },
    delete: async (key: string) => {
      await client.send(new DeleteObjectCommand({ Bucket: options.bucket, Key: key }))
    },
  }
}
