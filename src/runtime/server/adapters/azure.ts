import {
  BlobSASPermissions,
  BlobServiceClient,
  SASProtocol,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from "@azure/storage-blob"
import type { PresignedFileInput, ServerHookContext, StorageAdapter } from "../types"

export interface AzureStorageOptions {
  /** Azure storage account name (e.g. `mystorageaccount`). */
  account: string
  /** Container name. Works with standard blob containers and Data Lake Gen2 file systems. */
  container: string
  /** Shared key credential. Required for SAS generation. */
  credentials: {
    accountKey: string
  }
  /**
   * Endpoint suffix. Defaults to `core.windows.net`. Override for sovereign clouds
   * (e.g. `core.chinacloudapi.cn`, `core.usgovcloudapi.net`).
   */
  endpointSuffix?: string
  /** Seconds until SAS URLs expire. Defaults to 900 (15 min). */
  expiresIn?: number
  /** Resolve the storage key. Defaults to `uploads/${fileId}`. */
  keyStrategy?: (input: PresignedFileInput) => string
  /**
   * Build the public URL for an uploaded blob. Defaults to the blob's canonical URL
   * (accessible only if the container allows anonymous reads). Override for CDN domains.
   */
  publicUrl?: (key: string) => string
}

export const AzureStorage = (options: AzureStorageOptions): StorageAdapter => {
  const endpointSuffix = options.endpointSuffix ?? "core.windows.net"
  const blobEndpoint = `https://${options.account}.blob.${endpointSuffix}`
  const sharedKey = new StorageSharedKeyCredential(options.account, options.credentials.accountKey)
  const containerClient = new BlobServiceClient(blobEndpoint, sharedKey).getContainerClient(options.container)

  const expiresIn = options.expiresIn ?? 900
  const keyStrategy = options.keyStrategy ?? ((input) => `uploads/${input.fileId}`)
  // Encode each path segment so reserved chars (?, #, +, etc.) round-trip back to the
  // signed blobName when Azure validates the SAS. encodeURI alone leaves ? and # intact.
  const encodeBlobPath = (key: string): string => key.split("/").map(encodeURIComponent).join("/")
  const defaultPublicUrl = (key: string): string => `${blobEndpoint}/${options.container}/${encodeBlobPath(key)}`
  const publicUrl = options.publicUrl ?? defaultPublicUrl

  const buildSas = (key: string, permissions: BlobSASPermissions, contentType?: string): string =>
    generateBlobSASQueryParameters(
      {
        containerName: options.container,
        blobName: key,
        permissions,
        expiresOn: new Date(Date.now() + expiresIn * 1000),
        protocol: SASProtocol.Https,
        contentType,
      },
      sharedKey,
    ).toString()

  const blobUrl = (key: string): string => `${blobEndpoint}/${options.container}/${encodeBlobPath(key)}`

  return {
    id: "azure-storage",
    resolveKey: keyStrategy,
    presignUpload: async (input: PresignedFileInput, _ctx: ServerHookContext) => {
      const key = keyStrategy(input)
      const sas = buildSas(key, BlobSASPermissions.parse("cw"), input.mimeType)
      return {
        uploadUrl: `${blobUrl(key)}?${sas}`,
        publicUrl: publicUrl(key),
        fileId: key,
        // Azure blob PUT requires this header; SAS with cw permission creates a block blob in one shot.
        headers: { "x-ms-blob-type": "BlockBlob" },
      }
    },
    presignDownload: async (key: string) => {
      const sas = buildSas(key, BlobSASPermissions.parse("r"))
      return { downloadUrl: `${blobUrl(key)}?${sas}` }
    },
    delete: async (key: string) => {
      await containerClient.getBlockBlobClient(key).deleteIfExists()
    },
    put: async (input: { key: string; body: unknown; contentType?: string }) => {
      const blobClient = containerClient.getBlockBlobClient(input.key)
      await blobClient.uploadData(input.body as Buffer, {
        blobHTTPHeaders: input.contentType ? { blobContentType: input.contentType } : undefined,
      })
      return { publicUrl: publicUrl(input.key) }
    },
  }
}
