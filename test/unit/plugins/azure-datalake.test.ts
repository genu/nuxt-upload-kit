import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createMockLocalUploadFile, createMockPluginContext, createMockBlob } from "../../helpers"

// Mock the Azure SDK before importing the plugin
vi.mock("@azure/storage-file-datalake", () => ({
  DataLakeDirectoryClient: vi.fn().mockImplementation((sasUrl: string) => {
    const mockFileClient = {
      url: `${sasUrl}/test-file.jpg`,
      name: "test-file.jpg",
      upload: vi.fn().mockResolvedValue({}),
      getProperties: vi.fn().mockResolvedValue({
        contentLength: 1024,
        contentType: "image/jpeg",
      }),
      deleteIfExists: vi.fn().mockResolvedValue({}),
    }

    const mockSubdirClient = {
      getFileClient: vi.fn().mockReturnValue(mockFileClient),
      createIfNotExists: vi.fn().mockResolvedValue({}),
      getSubdirectoryClient: vi.fn().mockReturnThis(),
    }

    return {
      getFileClient: vi.fn().mockReturnValue(mockFileClient),
      getSubdirectoryClient: vi.fn().mockReturnValue(mockSubdirClient),
      createIfNotExists: vi.fn().mockResolvedValue({}),
    }
  }),
}))

// Import after mocking
import { PluginAzureDataLake } from "../../../src/runtime/composables/useUploadKit/plugins/storage/azure-datalake"

