import { describe, it, expect, vi, beforeEach } from "vitest"
import { ref } from "vue"
import { createMockFile, wait } from "../helpers"
import type { StoragePlugin } from "../../src/runtime/composables/useUploadKit/types"

// Mock Vue's onBeforeUnmount since we're not in a component context
vi.mock("vue", async () => {
  const actual = await vi.importActual("vue")
  return {
    ...actual,
    onBeforeUnmount: vi.fn(),
  }
})

describe("useUploadKit", () => {
  // Import dynamically to ensure fresh module state for each test
  let useUploadKit: typeof import("../../src/runtime/composables/useUploadKit").useUploadKit

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    // Re-import to get fresh module state
    const module = await import("../../src/runtime/composables/useUploadKit")
    useUploadKit = module.useUploadKit
  })

  /**
   * Helper to wait for upload:complete event (event-based, more deterministic than wait())
   */
  const waitForUploadComplete = (uploader: ReturnType<typeof useUploadKit>, timeout = 1000) => {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timeout waiting for upload:complete")), timeout)
      uploader.on("upload:complete", () => {
        clearTimeout(timer)
        resolve()
      })
    })
  }

  describe("initialization", () => {
    it("should initialize with default options", () => {
      const uploader = useUploadKit()

      expect(uploader.files.value).toEqual([])
      expect(uploader.totalProgress.value).toBe(0)
      expect(uploader.status.value).toBe("waiting")
    })

    it("should initialize with custom options", () => {
      const uploader = useUploadKit({
        maxFiles: 5,
        maxFileSize: 1024 * 1024,
        allowedFileTypes: ["image/jpeg", "image/png"],
        autoUpload: true,
      })

      expect(uploader.files.value).toEqual([])
    })
  })

  describe("addFile", () => {
    it("should add a valid file successfully", async () => {
      const uploader = useUploadKit()
      const file = createMockFile("test.jpg", 1024, "image/jpeg")

      await uploader.addFile(file)

      expect(uploader.files.value).toHaveLength(1)
      expect(uploader.files.value[0]!.name).toBe("test.jpg")
      expect(uploader.files.value[0]!.size).toBe(1024)
      expect(uploader.files.value[0]!.mimeType).toBe("image/jpeg")
      expect(uploader.files.value[0]!.status).toBe("waiting")
    })

    it("should generate unique IDs for files", async () => {
      const uploader = useUploadKit()
      const file1 = createMockFile("test1.jpg")
      const file2 = createMockFile("test2.jpg")

      await uploader.addFile(file1)
      await uploader.addFile(file2)

      expect(uploader.files.value[0]!.id).not.toBe(uploader.files.value[1]!.id)
    })

    it("should preserve file extension in ID", async () => {
      const uploader = useUploadKit()
      const file = createMockFile("test.png", 1024, "image/png")

      await uploader.addFile(file)

      expect(uploader.files.value[0]!.id).toMatch(/\.png$/)
    })

    it("should throw error for files without extension", async () => {
      const uploader = useUploadKit()
      const content = new Uint8Array(1024).fill(65)
      const blob = new Blob([content], { type: "image/jpeg" })
      const file = new File([blob], "noextension", { type: "image/jpeg" })

      await expect(uploader.addFile(file)).rejects.toThrow("Invalid file name")
    })

    it("should emit file:added event when file is added", async () => {
      const uploader = useUploadKit()
      const file = createMockFile("test.jpg")
      const handler = vi.fn()

      uploader.on("file:added", handler)
      await uploader.addFile(file)

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ name: "test.jpg" }))
    })
  })

  describe("addFiles", () => {
    it("should add multiple files at once", async () => {
      const uploader = useUploadKit()
      const files = [createMockFile("test1.jpg"), createMockFile("test2.jpg"), createMockFile("test3.jpg")]

      const added = await uploader.addFiles(files)

      expect(added).toHaveLength(3)
      expect(uploader.files.value).toHaveLength(3)
    })

    it("should continue adding files even if some fail validation", async () => {
      const uploader = useUploadKit({
        maxFileSize: 500,
      })

      const files = [
        createMockFile("small.jpg", 100),
        createMockFile("large.jpg", 1000), // Should fail
        createMockFile("small2.jpg", 200),
      ]

      const added = await uploader.addFiles(files)

      expect(added).toHaveLength(2)
      // Files with errors are also added but with error status
      expect(uploader.files.value).toHaveLength(3)
    })
  })

  describe("removeFile", () => {
    it("should remove a file by ID", async () => {
      const uploader = useUploadKit()
      const file = createMockFile("test.jpg")

      await uploader.addFile(file)
      const fileId = uploader.files.value[0]!.id

      await uploader.removeFile(fileId)

      expect(uploader.files.value).toHaveLength(0)
    })

    it("should emit file:removed event", async () => {
      const uploader = useUploadKit()
      const file = createMockFile("test.jpg")
      const handler = vi.fn()

      await uploader.addFile(file)
      const fileId = uploader.files.value[0]!.id

      uploader.on("file:removed", handler)
      await uploader.removeFile(fileId)

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ name: "test.jpg" }))
    })

    it("should do nothing if file ID does not exist", async () => {
      const uploader = useUploadKit()
      const file = createMockFile("test.jpg")

      await uploader.addFile(file)
      await uploader.removeFile("non-existent-id")

      expect(uploader.files.value).toHaveLength(1)
    })

    it("should call storage plugin remove hook by default for files with remoteUrl", async () => {
      const removeHook = vi.fn()
      const storagePlugin: StoragePlugin = {
        id: "test-storage",
        hooks: {
          upload: vi.fn(),
          remove: removeHook,
          getRemoteFile: vi.fn().mockResolvedValue({
            size: 1024,
            mimeType: "image/jpeg",
            remoteUrl: "https://storage.example.com/remote-1.jpg",
          }),
        },
      }

      const uploader = useUploadKit({ storage: storagePlugin })

      // Add a remote file using initializeExistingFiles
      await uploader.initializeExistingFiles([{ id: "remote-1" }])

      expect(uploader.files.value).toHaveLength(1)
      expect(uploader.files.value[0]!.remoteUrl).toBe("https://storage.example.com/remote-1.jpg")

      await uploader.removeFile("remote-1")

      expect(removeHook).toHaveBeenCalledTimes(1)
      expect(removeHook).toHaveBeenCalledWith(expect.objectContaining({ id: "remote-1" }), expect.any(Object))
      expect(uploader.files.value).toHaveLength(0)
    })

    it("should skip storage plugin remove hook when deleteFromStorage is false", async () => {
      const removeHook = vi.fn()
      const storagePlugin: StoragePlugin = {
        id: "test-storage",
        hooks: {
          upload: vi.fn(),
          remove: removeHook,
          getRemoteFile: vi.fn().mockResolvedValue({
            size: 1024,
            mimeType: "image/jpeg",
            remoteUrl: "https://storage.example.com/remote-1.jpg",
          }),
        },
      }

      const uploader = useUploadKit({ storage: storagePlugin })

      // Add a remote file using initializeExistingFiles
      await uploader.initializeExistingFiles([{ id: "remote-1" }])

      await uploader.removeFile("remote-1", { deleteFromStorage: false })

      expect(removeHook).not.toHaveBeenCalled()
      expect(uploader.files.value).toHaveLength(0)
    })

    it("should not call storage plugin remove hook for files without remoteUrl", async () => {
      const removeHook = vi.fn()
      const storagePlugin: StoragePlugin = {
        id: "test-storage",
        hooks: {
          upload: vi.fn(),
          remove: removeHook,
        },
      }

      const uploader = useUploadKit({ storage: storagePlugin })
      await uploader.addFile(createMockFile("local.jpg"))
      const fileId = uploader.files.value[0]!.id

      await uploader.removeFile(fileId)

      // Should not call remove hook since file doesn't have remoteUrl yet
      expect(removeHook).not.toHaveBeenCalled()
      expect(uploader.files.value).toHaveLength(0)
    })
  })

  describe("removeFiles", () => {
    it("should remove multiple files by IDs", async () => {
      const uploader = useUploadKit()
      await uploader.addFile(createMockFile("test1.jpg"))
      await uploader.addFile(createMockFile("test2.jpg"))
      await uploader.addFile(createMockFile("test3.jpg"))

      const idsToRemove = [uploader.files.value[0]!.id, uploader.files.value[2]!.id]
      uploader.removeFiles(idsToRemove)

      expect(uploader.files.value).toHaveLength(1)
      expect(uploader.files.value[0]!.name).toBe("test2.jpg")
    })

    it("should emit file:removed for each removed file", async () => {
      const uploader = useUploadKit()
      const handler = vi.fn()

      await uploader.addFile(createMockFile("test1.jpg"))
      await uploader.addFile(createMockFile("test2.jpg"))

      uploader.on("file:removed", handler)
      uploader.removeFiles([uploader.files.value[0]!.id, uploader.files.value[1]!.id])

      expect(handler).toHaveBeenCalledTimes(2)
    })
  })

  describe("clearFiles", () => {
    it("should remove all files", async () => {
      const uploader = useUploadKit()

      await uploader.addFile(createMockFile("test1.jpg"))
      await uploader.addFile(createMockFile("test2.jpg"))

      const cleared = uploader.clearFiles()

      expect(uploader.files.value).toHaveLength(0)
      expect(cleared).toHaveLength(2)
    })

    it("should emit file:removed for each cleared file", async () => {
      const uploader = useUploadKit()
      const handler = vi.fn()

      await uploader.addFile(createMockFile("test1.jpg"))
      await uploader.addFile(createMockFile("test2.jpg"))

      uploader.on("file:removed", handler)
      uploader.clearFiles()

      expect(handler).toHaveBeenCalledTimes(2)
    })
  })

  describe("getFile", () => {
    it("should return file by ID", async () => {
      const uploader = useUploadKit()
      await uploader.addFile(createMockFile("test.jpg"))

      const file = uploader.getFile(uploader.files.value[0]!.id)

      expect(file.name).toBe("test.jpg")
    })

    it("should throw error if file not found", async () => {
      const uploader = useUploadKit()

      expect(() => uploader.getFile("non-existent")).toThrow("File not found: non-existent")
    })
  })

  describe("reorderFile", () => {
    it("should reorder files correctly", async () => {
      const uploader = useUploadKit()

      await uploader.addFile(createMockFile("test1.jpg"))
      await uploader.addFile(createMockFile("test2.jpg"))
      await uploader.addFile(createMockFile("test3.jpg"))

      uploader.reorderFile(0, 2)

      expect(uploader.files.value[0]!.name).toBe("test2.jpg")
      expect(uploader.files.value[1]!.name).toBe("test3.jpg")
      expect(uploader.files.value[2]!.name).toBe("test1.jpg")
    })

    it("should emit files:reorder event", async () => {
      const uploader = useUploadKit()
      const handler = vi.fn()

      await uploader.addFile(createMockFile("test1.jpg"))
      await uploader.addFile(createMockFile("test2.jpg"))

      uploader.on("files:reorder", handler)
      uploader.reorderFile(0, 1)

      expect(handler).toHaveBeenCalledWith({ oldIndex: 0, newIndex: 1 })
    })

    it("should not reorder if indices are the same", async () => {
      const uploader = useUploadKit()
      const handler = vi.fn()

      await uploader.addFile(createMockFile("test1.jpg"))
      await uploader.addFile(createMockFile("test2.jpg"))

      uploader.on("files:reorder", handler)
      uploader.reorderFile(0, 0)

      expect(handler).not.toHaveBeenCalled()
    })

    it("should not reorder if indices are out of bounds", async () => {
      const uploader = useUploadKit()
      const handler = vi.fn()

      await uploader.addFile(createMockFile("test1.jpg"))

      uploader.on("files:reorder", handler)
      uploader.reorderFile(-1, 5)

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe("updateFile", () => {
    it("should update file properties", async () => {
      const uploader = useUploadKit()
      await uploader.addFile(createMockFile("test.jpg"))

      const fileId = uploader.files.value[0]!.id
      uploader.updateFile(fileId, { status: "uploading", progress: { percentage: 50 } })

      expect(uploader.files.value[0]!.status).toBe("uploading")
      expect(uploader.files.value[0]!.progress.percentage).toBe(50)
    })
  })

  describe("upload", () => {
    it("should upload files with custom upload function", async () => {
      const uploader = useUploadKit()
      const uploadFn = vi.fn().mockResolvedValue({ url: "https://example.com/file.jpg" })

      uploader.onUpload(uploadFn)
      await uploader.addFile(createMockFile("test.jpg"))
      await uploader.upload()

      expect(uploadFn).toHaveBeenCalledTimes(1)
      expect(uploader.files.value[0]!.status).toBe("complete")
    })

    it("should emit upload:start and upload:complete events", async () => {
      const uploader = useUploadKit()
      const startHandler = vi.fn()
      const completeHandler = vi.fn()

      uploader.onUpload(vi.fn().mockResolvedValue({ url: "https://example.com/file.jpg" }))
      uploader.on("upload:start", startHandler)
      uploader.on("upload:complete", completeHandler)

      await uploader.addFile(createMockFile("test.jpg"))
      await uploader.upload()

      expect(startHandler).toHaveBeenCalledTimes(1)
      expect(completeHandler).toHaveBeenCalledTimes(1)
    })

    it("should only upload files with 'waiting' status", async () => {
      const uploader = useUploadKit()
      const uploadFn = vi.fn().mockResolvedValue({ url: "https://example.com/file.jpg" })

      uploader.onUpload(uploadFn)
      await uploader.addFile(createMockFile("test.jpg"))
      await uploader.upload() // First upload
      await uploader.upload() // Second upload - should not upload again

      expect(uploadFn).toHaveBeenCalledTimes(1)
    })

    it("should handle upload errors gracefully", async () => {
      const uploader = useUploadKit()
      const errorHandler = vi.fn()
      const uploadError = new Error("Upload failed")

      uploader.onUpload(vi.fn().mockRejectedValue(uploadError))
      uploader.on("file:error", errorHandler)

      await uploader.addFile(createMockFile("test.jpg"))
      await uploader.upload()

      expect(errorHandler).toHaveBeenCalledTimes(1)
      expect(uploader.files.value[0]!.status).toBe("error")
      expect(uploader.files.value[0]!.error?.message).toBe("Upload failed")
    })

    it("should call progress callback during upload", async () => {
      const uploader = useUploadKit()
      const progressHandler = vi.fn()

      uploader.onUpload(async (file, onProgress) => {
        onProgress(25)
        onProgress(50)
        onProgress(75)
        onProgress(100)
        return { url: "https://example.com/file.jpg" }
      })

      uploader.on("upload:progress", progressHandler)
      await uploader.addFile(createMockFile("test.jpg"))
      await uploader.upload()

      expect(progressHandler).toHaveBeenCalledTimes(4)
    })

    it("should throw error if no upload function configured", async () => {
      const uploader = useUploadKit()

      await uploader.addFile(createMockFile("test.jpg"))
      await uploader.upload()

      expect(uploader.files.value[0]!.status).toBe("error")
      expect(uploader.files.value[0]!.error?.message).toContain("No uploader configured")
    })
  })

  describe("totalProgress", () => {
    it("should calculate total progress correctly", async () => {
      const uploader = useUploadKit()
      const progressCallbacks: ((p: number) => void)[] = []

      uploader.onUpload(async (file, onProgress) => {
        progressCallbacks.push(onProgress)
        return { url: "https://example.com/file.jpg" }
      })

      await uploader.addFile(createMockFile("test1.jpg"))
      await uploader.addFile(createMockFile("test2.jpg"))

      expect(uploader.totalProgress.value).toBe(0)
    })

    it("should return 0 when no files", () => {
      const uploader = useUploadKit()

      expect(uploader.totalProgress.value).toBe(0)
    })
  })

  describe("reset", () => {
    it("should clear all files and state", async () => {
      const uploader = useUploadKit()

      await uploader.addFile(createMockFile("test.jpg"))
      uploader.reset()

      expect(uploader.files.value).toHaveLength(0)
    })
  })

  describe("getFileData", () => {
    it("should return blob data for local files", async () => {
      const uploader = useUploadKit()
      const mockFile = createMockFile("test.jpg", 1024, "image/jpeg")

      await uploader.addFile(mockFile)
      const fileId = uploader.files.value[0]!.id

      const blob = await uploader.getFileData(fileId)

      expect(blob).toBeInstanceOf(Blob)
    })

    it("should throw error for non-existent file", async () => {
      const uploader = useUploadKit()

      await expect(uploader.getFileData("non-existent")).rejects.toThrow("File not found")
    })
  })

  describe("getFileURL", () => {
    it("should create object URL for local files", async () => {
      const uploader = useUploadKit()
      const mockFile = createMockFile("test.jpg")

      await uploader.addFile(mockFile)
      const fileId = uploader.files.value[0]!.id

      const url = await uploader.getFileURL(fileId)

      expect(url).toMatch(/^blob:/)
    })

    it("should reuse existing object URL", async () => {
      const uploader = useUploadKit()
      const mockFile = createMockFile("test.jpg")

      await uploader.addFile(mockFile)
      const fileId = uploader.files.value[0]!.id

      const url1 = await uploader.getFileURL(fileId)
      const url2 = await uploader.getFileURL(fileId)

      expect(url1).toBe(url2)
    })
  })

  describe("replaceFileData", () => {
    it("should replace file data with new blob", async () => {
      const uploader = useUploadKit()
      const originalFile = createMockFile("test.jpg", 1000, "image/jpeg")

      await uploader.addFile(originalFile)
      const fileId = uploader.files.value[0]!.id

      const newBlob = new Blob([new Uint8Array(500).fill(66)], { type: "image/jpeg" })
      await uploader.replaceFileData(fileId, newBlob, "new-test.jpg")

      expect(uploader.files.value[0]!.name).toBe("new-test.jpg")
      expect(uploader.files.value[0]!.size).toBe(500)
      expect(uploader.files.value[0]!.status).toBe("waiting")
    })

    it("should emit file:replaced event", async () => {
      const uploader = useUploadKit()
      const handler = vi.fn()
      const originalFile = createMockFile("test.jpg")

      await uploader.addFile(originalFile)
      const fileId = uploader.files.value[0]!.id

      uploader.on("file:replaced", handler)
      await uploader.replaceFileData(fileId, new Blob(["new"]), "new.jpg")

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it("should auto-upload if autoUpload is enabled and shouldAutoUpload is undefined", async () => {
      const uploadFn = vi.fn().mockResolvedValue({ url: "https://example.com/file.jpg" })
      const uploader = useUploadKit({ autoUpload: true })
      uploader.onUpload(uploadFn)

      // Set up listener before action that triggers upload
      const firstUpload = waitForUploadComplete(uploader)
      await uploader.addFile(createMockFile("test.jpg"))
      await firstUpload
      uploadFn.mockClear()

      // Set up listener before replaceFileData triggers another upload
      const secondUpload = waitForUploadComplete(uploader)
      const fileId = uploader.files.value[0]!.id
      await uploader.replaceFileData(fileId, new Blob(["new"]), "new.jpg")
      await secondUpload

      expect(uploadFn).toHaveBeenCalled()
    })
  })

  describe("initializeExistingFiles", () => {
    it("should initialize files from remote storage", async () => {
      const uploader = useUploadKit()

      uploader.onGetRemoteFile(async (fileId) => ({
        size: 2048,
        mimeType: "image/png",
        remoteUrl: `https://storage.example.com/${fileId}`,
      }))

      await uploader.initializeExistingFiles([{ id: "remote-1.png" }, { id: "remote-2.png" }])

      expect(uploader.files.value).toHaveLength(2)
      expect(uploader.files.value[0]!.source).toBe("storage")
      expect(uploader.files.value[0]!.status).toBe("complete")
      expect(uploader.files.value[0]!.remoteUrl).toBe("https://storage.example.com/remote-1.png")
    })

    it("should skip files without ID", async () => {
      const uploader = useUploadKit()

      uploader.onGetRemoteFile(async (fileId) => ({
        size: 2048,
        mimeType: "image/png",
        remoteUrl: `https://storage.example.com/${fileId}`,
      }))

      await uploader.initializeExistingFiles([
        { id: "valid.png" },
        { id: "" }, // Empty ID
        {}, // No ID
      ])

      expect(uploader.files.value).toHaveLength(1)
    })
  })

  describe("event system", () => {
    it("should allow registering and receiving events", async () => {
      const uploader = useUploadKit()
      const handler = vi.fn()

      uploader.on("file:added", handler)
      await uploader.addFile(createMockFile("test.jpg"))

      expect(handler).toHaveBeenCalled()
    })

    it("should pass correct payload to event handlers", async () => {
      const uploader = useUploadKit()
      const handler = vi.fn()

      uploader.on("file:added", handler)
      await uploader.addFile(createMockFile("test.jpg", 1234, "image/jpeg"))

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "test.jpg",
          size: 1234,
          mimeType: "image/jpeg",
        }),
      )
    })
  })

  describe("addPlugin", () => {
    it("should allow adding plugins dynamically", async () => {
      const uploader = useUploadKit()
      const validateFn = vi.fn().mockImplementation((file) => file)

      uploader.addPlugin({
        id: "custom-plugin",
        hooks: {
          validate: validateFn,
        },
      })

      await uploader.addFile(createMockFile("test.jpg"))

      expect(validateFn).toHaveBeenCalled()
    })
  })

  describe("autoUpload option", () => {
    it("should auto-upload when autoUpload is true", async () => {
      const uploadFn = vi.fn().mockResolvedValue({ url: "https://example.com/file.jpg" })
      const uploader = useUploadKit({ autoUpload: true })

      uploader.onUpload(uploadFn)
      const uploadComplete = waitForUploadComplete(uploader)
      await uploader.addFile(createMockFile("test.jpg"))
      await uploadComplete

      expect(uploadFn).toHaveBeenCalled()
    })

    it("should not auto-upload when autoUpload is false", async () => {
      const uploadFn = vi.fn().mockResolvedValue({ url: "https://example.com/file.jpg" })
      const uploader = useUploadKit({ autoUpload: false })

      uploader.onUpload(uploadFn)
      await uploader.addFile(createMockFile("test.jpg"))

      // No event to wait for - upload should NOT happen (negative test)
      await wait(10)

      expect(uploadFn).not.toHaveBeenCalled()
    })
  })

  describe("initialFiles option", () => {
    // Helper to create a mock storage plugin with getRemoteFile
    const createMockStoragePlugin = (getRemoteFileFn?: (fileId: string) => Promise<any>) => ({
      id: "mock-storage",
      hooks: {
        upload: vi.fn().mockResolvedValue({ url: "https://example.com/uploaded.jpg" }),
        getRemoteFile:
          getRemoteFileFn ||
          (async (fileId: string) => ({
            size: 1024,
            mimeType: "image/jpeg",
            remoteUrl: `https://storage.example.com/${fileId}`,
          })),
      },
    })

    /**
     * Helper to wait for initialFiles to load (event-based, more deterministic than wait())
     */
    const waitForInitialFiles = (
      uploader: ReturnType<typeof useUploadKit>,
      options: { expectError?: boolean; timeout?: number } = {},
    ) => {
      const { expectError = false, timeout = 1000 } = options
      return new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Timeout waiting for initialFiles")), timeout)
        if (expectError) {
          uploader.on("initialFiles:error", () => {
            clearTimeout(timer)
            resolve()
          })
        } else {
          uploader.on("initialFiles:loaded", () => {
            clearTimeout(timer)
            resolve()
          })
        }
      })
    }

    it("should be ready immediately when no initialFiles provided", () => {
      const uploader = useUploadKit()

      expect(uploader.isReady.value).toBe(true)
    })

    it("should not be ready initially when initialFiles is provided", () => {
      const uploader = useUploadKit({
        initialFiles: ["file1.jpg"],
        storage: createMockStoragePlugin(),
      })

      expect(uploader.isReady.value).toBe(false)
    })

    it("should initialize files from static array and set isReady", async () => {
      const uploader = useUploadKit({
        initialFiles: ["file1.jpg", "file2.png"],
        storage: createMockStoragePlugin(async (fileId) => ({
          size: 2048,
          mimeType: fileId.endsWith(".png") ? "image/png" : "image/jpeg",
          remoteUrl: `https://storage.example.com/${fileId}`,
        })),
      })

      await waitForInitialFiles(uploader)

      expect(uploader.isReady.value).toBe(true)
      expect(uploader.files.value).toHaveLength(2)
      expect(uploader.files.value[0]!.id).toBe("file1.jpg")
      expect(uploader.files.value[1]!.id).toBe("file2.png")
    })

    it("should initialize from single string value", async () => {
      const uploader = useUploadKit({
        initialFiles: "single-file.jpg",
        storage: createMockStoragePlugin(),
      })

      await waitForInitialFiles(uploader)

      expect(uploader.isReady.value).toBe(true)
      expect(uploader.files.value).toHaveLength(1)
      expect(uploader.files.value[0]!.id).toBe("single-file.jpg")
    })

    it("should initialize from reactive ref when value becomes available", async () => {
      const filesRef = ref<string[] | undefined>(undefined)
      const uploader = useUploadKit({
        initialFiles: filesRef,
        storage: createMockStoragePlugin(),
      })

      // Initially not ready (waiting for ref value)
      expect(uploader.isReady.value).toBe(false)
      expect(uploader.files.value).toHaveLength(0)

      // Set the ref value
      filesRef.value = ["deferred-file.jpg"]
      await waitForInitialFiles(uploader)

      expect(uploader.isReady.value).toBe(true)
      expect(uploader.files.value).toHaveLength(1)
      expect(uploader.files.value[0]!.id).toBe("deferred-file.jpg")
    })

    it("should emit initialFiles:loaded event on success", async () => {
      const loadedHandler = vi.fn()
      const uploader = useUploadKit({
        initialFiles: ["file1.jpg"],
        storage: createMockStoragePlugin(),
      })

      uploader.on("initialFiles:loaded", loadedHandler)
      await waitForInitialFiles(uploader)

      expect(loadedHandler).toHaveBeenCalledTimes(1)
      expect(loadedHandler).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ id: "file1.jpg" })]))
    })

    it("should emit initialFiles:error event on failure and still set isReady", async () => {
      const errorHandler = vi.fn()
      const uploader = useUploadKit({
        initialFiles: ["file1.jpg"],
        storage: createMockStoragePlugin(async () => {
          throw new Error("Storage unavailable")
        }),
      })

      uploader.on("initialFiles:error", errorHandler)
      await waitForInitialFiles(uploader, { expectError: true })

      expect(errorHandler).toHaveBeenCalledTimes(1)
      expect(uploader.isReady.value).toBe(true) // Should still be ready so UI isn't stuck
    })

    it("should only initialize once even if ref changes multiple times", async () => {
      const filesRef = ref<string[] | undefined>(undefined)
      const getRemoteFileFn = vi.fn().mockImplementation(async (fileId: string) => ({
        size: 1024,
        mimeType: "image/jpeg",
        remoteUrl: `https://storage.example.com/${fileId}`,
      }))

      const uploader = useUploadKit({
        initialFiles: filesRef,
        storage: createMockStoragePlugin(getRemoteFileFn),
      })

      // Set initial value after setup
      filesRef.value = ["file1.jpg"]
      await waitForInitialFiles(uploader)

      expect(uploader.files.value).toHaveLength(1)

      // Change the ref - should NOT re-initialize (no event fires, use wait)
      filesRef.value = ["file2.jpg", "file3.jpg"]
      await wait(10)

      // Should still have only the original file
      expect(uploader.files.value).toHaveLength(1)
      expect(uploader.files.value[0]!.id).toBe("file1.jpg")
      expect(getRemoteFileFn).toHaveBeenCalledTimes(1)
    })

    it("should set isReady immediately if initialFiles is empty array", async () => {
      const uploader = useUploadKit({
        initialFiles: [],
      })

      // No event fires for empty array - isReady is set synchronously
      await wait(10)

      expect(uploader.isReady.value).toBe(true)
      expect(uploader.files.value).toHaveLength(0)
    })

    it("should set uploadResult on initialized files from storage plugin", async () => {
      // This test ensures that files initialized via initialFiles have uploadResult set,
      // making them consistent with newly uploaded files. This is important for consumers
      // who need to extract the storage path (e.g., storageKey) from files.
      const uploader = useUploadKit({
        initialFiles: ["path/to/image.jpg", "path/to/video.mp4"],
        storage: {
          id: "mock-azure-storage",
          hooks: {
            upload: vi.fn().mockResolvedValue({ url: "https://example.com/uploaded.jpg", storageKey: "uploaded.jpg" }),
            getRemoteFile: async (fileId: string) => ({
              size: 2048,
              mimeType: fileId.endsWith(".mp4") ? "video/mp4" : "image/jpeg",
              remoteUrl: `https://storage.example.com/${fileId}`,
              // Storage plugin returns uploadResult for initialized files
              uploadResult: {
                url: `https://storage.example.com/${fileId}`,
                storageKey: fileId,
              },
            }),
          },
        },
      })

      await waitForInitialFiles(uploader)

      expect(uploader.files.value).toHaveLength(2)

      // Both files should have uploadResult set
      const file1 = uploader.files.value[0]!
      const file2 = uploader.files.value[1]!

      expect(file1.uploadResult).toBeDefined()
      expect(file1.uploadResult?.storageKey).toBe("path/to/image.jpg")
      expect(file1.uploadResult?.url).toBe("https://storage.example.com/path/to/image.jpg")

      expect(file2.uploadResult).toBeDefined()
      expect(file2.uploadResult?.storageKey).toBe("path/to/video.mp4")
      expect(file2.uploadResult?.url).toBe("https://storage.example.com/path/to/video.mp4")
    })
  })
})
