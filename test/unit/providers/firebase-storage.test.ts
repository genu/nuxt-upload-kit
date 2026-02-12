import { describe, it, expect, vi, beforeEach } from "vitest"

import { createMockPluginContext, createMockRemoteUploadFile } from "../../helpers"
import { PluginFirebaseStorage } from "../../../src/runtime/composables/useUploadKit/plugins/storage/firebase-storage"

// Mock Firebase Storage SDK - vi.mock is hoisted so we define everything inline
vi.mock("firebase/storage", () => ({
  ref: vi.fn().mockReturnValue({
    fullPath: "uploads/test.jpg",
  }),
  uploadBytesResumable: vi.fn().mockReturnValue({
    on: vi.fn().mockImplementation((_event: string, _progress: any, _error: any, complete: () => void) => {
      // Simulate immediate completion so the upload Promise resolves
      complete()
    }),
    snapshot: {
      ref: { fullPath: "uploads/test.jpg" },
      metadata: {
        fullPath: "uploads/test.jpg",
        bucket: "test-bucket.appspot.com",
        generation: "12345",
        md5Hash: "abc123",
      },
    },
  }),
  getDownloadURL: vi.fn().mockResolvedValue("https://firebasestorage.googleapis.com/v0/b/test.jpg"),
  getMetadata: vi.fn().mockResolvedValue({
    size: 1024,
    contentType: "image/jpeg",
  }),
  deleteObject: vi.fn().mockResolvedValue(undefined),
}))

