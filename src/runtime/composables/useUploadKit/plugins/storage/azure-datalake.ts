import { ref } from "vue"
import { DataLakeDirectoryClient, DataLakeFileClient, type PathHttpHeaders } from "@azure/storage-file-datalake"
import { defineStorageAdapter } from "../../types"

export interface AzureDataLakeOptions {
  /**
   * Static SAS URL for Azure Data Lake Storage
   */
  sasURL?: string

  /**
   * Function to dynamically fetch SAS URL.
   *
   * The plugin auto-detects whether you return a directory or file SAS:
   * - Directory SAS (sr=d): Cached and reused for batch uploads
   * - File SAS (sr=b): Called per file for granular access control
   *
   * @param storageKey - The intended storage path for the file
   */
  getSASUrl?: (storageKey: string) => Promise<string>

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
   * Only applies when using directory-level SAS.
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

type SasMode = "directory" | "file"

export const PluginAzureDataLake = defineStorageAdapter<AzureDataLakeOptions, AzureUploadResult>((options) => {
  const sasURL = ref(options.sasURL || "")
  let refreshPromise: Promise<string> | null = null

  // Auto-detected mode based on SAS URL type
  let detectedMode: SasMode | null = null

  /**
   * Detect SAS type from URL by checking the 'sr' (signed resource) parameter.
   * - sr=d: directory
   * - sr=b: blob (file)
   */
  const detectSasMode = (url: string): SasMode => {
    try {
      const sr = new URL(url).searchParams.get("sr")
      return sr === "d" ? "directory" : "file"
    } catch {
      return "directory" // Default to directory for backward compatibility
    }
  }

  /**
   * Extract the blob path from an Azure blob URL.
   * URL format: https://{account}.blob.core.windows.net/{container}/{blobPath}?...
   * Returns the path after the container (e.g., "orgId/subdir/file.jpg")
   */
  const getBlobPathFromUrl = (url: string): string => {
    try {
      const parsed = new URL(url)
      // pathname is like /{container}/{blobPath}
      const parts = parsed.pathname.split("/").filter(Boolean)
      // Skip container (first part), return the rest joined
      return parts.slice(1).join("/")
    } catch {
      return ""
    }
  }

  /**
   * Build the full storage key for a file.
   * For directory mode: basePath (from SAS URL) + options.path + filename
   * For file mode: options.path + filename (server controls the base path)
   */
  const buildFullStorageKey = (filename: string, forRequest = false): string => {
    if (forRequest && detectedMode === "file") {
      // For file mode requests, don't include basePath - server will handle it
      const parts = [options.path, filename].filter(Boolean)
      return parts.join("/")
    }
    // For directory mode or for the final storageKey
    const basePath = getBlobPathFromUrl(sasURL.value)
    const parts = [basePath, options.path, filename].filter(Boolean)
    return parts.join("/")
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
   * Get SAS URL for a file, handling auto-detection and caching.
   */
  const getSasUrlForFile = async (storageKey: string): Promise<string> => {
    // Static SAS URL - always use it
    if (options.sasURL) {
      detectedMode ??= detectSasMode(options.sasURL)
      return options.sasURL
    }

    if (!options.getSASUrl) {
      throw new Error("Either sasURL or getSASUrl must be provided")
    }

    // File mode: always fetch fresh URL per file (no caching/deduplication)
    if (detectedMode === "file") return options.getSASUrl(storageKey)

    // First call - need to detect mode
    if (!detectedMode) {
      const url = await options.getSASUrl(storageKey)
      detectedMode = detectSasMode(url)
      sasURL.value = url

      if (import.meta.dev) console.debug(`[Azure Storage] Auto-detected SAS mode: ${detectedMode}`)

      // If we just discovered it's file mode, return this URL
      if (detectedMode === "file") return url
    }

    // Directory mode: cache with expiry check and deduplication
    if (isTokenExpired(sasURL.value)) {
      refreshPromise ??= options.getSASUrl(storageKey).then((url) => {
        refreshPromise = null
        sasURL.value = url
        return url
      })

      await refreshPromise
    }

    return sasURL.value
  }

  /**
   * Get file client for a specific blob using directory-level SAS.
   */
  const getFileClientFromDirectory = async (sasUrl: string, fullBlobPath: string) => {
    // Strip the basePath since DataLakeDirectoryClient(sasURL) already points there
    const basePath = getBlobPathFromUrl(sasUrl)
    const relativePath =
      basePath && fullBlobPath.startsWith(basePath + "/") ? fullBlobPath.slice(basePath.length + 1) : fullBlobPath

    // Split path into directory and filename
    const pathParts = relativePath.split("/")
    const filename = pathParts.pop()!
    const dirPath = pathParts.join("/")

    let dir = new DataLakeDirectoryClient(sasUrl)

    // Navigate to subdirectory if the path contains directories
    if (dirPath) {
      dir = dir.getSubdirectoryClient(dirPath)

      // Create directory if it doesn't exist (idempotent operation)
      if (options.autoCreateDirectory ?? true) {
        try {
          await dir.createIfNotExists()
        } catch {
          // Ignore - directory may already exist or permissions may not allow creation
        }
      }
    }

    return dir.getFileClient(filename)
  }

  /**
   * Get file client - handles both directory and file mode SAS.
   */
  const getFileClient = async (storageKey: string) => {
    const sasUrl = await getSasUrlForFile(storageKey)

    if (detectedMode === "file") {
      // File mode: SAS URL points directly to the file
      return new DataLakeFileClient(sasUrl)
    }

    // Directory mode: navigate from directory
    return getFileClientFromDirectory(sasUrl, storageKey)
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

        // Build storage key - for file mode requests, we pass a relative key
        // For the final result, we need the full key
        const requestKey = buildFullStorageKey(file.id, true)
        const fileClient = await getFileClient(requestKey)

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

        // Extract the actual storage key from the file client URL
        const actualStorageKey = getBlobPathFromUrl(fileClient.url) || requestKey

        return {
          url: fileClient.url,
          storageKey: actualStorageKey,
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
