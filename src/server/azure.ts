/**
 * Azure server adapter — Nitro-side, uses `@azure/storage-blob` directly.
 *
 * Works with standard Azure Storage accounts and Data Lake Gen2 (via the blob endpoint).
 * Uses the SDK's `generateBlobSASQueryParameters` for presigning; uploads are single PUT
 * requests against the returned SAS URL with `x-ms-blob-type: BlockBlob`.
 *
 * @example
 * ```typescript
 * import { AzureStorage } from "nuxt-upload-kit/server/azure"
 *
 * export default defineUploadServerConfig({
 *   storage: AzureStorage({
 *     account: "mystorageaccount",
 *     container: "uploads",
 *     credentials: { accountKey: "..." },
 *   }),
 * })
 * ```
 */
export { AzureStorage, type AzureStorageOptions } from "../runtime/server/adapters/azure"
