/**
 * S3-Compatible Storage Adapter
 *
 * This adapter uses presigned URLs for uploads, so no AWS SDK is required in the browser.
 * Your backend generates the presigned URLs using the AWS SDK.
 *
 * Works with AWS S3 and any S3-compatible service:
 * - Cloudflare R2
 * - DigitalOcean Spaces
 * - MinIO
 * - Backblaze B2
 * - Wasabi
 * - Supabase Storage
 *
 * @example
 * ```typescript
 * import { PluginS3 } from "nuxt-upload-kit/providers/s3"
 *
 * const uploader = useUploadKit({
 *   storage: PluginS3({
 *     getPresignedUploadUrl: async (fileId, contentType, metadata) => {
 *       const response = await fetch("/api/s3/presign", {
 *         method: "POST",
 *         body: JSON.stringify({ key: fileId, contentType, ...metadata }),
 *       })
 *       return response.json() // { uploadUrl, publicUrl }
 *     },
 *   })
 * })
 * ```
 *
 * @experimental This adapter is experimental and may change in future releases.
 */
export {
  PluginS3,
  type S3Options,
  type S3UploadResult,
} from "../runtime/composables/useUploadKit/plugins/storage/s3"
