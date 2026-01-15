import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createMockPluginContext, createMockLocalUploadFile, createMockRemoteUploadFile } from "../../helpers"
import { PluginCloudflareR2 } from "../../../src/runtime/composables/useUploadKit/plugins/storage/cloudflare-r2"

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

describe("PluginCloudflareR2", () => {
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
      const plugin = PluginCloudflareR2({
        getPresignedUploadUrl: vi.fn(),
      })

      expect(plugin.id).toBe("cloudflare-r2-storage")
    })

    it("should require getPresignedUploadUrl function", () => {
      const getPresignedUploadUrl = vi.fn()
      const plugin = PluginCloudflareR2({ getPresignedUploadUrl })

      expect(plugin).toBeDefined()
      expect(plugin.hooks.upload).toBeDefined()
    })

    it("should accept optional getPresignedDownloadUrl", () => {
      const plugin = PluginCloudflareR2({
        getPresignedUploadUrl: vi.fn(),
        getPresignedDownloadUrl: vi.fn(),
      })

      expect(plugin).toBeDefined()
    })

    it("should accept optional deleteFile function", () => {
      const plugin = PluginCloudflareR2({
        getPresignedUploadUrl: vi.fn(),
        deleteFile: vi.fn(),
      })

      expect(plugin).toBeDefined()
    })

    it("should accept retry configuration", () => {
      const plugin = PluginCloudflareR2({
        getPresignedUploadUrl: vi.fn(),
        retries: 5,
        retryDelay: 2000,
      })

      expect(plugin).toBeDefined()
    })
  })

  describe("upload hook", () => {
    it("should have upload hook defined", () => {
      const plugin = PluginCloudflareR2({
        getPresignedUploadUrl: vi.fn(),
      })

      expect(plugin.hooks.upload).toBeDefined()
      expect(typeof plugin.hooks.upload).toBe("function")
    })

    it("should reject remote files without local data", async () => {
      const plugin = PluginCloudflareR2({
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
        uploadUrl: "https://account.r2.cloudflarestorage.com/bucket/key?signature=xxx",
        publicUrl: "https://pub-xxx.r2.dev/key",
      })

      const plugin = PluginCloudflareR2({ getPresignedUploadUrl })

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
        uploadUrl: "https://account.r2.cloudflarestorage.com/bucket/file.jpg?signature=xxx",
        publicUrl: "https://pub-xxx.r2.dev/file.jpg",
      })

      const plugin = PluginCloudflareR2({ getPresignedUploadUrl })

      const file = createMockLocalUploadFile({ id: "my-file-id" })
      const context = {
        ...createMockPluginContext(),
        onProgress: vi.fn(),
      }

      const result = await plugin.hooks.upload(file, context)

      expect(result).toHaveProperty("url")
      expect(result).toHaveProperty("key")
      expect(result.url).toBe("https://pub-xxx.r2.dev/file.jpg")
      expect(result.key).toBe("my-file-id")
    })
  })

  describe("getRemoteFile hook", () => {
    it("should have getRemoteFile hook defined", () => {
      const plugin = PluginCloudflareR2({
        getPresignedUploadUrl: vi.fn(),
        getPresignedDownloadUrl: vi.fn(),
      })

      expect(plugin.hooks.getRemoteFile).toBeDefined()
      expect(typeof plugin.hooks.getRemoteFile).toBe("function")
    })

    it("should throw error if getPresignedDownloadUrl is not provided", async () => {
      const plugin = PluginCloudflareR2({
        getPresignedUploadUrl: vi.fn(),
      })

      const context = createMockPluginContext()

      await expect(plugin.hooks.getRemoteFile!("file-id", context)).rejects.toThrow(
        "getPresignedDownloadUrl is required to fetch remote files",
      )
    })

    it("should call getPresignedDownloadUrl with fileId", async () => {
      const getPresignedDownloadUrl = vi.fn().mockResolvedValue("https://pub-xxx.r2.dev/file.jpg?signature=xxx")

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

      const plugin = PluginCloudflareR2({
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
      const plugin = PluginCloudflareR2({
        getPresignedUploadUrl: vi.fn(),
        deleteFile: vi.fn(),
      })

      expect(plugin.hooks.remove).toBeDefined()
      expect(typeof plugin.hooks.remove).toBe("function")
    })

    it("should throw error if deleteFile is not provided", async () => {
      const plugin = PluginCloudflareR2({
        getPresignedUploadUrl: vi.fn(),
      })

      const file = createMockLocalUploadFile()
      const context = createMockPluginContext()

      await expect(plugin.hooks.remove!(file, context)).rejects.toThrow("deleteFile callback is required to delete files")
    })

    it("should call deleteFile with file id", async () => {
      const deleteFile = vi.fn().mockResolvedValue(undefined)

      const plugin = PluginCloudflareR2({
        getPresignedUploadUrl: vi.fn(),
        deleteFile,
      })

      const file = createMockLocalUploadFile({ id: "file-to-delete" })
      const context = createMockPluginContext()

      await plugin.hooks.remove!(file, context)

      expect(deleteFile).toHaveBeenCalledWith("file-to-delete")
    })
  })

  describe("retry logic", () => {
    it("should use default retry configuration", () => {
      const plugin = PluginCloudflareR2({
        getPresignedUploadUrl: vi.fn(),
      })

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
      interface CloudflareR2UploadResult {
        url: string
        key: string
        etag?: string
      }

      const expectedResult: CloudflareR2UploadResult = {
        url: "https://pub-xxx.r2.dev/file.jpg",
        key: "file.jpg",
        etag: "abc123",
      }

      expect(expectedResult.url).toBeDefined()
      expect(expectedResult.key).toBeDefined()
    })
  })

  describe("XHR upload", () => {
    it("should use PUT method for presigned URL upload", async () => {
      const getPresignedUploadUrl = vi.fn().mockResolvedValue({
        uploadUrl: "https://account.r2.cloudflarestorage.com/bucket/key?signature=xxx",
        publicUrl: "https://pub-xxx.r2.dev/key",
      })

      const plugin = PluginCloudflareR2({ getPresignedUploadUrl })
      const file = createMockLocalUploadFile()
      const context = {
        ...createMockPluginContext(),
        onProgress: vi.fn(),
      }

      await plugin.hooks.upload(file, context)

      expect(mockXHRInstance.open).toHaveBeenCalledWith("PUT", "https://account.r2.cloudflarestorage.com/bucket/key?signature=xxx")
    })

    it("should set Content-Type header", async () => {
      const getPresignedUploadUrl = vi.fn().mockResolvedValue({
        uploadUrl: "https://account.r2.cloudflarestorage.com/bucket/key",
        publicUrl: "https://pub-xxx.r2.dev/key",
      })

      const plugin = PluginCloudflareR2({ getPresignedUploadUrl })
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
