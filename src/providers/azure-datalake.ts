/**
 * Azure Data Lake Storage Adapter
 *
 * This adapter requires the `@azure/storage-file-datalake` package to be installed.
 *
 * @example
 * ```bash
 * npm install @azure/storage-file-datalake
 * # or
 * pnpm add @azure/storage-file-datalake
 * ```
 *
 * @example
 * ```typescript
 * import { PluginAzureDataLake } from "nuxt-upload-kit/providers/azure-datalake"
 *
 * const uploader = useUploadKit({
 *   storage: PluginAzureDataLake({
 *     sasURL: "https://...",
 *     path: "uploads"
 *   })
 * })
 * ```
 */
export {
  PluginAzureDataLake,
  type AzureDataLakeOptions,
  type AzureUploadResult,
} from "../runtime/composables/useUploadKit/plugins/storage/azure-datalake"
