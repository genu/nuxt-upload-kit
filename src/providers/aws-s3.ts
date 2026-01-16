/**
 * AWS S3 Storage Adapter
 *
 * This adapter uses presigned URLs for uploads, so no AWS SDK is required in the browser.
 * Your backend generates the presigned URLs using the AWS SDK.
 *
 * Also works with S3-compatible services: MinIO, DigitalOcean Spaces, Wasabi, Backblaze B2.
 *
 * @example
 * ```typescript
 * import { PluginAWSS3 } from "nuxt-upload-kit/providers/aws-s3"
 *
 * const uploader = useUploadKit({
 *   storage: PluginAWSS3({
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
  PluginAWSS3,
  type AWSS3Options,
  type AWSS3UploadResult,
} from "../runtime/composables/useUploadKit/plugins/storage/aws-s3"
