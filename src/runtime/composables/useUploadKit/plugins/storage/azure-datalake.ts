import { ref } from "vue"
import { DataLakeDirectoryClient, type PathHttpHeaders } from "@azure/storage-file-datalake"
import { defineStorageAdapter } from "../../types"

export interface AzureDataLakeOptions {
  /**
   * Static SAS URL for Azure Data Lake Storage
   */
  sasURL?: string

  /**
   * Function to dynamically fetch SAS URL
   * Use this to handle token expiration/refreshing.
   * If provided, it will be called before every file operation.
   */
  getSASUrl?: () => Promise<string>

  /**
   * Optional subdirectory path within the container
   * @example "uploads/images"
   */
  path?: string

  /**
   * Custom metadata to attach to uploaded files
   */
  metadata?: Record<string, string>

  /**
   * Custom HTTP headers for uploaded files
   */
  pathHttpHeaders?: Omit<PathHttpHeaders, "contentType">

  /**
   * Automatically try to create the directory if it doesn't exist.
   * Disable this if your SAS token only has 'Write' (Blob) permissions
   * and not 'Create' (Directory) permissions.
   * @default true
   */
  autoCreateDirectory?: boolean
}

export interface AzureUploadResult {
  /**
   * Full URL to the uploaded file
   */
  url: string

  /**
   * Identifier to pass to getRemoteFile for retrieval
   */
  storageKey: string
}

export const PluginAzureDataLake = defineStorageAdapter<AzureDataLakeOptions, AzureUploadResult>((options) => {
  const sasURL = ref(options.sasURL || "")
  let refreshPromise: Promise<string> | null = null

  // Cache to store directories we've already checked/created to avoid redundant API calls
  const directoryCheckedCache = new Set<string>()

  /**
   * Extract the base path from a SAS URL.
   * SAS URL format: https://{account}.blob.core.windows.net/{container}/{basePath}?sig=...
   * Returns the path after the container (e.g., "orgId" or "orgId/subdir")
   */
  const getBasePathFromSasUrl = (url: string): string => {
    try {
      const parsed = new URL(url)
      // pathname is like /{container}/{basePath}
      const parts = parsed.pathname.split("/").filter(Boolean)
      // Skip container (first part), return the rest joined
      return parts.slice(1).join("/")
    } catch {
      return ""
    }
  }

  /**
   * Build the full storage key for a file.
   * Combines: basePath (from SAS URL) + options.path + filename
   */
  const buildFullStorageKey = (filename: string): string => {
    const basePath = getBasePathFromSasUrl(sasURL.value)
    const parts = [basePath, options.path, filename].filter(Boolean)
    return parts.join("/")
  }

  // Initialize SAS URL if getSASUrl is provided
  if (options.getSASUrl && !options.sasURL) {
    options.getSASUrl().then((url) => {
      sasURL.value = url
    })
  }

  /**
   * Check if the current SAS URL is expired or about to expire (within buffer)
   */
  const isTokenExpired = (urlStr: string, bufferMinutes = 5): boolean => {
    if (!urlStr) return true
    try {
      const url = new URL(urlStr)
      const expiryStr = url.searchParams.get("se") // Azure SAS "Signed Expiry"
      if (!expiryStr) return true // No expiry? err on safe side

      const expiry = new Date(expiryStr)
      const now = new Date()
      // Check if now + buffer > expiry
      return now.getTime() + bufferMinutes * 60 * 1000 > expiry.getTime()
    } catch {
      return true
    }
  }

  /**
   * Get file client for a specific blob.
   * Expects the full blob path (e.g., "basePath/subdir/filename.jpg").
   */
  const getFileClient = async (fullBlobPath: string) => {
    // Smart Refresh: Only fetch if empty or expired
    if (options.getSASUrl && isTokenExpired(sasURL.value)) {
      refreshPromise ??= options.getSASUrl().then((url) => {
        refreshPromise = null
        return url
      })
      sasURL.value = await refreshPromise
    }

    // Strip the basePath since DataLakeDirectoryClient(sasURL) already points there
    const basePath = getBasePathFromSasUrl(sasURL.value)
    const relativePath =
      basePath && fullBlobPath.startsWith(basePath + "/") ? fullBlobPath.slice(basePath.length + 1) : fullBlobPath

    // Split path into directory and filename
    const pathParts = relativePath.split("/")
    const filename = pathParts.pop()!
    const dirPath = pathParts.join("/")

    let dir = new DataLakeDirectoryClient(sasURL.value)

    // Navigate to subdirectory if the path contains directories
    if (dirPath) {
      dir = dir.getSubdirectoryClient(dirPath)

      // Only attempt creation if enabled (default true) AND not already checked
      const shouldCreateDir = options.autoCreateDirectory ?? true

      if (shouldCreateDir && !directoryCheckedCache.has(dirPath)) {
        // Create directory if it doesn't exist
        try {
          await dir.createIfNotExists()
          directoryCheckedCache.add(dirPath)
        } catch (error) {
          // Ignore if already exists
          if (import.meta.dev) {
            console.debug(`Azure directory already exists or couldn't be created: ${dirPath}`, error)
          }
        }
      }
    }

    return dir.getFileClient(filename)
  }

  return {
    id: "azure-datalake-storage",
    hooks: {
      /**
       * Upload file to Azure Blob Storage
       */
      async upload(file, context) {
        // Remote files don't have local data - this shouldn't happen
        // but add a guard just in case
        if (file.source !== "local" || file.data === null) {
          throw new Error("Cannot upload remote file - no local data available")
        }

        // Build full storage key upfront
        const storageKey = buildFullStorageKey(file.id)
        const fileClient = await getFileClient(storageKey)

        await fileClient.upload(file.data, {
          metadata: {
            ...options.metadata,
            mimeType: file.mimeType,
            size: String(file.size),
            originalName: file.name,
          },
          pathHttpHeaders: {
            ...options.pathHttpHeaders,
            contentType: file.mimeType,
          },
          onProgress: ({ loadedBytes }: { loadedBytes: number }) => {
            const uploadedPercentage = Math.round((loadedBytes / file.size) * 100)
            context.onProgress(uploadedPercentage)
          },
        })

        return {
          url: fileClient.url,
          storageKey,
        } satisfies AzureUploadResult
      },

      /**
       * Get remote file metadata from Azure.
       * Expects the full storageKey (e.g., "basePath/subdir/filename.jpg").
       */
      async getRemoteFile(storageKey, _context) {
        const fileClient = await getFileClient(storageKey)
        const properties = await fileClient.getProperties()

        return {
          size: properties.contentLength || 0,
          mimeType: properties.contentType || "application/octet-stream",
          remoteUrl: fileClient.url,
          uploadResult: {
            url: fileClient.url,
            storageKey,
          } satisfies AzureUploadResult,
        }
      },

      /**
       * Delete file from Azure Blob Storage.
       * Uses file.storageKey (the full path in storage).
       */
      async remove(file, _context) {
        // Use storageKey for deletion - this is set after upload or from initialFiles
        const storageKey = file.storageKey
        if (!storageKey) {
          // File was never uploaded to storage - nothing to delete
          if (import.meta.dev) {
            console.debug(`[Azure Storage] Skipping delete for file "${file.name}" - no storageKey`)
          }
          return
        }

        const fileClient = await getFileClient(storageKey)
        await fileClient.deleteIfExists()
      },
    },
  }
})
