/**
 * Storage Adapter Plugins
 *
 * All storage adapters are now imported from dedicated entry points:
 *
 * ```typescript
 * import { PluginS3 } from "nuxt-upload-kit/providers/s3"
 * import { PluginAzureDataLake } from "nuxt-upload-kit/providers/azure-datalake"
 * import { PluginFirebaseStorage } from "nuxt-upload-kit/providers/firebase"
 * ```
 *
 * This prevents bundling unused provider code and external SDK dependencies.
 */

// Re-export types only (no runtime code) for backwards compatibility
export type { S3Options, S3UploadResult } from "./s3"
export type { AzureDataLakeOptions, AzureUploadResult } from "./azure-datalake"
export type { FirebaseStorageOptions, FirebaseStorageUploadResult } from "./firebase-storage"
