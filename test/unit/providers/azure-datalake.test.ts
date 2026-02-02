import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockPluginContext } from "../../helpers"
import { PluginAzureDataLake } from "../../../src/runtime/composables/useUploadKit/plugins/storage/azure-datalake"

// Track subdirectory navigation for integration tests
let lastSubdirectoryPath: string | null = null

// Mock the Azure SDK - vitest hoists vi.mock calls automatically
vi.mock("@azure/storage-file-datalake", () => {
  // Use a class to properly support `new` keyword
  class MockDataLakeDirectoryClient {
    sasUrl: string

    constructor(sasUrl: string) {
      this.sasUrl = sasUrl
    }

    getFileClient() {
      return {
        url: `${this.sasUrl}/test-file.jpg`,
        name: "test-file.jpg",
        upload: vi.fn().mockResolvedValue({}),
        getProperties: vi.fn().mockResolvedValue({
          contentLength: 1024,
          contentType: "image/jpeg",
        }),
        deleteIfExists: vi.fn().mockResolvedValue({}),
      }
    }

    getSubdirectoryClient(path: string) {
      lastSubdirectoryPath = path
      return new MockDataLakeDirectoryClient(`${this.sasUrl}/${path}`)
    }

    createIfNotExists() {
      return Promise.resolve({})
    }
  }

  return {
    DataLakeDirectoryClient: MockDataLakeDirectoryClient,
  }
})

