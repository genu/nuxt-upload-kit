/**
 * Firebase server adapter — Nitro-side, uses `firebase-admin` directly.
 *
 * Uses the SDK's `getSignedUrl({ version: "v4" })` for presigning; `file.save()` for direct
 * uploads and `file.delete({ ignoreNotFound: true })` for deletion.
 *
 * @example
 * ```typescript
 * import { FirebaseStorage } from "nuxt-upload-kit/server/firebase"
 *
 * export default defineUploadServerConfig({
 *   storage: FirebaseStorage({
 *     bucket: "my-project.appspot.com",
 *     credentials: { projectId, clientEmail, privateKey },
 *   }),
 * })
 * ```
 */
export { FirebaseStorage, type FirebaseStorageOptions } from "../runtime/server/adapters/firebase"
