/**
 * Storage Adapter Plugins
 *
 * These plugins handle the actual upload, download, and deletion of files
 * to/from various cloud storage providers.
 *
 * Only ONE storage plugin should be active per uploader instance.
 * If you need multiple storage destinations, create multiple uploader instances.
 */

// Azure Data Lake Storage
export { PluginAzureDataLake, type AzureDataLakeOptions, type AzureUploadResult } from "./azure-datalake"

/**
 * AWS S3 Storage Adapter (also works with S3-compatible services: MinIO, DigitalOcean Spaces, Wasabi, Backblaze B2)
 * @experimental This adapter is experimental and may change in future releases.
 */
export { PluginAWSS3, type AWSS3Options, type AWSS3UploadResult } from "./aws-s3"

/**
 * Cloudflare R2 Storage Adapter
 * @experimental This adapter is experimental and may change in future releases.
 */
export { PluginCloudflareR2, type CloudflareR2Options, type CloudflareR2UploadResult } from "./cloudflare-r2"

/**
 * Firebase Storage Adapter
 * @experimental This adapter is experimental and may change in future releases.
 */
export { PluginFirebaseStorage, type FirebaseStorageOptions, type FirebaseStorageUploadResult } from "./firebase-storage"
