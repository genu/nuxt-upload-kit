/**
 * Public server entry — for use in Nitro (~~/server/upload.server.config.ts).
 *
 * @example
 * ```typescript
 * import { defineUploadServerConfig, MaxFileSize, AllowedMimeTypes } from "nuxt-upload-kit/server"
 * import { S3Storage } from "nuxt-upload-kit/server/s3"
 *
 * export default defineUploadServerConfig({
 *   storage: S3Storage({ bucket: "...", region: "..." }),
 *   validators: [MaxFileSize(10_000_000), AllowedMimeTypes(["image/*"])],
 * })
 * ```
 */
export { defineUploadServerConfig, MaxFileSize, AllowedMimeTypes } from "../runtime/server"
export type * from "../runtime/server/types"