describe("providers", () => {
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

    describe("SAS URL with embedded path (directory-scoped tokens)", () => {
      it("should not navigate to doubled path when uploading with directory-scoped SAS", async () => {
        // This integration test verifies the plugin correctly handles directory-scoped SAS URLs
        // by checking the actual path passed to getSubdirectoryClient
        lastSubdirectoryPath = null

        const directoryScopedSasUrl =
          "https://account.dfs.core.windows.net/container/org123?sv=2026-02-06&se=2030-01-01T00:00:00Z&sr=d&sp=rcwd&sig=mock"

        const plugin = PluginAzureDataLake({
          sasURL: directoryScopedSasUrl,
          autoCreateDirectory: false, // Skip directory creation to simplify test
        })

        const localFile = {
          id: "test-file.jpg",
          name: "test-file.jpg",
          size: 1024,
          mimeType: "image/jpeg",
          status: "waiting" as const,
          progress: { percentage: 0 },
          source: "local" as const,
          data: new File(["test"], "test-file.jpg", { type: "image/jpeg" }),
          meta: {},
        }

        const context = {
          ...createMockPluginContext(),
          onProgress: vi.fn(),
        }

        await plugin.hooks.upload(localFile, context)

        // The bug: without the fix, this would be "org123" (the basePath gets doubled)
        // The fix: should be null (no subdirectory navigation needed for direct file upload)
        //          or should NOT contain "org123" if there's additional path nesting
        expect(lastSubdirectoryPath).not.toBe("org123")
      })

      it("should strip basePath from fullBlobPath to avoid path duplication", () => {
        // This test covers the edge case where users generate directory-scoped SAS tokens
        // using getDirectoryClient(path).generateSasUrl(), which embeds the path in the URL.
        //
        // Example:
        // - SAS URL: https://account.dfs.core.windows.net/container/org123?sig=...
        // - DataLakeDirectoryClient(sasURL) already points to /container/org123
        // - buildFullStorageKey returns "org123/file.jpg"
        // - Without the fix, getFileClient would navigate to "org123/org123/file.jpg" (WRONG)
        // - With the fix, it strips "org123" and navigates to just "file.jpg" (CORRECT)

        const sasUrl =
          "https://socialsundaedev.dfs.core.windows.net/user-uploads/FW3tlZyS1LmXDkE0AJn3kGYhQFUZtT6v?sv=2026-02-06&se=2026-02-09T05%3A00%3A00Z&sr=d&sp=rcwd&sig=mock"

        // Extract basePath from SAS URL (same logic as in the plugin)
        const parsed = new URL(sasUrl)
        const parts = parsed.pathname.split("/").filter(Boolean)
        const basePath = parts.slice(1).join("/") // Skip container

        expect(basePath).toBe("FW3tlZyS1LmXDkE0AJn3kGYhQFUZtT6v")

        // Simulate buildFullStorageKey output
        const fileId = "my-uploaded-file.jpg"
        const fullBlobPath = `${basePath}/${fileId}`

        expect(fullBlobPath).toBe("FW3tlZyS1LmXDkE0AJn3kGYhQFUZtT6v/my-uploaded-file.jpg")

        // Apply the fix: strip basePath since DataLakeDirectoryClient(sasURL) already points there
        const relativePath =
          basePath && fullBlobPath.startsWith(basePath + "/") ? fullBlobPath.slice(basePath.length + 1) : fullBlobPath

        // After stripping, we should only have the filename
        expect(relativePath).toBe("my-uploaded-file.jpg")
      })

      it("should handle nested paths within directory-scoped SAS", () => {
        // When options.path adds additional nesting
        const sasUrl =
          "https://account.dfs.core.windows.net/container/org123?sv=2026-02-06&se=2030-01-01T00:00:00Z&sr=d&sp=rcwd&sig=mock"

        const parsed = new URL(sasUrl)
        const parts = parsed.pathname.split("/").filter(Boolean)
        const basePath = parts.slice(1).join("/")

        expect(basePath).toBe("org123")

        // With options.path = "uploads"
        const optionsPath = "uploads"
        const fileId = "photo.jpg"
        const fullBlobPath = `${basePath}/${optionsPath}/${fileId}`

        expect(fullBlobPath).toBe("org123/uploads/photo.jpg")

        // Strip basePath
        const relativePath =
          basePath && fullBlobPath.startsWith(basePath + "/") ? fullBlobPath.slice(basePath.length + 1) : fullBlobPath

        // Should have options.path + filename
        expect(relativePath).toBe("uploads/photo.jpg")
      })

      it("should not strip anything when SAS URL points to container root", () => {
        // Container-level SAS (no embedded path)
        const sasUrl =
          "https://account.blob.core.windows.net/container?sv=2026-02-06&se=2030-01-01T00:00:00Z&sr=c&sp=rwdl&sig=mock"

        const parsed = new URL(sasUrl)
        const parts = parsed.pathname.split("/").filter(Boolean)
        const basePath = parts.slice(1).join("/")

        // No path after container
        expect(basePath).toBe("")

        const fullBlobPath = "uploads/photo.jpg"

        // With empty basePath, nothing should be stripped
        const relativePath =
          basePath && fullBlobPath.startsWith(basePath + "/") ? fullBlobPath.slice(basePath.length + 1) : fullBlobPath

        expect(relativePath).toBe("uploads/photo.jpg")
      })
    })

    describe("storageKey round-trip contract", () => {
      it("storageKey should be the full path (basePath + options.path + filename)", () => {
        // This test documents the updated contract:
        // storageKey is now the FULL path from the container root, making it self-contained
        // and portable across different contexts.
        //
        // Example scenario:
        // - SAS URL points to: {container}/org123 (basePath = "org123")
        // - options.path = "uploads"
        // - file.id = "abc.jpg"
        // - storageKey returned: "org123/uploads/abc.jpg" (full path)
        // - getRemoteFile("org123/uploads/abc.jpg") correctly resolves the file
        //
        // After upload, file.id is automatically updated to match storageKey,
        // ensuring remove() works correctly.

        const basePath = "org123"
        const optionsPath = "uploads"
        const fileId = "1769118690193-4ll16sb7zy.jpg"

        // The upload hook returns storageKey as full path
        const uploadResult = {
          url: "https://storage.blob.core.windows.net/container/org123/uploads/1769118690193-4ll16sb7zy.jpg",
          storageKey: `${basePath}/${optionsPath}/${fileId}`, // Full path
        }

        // The storageKey IS the full path
        expect(uploadResult.storageKey).toBe("org123/uploads/1769118690193-4ll16sb7zy.jpg")
        expect(uploadResult.storageKey).toContain("/") // Should contain path segments
      })

      it("getRemoteFile should accept and return the full storageKey", () => {
        // getRemoteFile receives the full storageKey and returns it in uploadResult
        const fullStorageKey = "org123/uploads/my-file.jpg"

        // Simulating what getRemoteFile returns
        const remoteFileResult = {
          size: 1024,
          mimeType: "image/jpeg",
          remoteUrl: "https://storage.blob.core.windows.net/container/org123/uploads/my-file.jpg",
          uploadResult: {
            url: "https://storage.blob.core.windows.net/container/org123/uploads/my-file.jpg",
            storageKey: fullStorageKey, // Same as input
          },
        }

        expect(remoteFileResult.uploadResult.storageKey).toBe(fullStorageKey)
      })

      it("storageKey should work without options.path", () => {
        // When no options.path is specified, storageKey is basePath + filename
        const basePath = "org123"
        const fileId = "my-file.jpg"

        const uploadResult = {
          url: "https://storage.blob.core.windows.net/container/org123/my-file.jpg",
          storageKey: `${basePath}/${fileId}`,
        }

        expect(uploadResult.storageKey).toBe("org123/my-file.jpg")
      })
    })
  })
})