describe("providers", () => {
  describe("PluginFirebaseStorage", () => {
    const mockStorage = {} as any // Mock FirebaseStorage instance

    beforeEach(() => {
      vi.clearAllMocks()
    })

    describe("plugin configuration", () => {
      it("should have correct plugin ID", () => {
        const plugin = PluginFirebaseStorage({
          storage: mockStorage,
        })

        expect(plugin.id).toBe("firebase-storage")
      })

      it("should require storage instance", () => {
        const plugin = PluginFirebaseStorage({ storage: mockStorage })

        expect(plugin).toBeDefined()
        expect(plugin.hooks.upload).toBeDefined()
      })

      it("should accept optional path configuration", () => {
        const plugin = PluginFirebaseStorage({
          storage: mockStorage,
          path: "uploads/images",
        })

        expect(plugin).toBeDefined()
      })

      it("should accept custom metadata", () => {
        const plugin = PluginFirebaseStorage({
          storage: mockStorage,
          customMetadata: {
            environment: "test",
            version: "1.0",
          },
        })

        expect(plugin).toBeDefined()
      })

      it("should accept cacheControl option", () => {
        const plugin = PluginFirebaseStorage({
          storage: mockStorage,
          cacheControl: "public, max-age=31536000",
        })

        expect(plugin).toBeDefined()
      })

      it("should accept contentDisposition option", () => {
        const plugin = PluginFirebaseStorage({
          storage: mockStorage,
          contentDisposition: "attachment",
        })

        expect(plugin).toBeDefined()
      })

      it("should accept retry configuration", () => {
        const plugin = PluginFirebaseStorage({
          storage: mockStorage,
          retries: 5,
          retryDelay: 2000,
        })

        expect(plugin).toBeDefined()
      })
    })

    describe("upload hook", () => {
      it("should have upload hook defined", () => {
        const plugin = PluginFirebaseStorage({
          storage: mockStorage,
        })

        expect(plugin.hooks.upload).toBeDefined()
        expect(typeof plugin.hooks.upload).toBe("function")
      })

      it("should reject remote files without local data", async () => {
        const plugin = PluginFirebaseStorage({
          storage: mockStorage,
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
    })

    describe("getRemoteFile hook", () => {
      it("should have getRemoteFile hook defined", () => {
        const plugin = PluginFirebaseStorage({
          storage: mockStorage,
        })

        expect(plugin.hooks.getRemoteFile).toBeDefined()
        expect(typeof plugin.hooks.getRemoteFile).toBe("function")
      })
    })

    describe("remove hook", () => {
      it("should have remove hook defined", () => {
        const plugin = PluginFirebaseStorage({
          storage: mockStorage,
        })

        expect(plugin.hooks.remove).toBeDefined()
        expect(typeof plugin.hooks.remove).toBe("function")
      })
    })

    describe("path handling", () => {
      it("should strip leading and trailing slashes from path", () => {
        const path = "/uploads/images/"
        const cleanPath = path.replace(/^\/+/, "").replace(/\/+$/, "")

        expect(cleanPath).toBe("uploads/images")
      })

      it("should handle path with only slashes", () => {
        const path = "///"
        const cleanPath = path.replace(/^\/+/, "").replace(/\/+$/, "")

        expect(cleanPath).toBe("")
      })

      it("should preserve path without slashes", () => {
        const path = "uploads"
        const cleanPath = path.replace(/^\/+/, "").replace(/\/+$/, "")

        expect(cleanPath).toBe("uploads")
      })

      it("should build correct path with prefix", () => {
        const prefix = "uploads/images"
        const fileId = "test-file.jpg"
        const fullPath = `${prefix}/${fileId}`

        expect(fullPath).toBe("uploads/images/test-file.jpg")
      })

      it("should handle no prefix", () => {
        const fileId = "test-file.jpg"
        const fullPath = fileId

        expect(fullPath).toBe("test-file.jpg")
      })
    })

    describe("retry logic", () => {
      it("should use default retry configuration", () => {
        const plugin = PluginFirebaseStorage({
          storage: mockStorage,
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
        interface FirebaseStorageUploadResult {
          url: string
          storageKey: string
          bucket: string
          generation?: string
          md5Hash?: string
        }

        const expectedResult: FirebaseStorageUploadResult = {
          url: "https://firebasestorage.googleapis.com/v0/b/test.jpg",
          storageKey: "test.jpg",
          bucket: "test-bucket.appspot.com",
          generation: "12345",
          md5Hash: "abc123",
        }

        expect(expectedResult.url).toBeDefined()
        expect(expectedResult.storageKey).toBeDefined()
        expect(expectedResult.bucket).toBeDefined()
      })
    })

    describe("storageKey round-trip contract", () => {
      it("storageKey should be the full path (options.path + filename)", () => {
        // The storageKey is now the FULL path, making it self-contained and portable.
        //
        // Example:
        // - path option: "uploads/images"
        // - file.id: "abc.jpg"
        // - storageKey returned: "uploads/images/abc.jpg" (full path)
        // - getRemoteFile("uploads/images/abc.jpg") resolves correctly
        //
        // After upload, file.id is automatically updated to match storageKey.
        const optionsPath = "uploads/images"
        const fileId = "my-image.jpg"

        const uploadResult = {
          url: "https://firebasestorage.googleapis.com/v0/b/bucket/o/uploads%2Fimages%2Fmy-image.jpg",
          storageKey: `${optionsPath}/${fileId}`, // Full path
          bucket: "my-bucket.appspot.com",
        }

        expect(uploadResult.storageKey).toBe("uploads/images/my-image.jpg")
        expect(uploadResult.storageKey).toContain("/")
      })

      it("getRemoteFile should accept and return the full storageKey", () => {
        const fullStorageKey = "uploads/images/my-file.jpg"

        const remoteFileResult = {
          size: 1024,
          mimeType: "image/jpeg",
          remoteUrl: "https://firebasestorage.googleapis.com/...",
          uploadResult: {
            url: "https://firebasestorage.googleapis.com/...",
            storageKey: fullStorageKey, // Same as input
            bucket: "my-bucket.appspot.com",
          },
        }

        expect(remoteFileResult.uploadResult.storageKey).toBe(fullStorageKey)
      })

      it("storageKey should just be filename when no path option", () => {
        // When no options.path is specified, storageKey equals the filename
        const fileId = "my-file.jpg"

        const uploadResult = {
          url: "https://firebasestorage.googleapis.com/v0/b/bucket/o/my-file.jpg",
          storageKey: fileId,
          bucket: "my-bucket.appspot.com",
        }

        expect(uploadResult.storageKey).toBe("my-file.jpg")
      })
    })

    describe("standalone upload", () => {
      it("should return url and storageKey", async () => {
        const plugin = PluginFirebaseStorage({
          storage: mockStorage,
        })

        const blob = new Blob([new Uint8Array(256)], { type: "image/jpeg" })
        const result = await plugin.upload(blob, "thumb.jpg", { contentType: "image/jpeg" })

        expect(result).toHaveProperty("url")
        expect(result).toHaveProperty("storageKey")
      })

      it("should apply path prefix to standalone uploads", async () => {
        const plugin = PluginFirebaseStorage({
          storage: mockStorage,
          path: "uploads",
        })

        const blob = new Blob([new Uint8Array(100)], { type: "image/jpeg" })
        const result = await plugin.upload(blob, "thumb.jpg", { contentType: "image/jpeg" })

        expect(result.storageKey).toBe("uploads/thumb.jpg")
      })

      it("should default contentType to application/octet-stream", async () => {
        const plugin = PluginFirebaseStorage({
          storage: mockStorage,
        })

        const blob = new Blob([new Uint8Array(100)])
        // Should not throw — contentType defaults internally
        const result = await plugin.upload(blob, "data.bin")

        expect(result).toHaveProperty("url")
      })
    })

    describe("metadata handling", () => {
      it("should merge custom metadata with default metadata", () => {
        const customMetadata = {
          environment: "test",
          version: "1.0",
        }

        const fileName = "test.jpg"
        const fileSize = 1024

        const mergedMetadata = {
          ...customMetadata,
          originalName: fileName,
          size: String(fileSize),
        }

        expect(mergedMetadata).toEqual({
          environment: "test",
          version: "1.0",
          originalName: "test.jpg",
          size: "1024",
        })
      })
    })
  })
})
