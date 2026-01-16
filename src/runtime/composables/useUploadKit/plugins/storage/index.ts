/**
 * Storage Adapter Plugins
 *
 * All storage adapters are now imported from dedicated entry points:
 *
 * ```typescript
 * import { PluginAWSS3 } from "nuxt-upload-kit/providers/aws-s3"
 * import { PluginCloudflareR2 } from "nuxt-upload-kit/providers/cloudflare-r2"
 * import { PluginAzureDataLake } from "nuxt-upload-kit/providers/azure-datalake"
 * import { PluginFirebaseStorage } from "nuxt-upload-kit/providers/firebase"
 * ```
 *
 * This prevents bundling unused provider code and external SDK dependencies.
 */

// Re-export types only (no runtime code) for backwards compatibility
export type { AWSS3Options, AWSS3UploadResult } from "./aws-s3"
export type { CloudflareR2Options, CloudflareR2UploadResult } from "./cloudflare-r2"
export type { AzureDataLakeOptions, AzureUploadResult } from "./azure-datalake"
export type { FirebaseStorageOptions, FirebaseStorageUploadResult } from "./firebase-storage"
