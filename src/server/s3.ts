/**
 * S3 server adapter — Nitro-side, uses `@aws-sdk/client-s3` directly.
 *
 * Works with AWS S3 and S3-compatible services (MinIO, R2, Wasabi, B2, Spaces, Supabase Storage).
 * Use `endpoint` + `forcePathStyle: true` for path-style services like MinIO.
 *
 * @example
 * ```typescript
 * import { S3Storage } from "nuxt-upload-kit/server/s3"
 *
 * export default defineUploadServerConfig({
 *   storage: S3Storage({
 *     bucket: "my-bucket",
 *     region: "us-east-1",
 *     credentials: { accessKeyId: "...", secretAccessKey: "..." },
 *   }),
 * })
 * ```
 */
export { S3Storage, type S3StorageOptions } from "../runtime/server/adapters/s3"
