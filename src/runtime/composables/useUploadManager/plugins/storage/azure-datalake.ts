import { ref } from "vue"
import { DataLakeDirectoryClient, type PathHttpHeaders } from "@azure/storage-file-datalake"
import { defineStoragePlugin } from "../../types"

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

  /**
   * Number of retry attempts for failed operations
   * @default 3
   */
  retries?: number

  /**
   * Initial delay between retries in milliseconds
   * Uses exponential backoff: delay * (2 ^ attempt)
   * @default 1000 (1 second)
   */
  retryDelay?: number
}

export interface AzureUploadResult {
  /**
   * Full URL to the uploaded file
   */
  url: string

  /**
   * File name/path in the storage
   */
  blobPath: string
}

export const PluginAzureDataLake = defineStoragePlugin<AzureDataLakeOptions, AzureUploadResult>((options) => {
  const sasURL = ref(options.sasURL || "")
  let refreshPromise: Promise<string> | null = null

  // Cache to store directories we've already checked/created to avoid redundant API calls
  const directoryCheckedCache = new Set<string>()

  // Retry configuration
  const maxRetries = options.retries ?? 3
  const initialRetryDelay = options.retryDelay ?? 1000

  /**
   * Retry an async operation with exponential backoff
   */
  async function withRetry<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break
        }

        // Calculate exponential backoff delay
        const delay = initialRetryDelay * Math.pow(2, attempt)

        if (import.meta.dev) {
          console.warn(
            `[Azure Storage] ${operationName} failed (attempt ${attempt + 1}/${maxRetries + 1}). ` + `Retrying in ${delay}ms...`,
            error,
          )
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    // All retries exhausted
    throw new Error(`[Azure Storage] ${operationName} failed after ${maxRetries + 1} attempts: ${lastError?.message}`)
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
   * Get file client for a specific blob
   */
  const getFileClient = async (blobName: string) => {
    // Smart Refresh: Only fetch if empty or expired
    if (options.getSASUrl && isTokenExpired(sasURL.value)) {
      if (!refreshPromise) {
        refreshPromise = options.getSASUrl().then((url) => {
          refreshPromise = null
          return url
        })
      }
      sasURL.value = await refreshPromise
    }

    let dir = new DataLakeDirectoryClient(sasURL.value)

    // Navigate to subdirectory if path is specified
    if (options.path) {
      const cleanPath = options.path.replace(/^\/+|\/+$/g, "") // trim leading/trailing slashes
      dir = dir.getSubdirectoryClient(cleanPath)

      // Only attempt creation if enabled (default true) AND not already checked
      const shouldCreateDir = options.autoCreateDirectory ?? true

      if (shouldCreateDir && !directoryCheckedCache.has(cleanPath)) {
        // Create directory if it doesn't exist
        try {
          await dir.createIfNotExists()
          directoryCheckedCache.add(cleanPath)
        } catch (error) {
          // Ignore if already exists
          if (import.meta.dev) {
            console.debug(`Azure directory already exists or couldn't be created: ${cleanPath}`, error)
          }
        }
      }
    }

    return dir.getFileClient(blobName)
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

        return withRetry(async () => {
          const fileClient = await getFileClient(file.id)

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
            blobPath: fileClient.name,
          } satisfies AzureUploadResult
        }, `Upload file "${file.name}"`)
      },

      /**
       * Get remote file metadata from Azure
       */
      async getRemoteFile(fileId, _context) {
        return withRetry(async () => {
          const fileClient = await getFileClient(fileId)
          const properties = await fileClient.getProperties()

          return {
            size: properties.contentLength || 0,
            mimeType: properties.contentType || "application/octet-stream",
            remoteUrl: fileClient.url,
          }
        }, `Get remote file "${fileId}"`)
      },

      /**
       * Delete file from Azure Blob Storage
       */
      async remove(file, _context) {
        return withRetry(async () => {
          const fileClient = await getFileClient(file.id)
          await fileClient.deleteIfExists()
        }, `Delete file "${file.name}"`)
      },
    },
  }
})
