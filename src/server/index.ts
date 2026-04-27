/**
 * Public server entry — for use in Nitro (~~/server/upload.server.config.ts).
 *
 * Restrictions (max size, allowed MIME types, etc.) live in `nuxt.config.ts > uploadKit.restrictions`
 * and are enforced identically client-side and server-side.
 *
 * @example
 * ```typescript
 * import { defineUploadServerConfig } from "nuxt-upload-kit/server"
 * import { S3Storage } from "nuxt-upload-kit/server/s3"
 *
 * export default defineUploadServerConfig({
 *   storage: S3Storage({ bucket: "...", region: "..." }),
 *   authorize: async (event) => ({ userId: "..." }),
 * })
 * ```
 */
export { defineUploadServerConfig } from "../runtime/server"
export type * from "../runtime/server/types"
