/**
 * Storage Adapter Plugins
 *
 * These plugins handle the actual upload, download, and deletion of files
 * to/from various cloud storage providers.
 *
 * Only ONE storage plugin should be active per uploader instance.
 * If you need multiple storage destinations, create multiple uploader instances.
 */

export { PluginAzureDataLake, type AzureDataLakeOptions, type AzureUploadResult } from "./azure-datalake"

// Future storage plugins will be exported here:
// export { PluginS3Storage } from './s3'
// export { PluginCloudinaryStorage } from './cloudinary'
// export { PluginSupabaseStorage } from './supabase'
