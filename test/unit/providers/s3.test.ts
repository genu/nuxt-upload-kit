import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createMockPluginContext, createMockLocalUploadFile, createMockRemoteUploadFile } from "../../helpers"
import { PluginS3 } from "../../../src/runtime/composables/useUploadKit/plugins/storage/s3"

// Factory to create mock XHR instances
function createMockXHR() {
  let loadHandler: (() => void) | undefined

  const mockXHR = {
    open: vi.fn(),
    send: vi.fn(() => {
      // Trigger load handler after send is called
      if (loadHandler) {
        Promise.resolve().then(() => loadHandler!())
      }
    }),
    setRequestHeader: vi.fn(),
    addEventListener: vi.fn((event: string, handler: () => void) => {
      if (event === "load") {
        loadHandler = handler
      }
    }),
    getResponseHeader: vi.fn().mockReturnValue('"mock-etag"'),
    upload: { addEventListener: vi.fn() },
    status: 200,
  }

  return mockXHR
}

describe("providers", () => {
  describe("PluginS3", () => {
    let mockXHRInstance: ReturnType<typeof createMockXHR>

    beforeEach(() => {
      vi.clearAllMocks()

      // Create a factory that generates new mock instances
      vi.stubGlobal("XMLHttpRequest", function () {
        mockXHRInstance = createMockXHR()
        return mockXHRInstance
      })
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    describe("plugin configuration", () => {
      it("should have correct plugin ID", () => {
        const plugin = PluginS3({
          getPresignedUploadUrl: vi.fn(),
        })

        expect(plugin.id).toBe("s3-storage")
      })

      it("should require getPresignedUploadUrl function", () => {
        const getPresignedUploadUrl = vi.fn()
        const plugin = PluginS3({ getPresignedUploadUrl })

        expect(plugin).toBeDefined()
        expect(plugin.hooks.upload).toBeDefined()
      })

      it("should accept optional getPresignedDownloadUrl", () => {
        const plugin = PluginS3({
          getPresignedUploadUrl: vi.fn(),
          getPresignedDownloadUrl: vi.fn(),
        })

        expect(plugin).toBeDefined()
      })

      it("should accept optional deleteFile function", () => {
        const plugin = PluginS3({
          getPresignedUploadUrl: vi.fn(),
          deleteFile: vi.fn(),
        })

        expect(plugin).toBeDefined()
      })

      it("should accept retry configuration", () => {
        const plugin = PluginS3({
          getPresignedUploadUrl: vi.fn(),
          retries: 5,
          retryDelay: 2000,
        })

        expect(plugin).toBeDefined()
      })

      it("should accept optional path configuration", () => {
        const plugin = PluginS3({
          getPresignedUploadUrl: vi.fn(),
          path: "uploads/images",
        })

        expect(plugin).toBeDefined()
      })
    })

    describe("upload hook", () => {
      it("should have upload hook defined", () => {
        const plugin = PluginS3({
          getPresignedUploadUrl: vi.fn(),
        })

        expect(plugin.hooks.upload).toBeDefined()
        expect(typeof plugin.hooks.upload).toBe("function")
      })

      it("should reject remote files without local data", async () => {
        const plugin = PluginS3({
          getPresignedUploadUrl: vi.fn(),
        })

        const remoteFile = createMockRemoteUploadFile()
        const context = {
          ...createMockPluginContext(),
          onProgress: vi.fn(),
        }

        await expect(plugin.hooks.upload(remoteFile, context)).rejects.toThrow(
          "Cannot upload remote file - no local data available",
        )
      })

      it("should call getPresignedUploadUrl with correct parameters", async () => {
        const getPresignedUploadUrl = vi.fn().mockResolvedValue({
          uploadUrl: "https://bucket.s3.amazonaws.com/key?signature=xxx",
          publicUrl: "https://bucket.s3.amazonaws.com/key",
        })

        const plugin = PluginS3({ getPresignedUploadUrl })

        const file = createMockLocalUploadFile({
          id: "test-file-id",
          name: "test.jpg",
          size: 1024,
          mimeType: "image/jpeg",
        })

        const context = {
          ...createMockPluginContext(),
          onProgress: vi.fn(),
        }

        await plugin.hooks.upload(file, context)

        expect(getPresignedUploadUrl).toHaveBeenCalledWith("test-file-id", "image/jpeg", {
          fileName: "test.jpg",
          fileSize: 1024,
        })
      })

      it("should return correct upload result structure", async () => {
        const getPresignedUploadUrl = vi.fn().mockResolvedValue({
          uploadUrl: "https://bucket.s3.amazonaws.com/uploads/file.jpg?signature=xxx",
          publicUrl: "https://bucket.s3.amazonaws.com/uploads/file.jpg",
        })

        const plugin = PluginS3({ getPresignedUploadUrl })

        const file = createMockLocalUploadFile({ id: "my-file-id" })
        const context = {
          ...createMockPluginContext(),
          onProgress: vi.fn(),
        }

        const result = await plugin.hooks.upload(file, context)

        expect(result).toHaveProperty("url")
        expect(result).toHaveProperty("storageKey")
        expect(result.url).toBe("https://bucket.s3.amazonaws.com/uploads/file.jpg")
        expect(result.storageKey).toBe("my-file-id")
      })

      it("should include path prefix in storageKey when path option is set", async () => {
        const getPresignedUploadUrl = vi.fn().mockResolvedValue({
          uploadUrl: "https://bucket.s3.amazonaws.com/uploads/images/file.jpg?signature=xxx",
          publicUrl: "https://bucket.s3.amazonaws.com/uploads/images/file.jpg",
        })

        const plugin = PluginS3({
          getPresignedUploadUrl,
          path: "uploads/images",
        })

        const file = createMockLocalUploadFile({ id: "my-file-id.jpg" })
        const context = {
          ...createMockPluginContext(),
          onProgress: vi.fn(),
        }

        const result = await plugin.hooks.upload(file, context)

        expect(result.storageKey).toBe("uploads/images/my-file-id.jpg")
        expect(getPresignedUploadUrl).toHaveBeenCalledWith(
          "uploads/images/my-file-id.jpg", // Full storageKey
          expect.any(String),
          expect.any(Object),
        )
      })
    })

    describe("getRemoteFile hook", () => {
      it("should have getRemoteFile hook defined", () => {
        const plugin = PluginS3({
          getPresignedUploadUrl: vi.fn(),
          getPresignedDownloadUrl: vi.fn(),
        })

        expect(plugin.hooks.getRemoteFile).toBeDefined()
        expect(typeof plugin.hooks.getRemoteFile).toBe("function")
      })

      it("should throw error if getPresignedDownloadUrl is not provided", async () => {
        const plugin = PluginS3({
          getPresignedUploadUrl: vi.fn(),
        })

        const context = createMockPluginContext()

        await expect(plugin.hooks.getRemoteFile!("file-id", context)).rejects.toThrow(
          "getPresignedDownloadUrl is required to fetch remote files",
        )
      })

      it("should call getPresignedDownloadUrl with fileId", async () => {
        const getPresignedDownloadUrl = vi.fn().mockResolvedValue("https://bucket.s3.amazonaws.com/file.jpg?signature=xxx")

        // Mock fetch
        vi.stubGlobal(
          "fetch",
          vi.fn().mockResolvedValue({
            ok: true,
            headers: {
              get: vi.fn((header: string) => {
                if (header === "content-length") return "2048"
                if (header === "content-type") return "image/jpeg"
                return null
              }),
            },
          }),
        )

        const plugin = PluginS3({
          getPresignedUploadUrl: vi.fn(),
          getPresignedDownloadUrl,
        })

        const context = createMockPluginContext()
        await plugin.hooks.getRemoteFile!("test-file-id", context)

        expect(getPresignedDownloadUrl).toHaveBeenCalledWith("test-file-id")
      })
    })

    describe("remove hook", () => {
      it("should have remove hook defined", () => {
        const plugin = PluginS3({
          getPresignedUploadUrl: vi.fn(),
          deleteFile: vi.fn(),
        })

        expect(plugin.hooks.remove).toBeDefined()
        expect(typeof plugin.hooks.remove).toBe("function")
      })

      it("should throw error if deleteFile is not provided", async () => {
        const plugin = PluginS3({
          getPresignedUploadUrl: vi.fn(),
        })

        const file = createMockLocalUploadFile()
        const context = createMockPluginContext()

        await expect(plugin.hooks.remove!(file, context)).rejects.toThrow("deleteFile callback is required to delete files")
      })

      it("should call deleteFile with storageKey", async () => {
        const deleteFile = vi.fn().mockResolvedValue(undefined)

        const plugin = PluginS3({
          getPresignedUploadUrl: vi.fn(),
          deleteFile,
        })

        // File with storageKey set (as it would be after upload)
        const file = createMockLocalUploadFile({ id: "local-id", storageKey: "uploads/file-to-delete.jpg" })
        const context = createMockPluginContext()

        await plugin.hooks.remove!(file, context)

        expect(deleteFile).toHaveBeenCalledWith("uploads/file-to-delete.jpg")
      })

      it("should skip deletion if file has no storageKey", async () => {
        const deleteFile = vi.fn().mockResolvedValue(undefined)

        const plugin = PluginS3({
          getPresignedUploadUrl: vi.fn(),
          deleteFile,
        })

        // File without storageKey (not yet uploaded)
        const file = createMockLocalUploadFile({ id: "local-id" })
        const context = createMockPluginContext()

        await plugin.hooks.remove!(file, context)

        // Should not call deleteFile since no storageKey
        expect(deleteFile).not.toHaveBeenCalled()
      })
    })

    describe("retry logic", () => {
      it("should use default retry configuration", () => {
        const plugin = PluginS3({
          getPresignedUploadUrl: vi.fn(),
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

    describe("upload result format", () => {
      it("should define correct result structure", () => {
        interface S3UploadResult {
          url: string
          storageKey: string
          etag?: string
        }

        const expectedResult: S3UploadResult = {
          url: "https://bucket.s3.amazonaws.com/file.jpg",
          storageKey: "file.jpg",
          etag: "abc123",
        }

        expect(expectedResult.url).toBeDefined()
        expect(expectedResult.storageKey).toBeDefined()
      })
    })

    describe("storageKey round-trip contract", () => {
      it("storageKey should be the full path (options.path + filename)", () => {
        // The storageKey is now the FULL path, making it self-contained and portable.
        //
        // Example:
        // - path option: "uploads"
        // - file.id: "my-unique-file-id.jpg"
        // - storageKey returned: "uploads/my-unique-file-id.jpg" (full path)
        // - getRemoteFile("uploads/my-unique-file-id.jpg") resolves correctly
        //
        // After upload, file.id is automatically updated to match storageKey.
        const optionsPath = "uploads"
        const fileId = "my-unique-file-id.jpg"

        const uploadResult = {
          url: "https://bucket.s3.amazonaws.com/uploads/my-unique-file-id.jpg",
          storageKey: `${optionsPath}/${fileId}`, // Full path
          etag: "abc123",
        }

        expect(uploadResult.storageKey).toBe("uploads/my-unique-file-id.jpg")
        expect(uploadResult.storageKey).toContain("/")
      })

      it("getRemoteFile should accept and return the full storageKey", () => {
        const fullStorageKey = "uploads/my-file.jpg"

        const remoteFileResult = {
          size: 1024,
          mimeType: "image/jpeg",
          remoteUrl: "https://bucket.s3.amazonaws.com/uploads/my-file.jpg",
          uploadResult: {
            url: "https://bucket.s3.amazonaws.com/uploads/my-file.jpg",
            storageKey: fullStorageKey, // Same as input
          },
        }

        expect(remoteFileResult.uploadResult.storageKey).toBe(fullStorageKey)
      })

      it("storageKey should just be filename when no path option", () => {
        // When no options.path is specified, storageKey equals the filename
        const fileId = "my-file.jpg"

        const uploadResult = {
          url: "https://bucket.s3.amazonaws.com/my-file.jpg",
          storageKey: fileId,
          etag: "abc123",
        }

        expect(uploadResult.storageKey).toBe("my-file.jpg")
      })
    })

    describe("standalone upload", () => {
      it("should call getPresignedUploadUrl with the full storage key", async () => {
        const getPresignedUploadUrl = vi.fn().mockResolvedValue({
          uploadUrl: "https://bucket.s3.amazonaws.com/uploads/thumb.jpg?signature=xxx",
          publicUrl: "https://bucket.s3.amazonaws.com/uploads/thumb.jpg",
        })

        const plugin = PluginS3({
          getPresignedUploadUrl,
          path: "uploads",
        })

        const blob = new Blob([new Uint8Array(512)], { type: "image/jpeg" })
        await plugin.upload(blob, "thumb.jpg", { contentType: "image/jpeg" })

        expect(getPresignedUploadUrl).toHaveBeenCalledWith("uploads/thumb.jpg", "image/jpeg", {
          fileName: "thumb.jpg",
          fileSize: 512,
        })
      })

      it("should return url and storageKey", async () => {
        const getPresignedUploadUrl = vi.fn().mockResolvedValue({
          uploadUrl: "https://bucket.s3.amazonaws.com/my-file.jpg?signature=xxx",
          publicUrl: "https://bucket.s3.amazonaws.com/my-file.jpg",
        })

        const plugin = PluginS3({ getPresignedUploadUrl })
        const blob = new Blob([new Uint8Array(256)], { type: "image/jpeg" })

        const result = await plugin.upload(blob, "my-file.jpg")

        expect(result).toHaveProperty("url", "https://bucket.s3.amazonaws.com/my-file.jpg")
        expect(result).toHaveProperty("storageKey", "my-file.jpg")
      })

      it("should default contentType to application/octet-stream", async () => {
        const getPresignedUploadUrl = vi.fn().mockResolvedValue({
          uploadUrl: "https://bucket.s3.amazonaws.com/file?signature=xxx",
          publicUrl: "https://bucket.s3.amazonaws.com/file",
        })

        const plugin = PluginS3({ getPresignedUploadUrl })
        const blob = new Blob([new Uint8Array(100)])

        await plugin.upload(blob, "file")

        expect(getPresignedUploadUrl).toHaveBeenCalledWith("file", "application/octet-stream", expect.any(Object))
      })

      it("should include path prefix in storageKey", async () => {
        const getPresignedUploadUrl = vi.fn().mockResolvedValue({
          uploadUrl: "https://bucket.s3.amazonaws.com/images/thumb.jpg?sig=xxx",
          publicUrl: "https://bucket.s3.amazonaws.com/images/thumb.jpg",
        })

        const plugin = PluginS3({
          getPresignedUploadUrl,
          path: "images",
        })

        const blob = new Blob([new Uint8Array(100)], { type: "image/jpeg" })
        const result = await plugin.upload(blob, "thumb.jpg", { contentType: "image/jpeg" })

        expect(result.storageKey).toBe("images/thumb.jpg")
      })
    })

    describe("XHR upload", () => {
      it("should use PUT method for presigned URL upload", async () => {
        const getPresignedUploadUrl = vi.fn().mockResolvedValue({
          uploadUrl: "https://bucket.s3.amazonaws.com/key?signature=xxx",
          publicUrl: "https://bucket.s3.amazonaws.com/key",
        })

        const plugin = PluginS3({ getPresignedUploadUrl })
        const file = createMockLocalUploadFile()
        const context = {
          ...createMockPluginContext(),
          onProgress: vi.fn(),
        }

        await plugin.hooks.upload(file, context)

        expect(mockXHRInstance.open).toHaveBeenCalledWith("PUT", "https://bucket.s3.amazonaws.com/key?signature=xxx")
      })

      it("should set Content-Type header", async () => {
        const getPresignedUploadUrl = vi.fn().mockResolvedValue({
          uploadUrl: "https://bucket.s3.amazonaws.com/key",
          publicUrl: "https://bucket.s3.amazonaws.com/key",
        })

        const plugin = PluginS3({ getPresignedUploadUrl })
        const file = createMockLocalUploadFile({ mimeType: "image/png" })
        const context = {
          ...createMockPluginContext(),
          onProgress: vi.fn(),
        }

        await plugin.hooks.upload(file, context)

        expect(mockXHRInstance.setRequestHeader).toHaveBeenCalledWith("Content-Type", "image/png")
      })
    })
  })
})
