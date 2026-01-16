/**
 * Cloudflare R2 Storage Adapter
 *
 * This adapter uses presigned URLs for uploads, so no SDK is required in the browser.
 * Your backend generates the presigned URLs using the AWS SDK (R2 is S3-compatible).
 *
 * @example
 * ```typescript
 * import { PluginCloudflareR2 } from "nuxt-upload-kit/providers/cloudflare-r2"
 *
 * const uploader = useUploadKit({
 *   storage: PluginCloudflareR2({
 *     getPresignedUploadUrl: async (fileId, contentType, metadata) => {
 *       const response = await fetch("/api/r2/presign", {
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
  PluginCloudflareR2,
  type CloudflareR2Options,
  type CloudflareR2UploadResult,
} from "../runtime/composables/useUploadKit/plugins/storage/cloudflare-r2"