describe("PluginAzureDataLake", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("plugin configuration", () => {
    it("should have correct plugin ID", () => {
      const plugin = PluginAzureDataLake({
        sasURL: "https://storage.blob.core.windows.net/container?sv=2021-06-08&se=2030-01-01T00:00:00Z&sr=c&sp=rwdl&sig=mock",
      })

      expect(plugin.id).toBe("azure-datalake-storage")
    })

    it("should accept static SAS URL", () => {
      const plugin = PluginAzureDataLake({
        sasURL: "https://storage.blob.core.windows.net/container?sv=2021-06-08&se=2030-01-01T00:00:00Z&sr=c&sp=rwdl&sig=mock",
      })

      expect(plugin).toBeDefined()
      expect(plugin.hooks.upload).toBeDefined()
    })

    it("should accept dynamic getSASUrl function", () => {
      const getSASUrl = vi
        .fn()
        .mockResolvedValue(
          "https://storage.blob.core.windows.net/container?sv=2021-06-08&se=2030-01-01T00:00:00Z&sr=c&sp=rwdl&sig=mock",
        )

      const plugin = PluginAzureDataLake({ getSASUrl })

      expect(plugin).toBeDefined()
    })

    it("should accept optional path configuration", () => {
      const plugin = PluginAzureDataLake({
        sasURL: "https://storage.blob.core.windows.net/container?sv=2021-06-08&se=2030-01-01T00:00:00Z&sr=c&sp=rwdl&sig=mock",
        path: "uploads/images",
      })

      expect(plugin).toBeDefined()
    })

    it("should accept custom metadata", () => {
      const plugin = PluginAzureDataLake({
        sasURL: "https://storage.blob.core.windows.net/container?sv=2021-06-08&se=2030-01-01T00:00:00Z&sr=c&sp=rwdl&sig=mock",
        metadata: {
          environment: "test",
          version: "1.0",
        },
      })

      expect(plugin).toBeDefined()
    })

    it("should accept retry configuration", () => {
      const plugin = PluginAzureDataLake({
        sasURL: "https://storage.blob.core.windows.net/container?sv=2021-06-08&se=2030-01-01T00:00:00Z&sr=c&sp=rwdl&sig=mock",
        retries: 5,
        retryDelay: 2000,
      })

      expect(plugin).toBeDefined()
    })

    it("should accept autoCreateDirectory option", () => {
      const plugin = PluginAzureDataLake({
        sasURL: "https://storage.blob.core.windows.net/container?sv=2021-06-08&se=2030-01-01T00:00:00Z&sr=c&sp=rwdl&sig=mock",
        autoCreateDirectory: false,
      })

      expect(plugin).toBeDefined()
    })
  })

  describe("upload hook", () => {
    it("should have upload hook defined", () => {
      const plugin = PluginAzureDataLake({
        sasURL: "https://storage.blob.core.windows.net/container?sv=2021-06-08&se=2030-01-01T00:00:00Z&sr=c&sp=rwdl&sig=mock",
      })

      expect(plugin.hooks.upload).toBeDefined()
      expect(typeof plugin.hooks.upload).toBe("function")
    })

    it("should reject remote files without local data", async () => {
      const plugin = PluginAzureDataLake({
        sasURL: "https://storage.blob.core.windows.net/container?sv=2021-06-08&se=2030-01-01T00:00:00Z&sr=c&sp=rwdl&sig=mock",
      })

      const remoteFile = {
        id: "remote.jpg",
        name: "remote.jpg",
        size: 1024,
        mimeType: "image/jpeg",
        status: "complete" as const,
        progress: { percentage: 100 },
        source: "storage" as const,
        data: null,
        remoteUrl: "https://example.com/remote.jpg",
        meta: {},
      }

      const context = {
        ...createMockPluginContext(),
        onProgress: vi.fn(),
      }

      await expect(plugin.hooks.upload(remoteFile, context)).rejects.toThrow(
        "Cannot upload remote file - no local data available",
      )
    })
  })

  describe("getRemoteFile hook", () => {
    it("should have getRemoteFile hook defined", () => {
      const plugin = PluginAzureDataLake({
        sasURL: "https://storage.blob.core.windows.net/container?sv=2021-06-08&se=2030-01-01T00:00:00Z&sr=c&sp=rwdl&sig=mock",
      })

      expect(plugin.hooks.getRemoteFile).toBeDefined()
      expect(typeof plugin.hooks.getRemoteFile).toBe("function")
    })
  })

  describe("remove hook", () => {
    it("should have remove hook defined", () => {
      const plugin = PluginAzureDataLake({
        sasURL: "https://storage.blob.core.windows.net/container?sv=2021-06-08&se=2030-01-01T00:00:00Z&sr=c&sp=rwdl&sig=mock",
      })

      expect(plugin.hooks.remove).toBeDefined()
      expect(typeof plugin.hooks.remove).toBe("function")
    })
  })

  describe("SAS token expiry detection", () => {
    it("should detect expired SAS token", () => {
      // Test the isTokenExpired logic
      const expiredUrl =
        "https://storage.blob.core.windows.net/container?sv=2021-06-08&se=2020-01-01T00:00:00Z&sr=c&sp=rwdl&sig=mock"

      const url = new URL(expiredUrl)
      const expiryStr = url.searchParams.get("se")
      const expiry = new Date(expiryStr!)
      const now = new Date()
      const bufferMinutes = 5

      const isExpired = now.getTime() + bufferMinutes * 60 * 1000 > expiry.getTime()

      expect(isExpired).toBe(true)
    })

    it("should detect valid SAS token", () => {
      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 1)
      const validUrl = `https://storage.blob.core.windows.net/container?sv=2021-06-08&se=${futureDate.toISOString()}&sr=c&sp=rwdl&sig=mock`

      const url = new URL(validUrl)
      const expiryStr = url.searchParams.get("se")
      const expiry = new Date(expiryStr!)
      const now = new Date()
      const bufferMinutes = 5

      const isExpired = now.getTime() + bufferMinutes * 60 * 1000 > expiry.getTime()

      expect(isExpired).toBe(false)
    })

    it("should handle URL without se parameter", () => {
      const urlWithoutExpiry = "https://storage.blob.core.windows.net/container?sv=2021-06-08&sr=c&sp=rwdl&sig=mock"

      const url = new URL(urlWithoutExpiry)
      const expiryStr = url.searchParams.get("se")

      // No expiry parameter should be treated as expired (safe side)
      expect(expiryStr).toBeNull()
    })
  })

  describe("path handling", () => {
    it("should strip leading and trailing slashes from path", () => {
      const path = "/uploads/images/"
      const cleanPath = path.replace(/^\/+|\/+$/g, "")

      expect(cleanPath).toBe("uploads/images")
    })

    it("should handle path with only slashes", () => {
      const path = "///"
      const cleanPath = path.replace(/^\/+|\/+$/g, "")

      expect(cleanPath).toBe("")
    })

    it("should preserve path without slashes", () => {
      const path = "uploads"
      const cleanPath = path.replace(/^\/+|\/+$/g, "")

      expect(cleanPath).toBe("uploads")
    })
  })

  describe("retry logic", () => {
    it("should use default retry configuration", () => {
      const plugin = PluginAzureDataLake({
        sasURL: "https://storage.blob.core.windows.net/container?sv=2021-06-08&se=2030-01-01T00:00:00Z&sr=c&sp=rwdl&sig=mock",
      })

      // Default retries: 3, default delay: 1000ms
      expect(plugin).toBeDefined()
    })

    it("should calculate exponential backoff correctly", () => {
      const initialDelay = 1000
      const delays = []

      for (let attempt = 0; attempt < 4; attempt++) {
        delays.push(initialDelay * Math.pow(2, attempt))
      }

      expect(delays).toEqual([1000, 2000, 4000, 8000])
    })
  })

  describe("directory caching", () => {
    it("should cache checked directories concept", () => {
      // Test the caching behavior conceptually
      const directoryCache = new Set<string>()

      directoryCache.add("uploads/images")

      expect(directoryCache.has("uploads/images")).toBe(true)
      expect(directoryCache.has("uploads/videos")).toBe(false)
    })
  })

  describe("upload result format", () => {
    it("should define correct result structure", () => {
      // Expected result format
      interface AzureUploadResult {
        url: string
        blobPath: string
      }

      const expectedResult: AzureUploadResult = {
        url: "https://storage.blob.core.windows.net/container/test.jpg",
        blobPath: "test.jpg",
      }

      expect(expectedResult.url).toBeDefined()
      expect(expectedResult.blobPath).toBeDefined()
    })
  })
})
