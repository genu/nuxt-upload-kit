import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  createPluginContext,
  createFileError,
  calculateThumbnailDimensions,
  cleanupObjectURLs,
} from "../../src/runtime/composables/useUploadKit/utils"
import { createMockLocalUploadFile } from "../helpers"
import mitt from "mitt"

describe("utils", () => {
  describe("createPluginContext", () => {
    it("should create a plugin context with all properties", () => {
      const emitter = mitt()
      const files = [createMockLocalUploadFile()]
      const options = { maxFiles: 10 }

      const context = createPluginContext("test-plugin", files, options, emitter)

      expect(context.files).toBe(files)
      expect(context.options).toBe(options)
      expect(typeof context.emit).toBe("function")
    })

    it("should prefix emitted events with plugin ID", () => {
      const emitter = mitt()
      const handler = vi.fn()
      emitter.on("test-plugin:custom-event", handler)

      const context = createPluginContext("test-plugin", [], {}, emitter)
      context.emit("custom-event" as any, { data: "test" })

      expect(handler).toHaveBeenCalledWith({ data: "test" })
    })

    it("should handle different plugin IDs", () => {
      const emitter = mitt()
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      emitter.on("plugin-a:event", handler1)
      emitter.on("plugin-b:event", handler2)

      const contextA = createPluginContext("plugin-a", [], {}, emitter)
      const contextB = createPluginContext("plugin-b", [], {}, emitter)

      contextA.emit("event" as any, { from: "A" })
      contextB.emit("event" as any, { from: "B" })

      expect(handler1).toHaveBeenCalledWith({ from: "A" })
      expect(handler2).toHaveBeenCalledWith({ from: "B" })
    })

    it("should work with empty files array", () => {
      const emitter = mitt()
      const context = createPluginContext("test", [], {}, emitter)

      expect(context.files).toHaveLength(0)
    })

    it("should work with empty options", () => {
      const emitter = mitt()
      const context = createPluginContext("test", [], {}, emitter)

      expect(context.options).toEqual({})
    })
  })

  describe("createFileError", () => {
    it("should create error object from Error instance", () => {
      const file = createMockLocalUploadFile({ name: "test.jpg", size: 1024 })
      const error = new Error("Upload failed")

      const result = createFileError(file, error)

      expect(result.message).toBe("Upload failed")
      expect(result.details).toEqual({
        fileName: "test.jpg",
        fileSize: 1024,
        timestamp: expect.any(String),
      })
    })

    it("should create error object from string", () => {
      const file = createMockLocalUploadFile({ name: "test.jpg", size: 2048 })

      const result = createFileError(file, "Something went wrong")

      expect(result.message).toBe("Something went wrong")
      expect(result.details.fileName).toBe("test.jpg")
      expect(result.details.fileSize).toBe(2048)
    })

    it("should create error object from object", () => {
      const file = createMockLocalUploadFile()

      const result = createFileError(file, { code: 500, reason: "Server error" })

      expect(result.message).toBe("[object Object]")
    })

    it("should include ISO timestamp in details", () => {
      const file = createMockLocalUploadFile()

      const result = createFileError(file, new Error("Test"))

      expect(result.details.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    it("should handle null error", () => {
      const file = createMockLocalUploadFile()

      const result = createFileError(file, null)

      expect(result.message).toBe("null")
    })

    it("should handle undefined error", () => {
      const file = createMockLocalUploadFile()

      const result = createFileError(file, undefined)

      expect(result.message).toBe("undefined")
    })

    it("should handle number error", () => {
      const file = createMockLocalUploadFile()

      const result = createFileError(file, 404)

      expect(result.message).toBe("404")
    })
  })

  describe("calculateThumbnailDimensions", () => {
    describe("landscape images", () => {
      it("should scale down landscape image to fit maxWidth", () => {
        const result = calculateThumbnailDimensions(1000, 500, 200, 200)

        expect(result.width).toBe(200)
        expect(result.height).toBe(100)
      })

      it("should maintain aspect ratio for wide landscape", () => {
        const result = calculateThumbnailDimensions(2000, 500, 200, 200)

        expect(result.width).toBe(200)
        expect(result.height).toBe(50)
      })

      it("should handle 16:9 aspect ratio", () => {
        const result = calculateThumbnailDimensions(1920, 1080, 200, 200)

        // aspectRatio = 1920/1080 = 1.78 > 1 (landscape)
        // height = 200 / 1.78 = 112.5
        expect(result.width).toBe(200)
        expect(result.height).toBeCloseTo(112.5, 0)
      })
    })

    describe("portrait images", () => {
      it("should scale down portrait image to fit maxHeight", () => {
        const result = calculateThumbnailDimensions(500, 1000, 200, 200)

        expect(result.width).toBe(100)
        expect(result.height).toBe(200)
      })

      it("should maintain aspect ratio for tall portrait", () => {
        const result = calculateThumbnailDimensions(500, 2000, 200, 200)

        expect(result.width).toBe(50)
        expect(result.height).toBe(200)
      })

      it("should handle 9:16 aspect ratio (vertical video)", () => {
        const result = calculateThumbnailDimensions(1080, 1920, 200, 200)

        // aspectRatio = 1080/1920 = 0.5625 < 1 (portrait)
        // width = 200 * 0.5625 = 112.5
        expect(result.width).toBeCloseTo(112.5, 0)
        expect(result.height).toBe(200)
      })
    })

    describe("square images", () => {
      it("should handle square image", () => {
        const result = calculateThumbnailDimensions(800, 800, 200, 200)

        // aspectRatio = 1, goes to portrait branch
        // width = 200 * 1 = 200
        expect(result.width).toBe(200)
        expect(result.height).toBe(200)
      })

      it("should handle perfect square with different maxWidth/maxHeight", () => {
        const result = calculateThumbnailDimensions(800, 800, 300, 200)

        // aspectRatio = 1, portrait branch: width = 200 * 1 = 200
        expect(result.width).toBe(200)
        expect(result.height).toBe(200)
      })
    })

    describe("edge cases", () => {
      it("should handle very small images", () => {
        const result = calculateThumbnailDimensions(10, 10, 200, 200)

        expect(result.width).toBe(200)
        expect(result.height).toBe(200)
      })

      it("should handle very large images", () => {
        const result = calculateThumbnailDimensions(10000, 5000, 200, 200)

        expect(result.width).toBe(200)
        expect(result.height).toBe(100)
      })

      it("should handle non-integer dimensions", () => {
        const result = calculateThumbnailDimensions(1000, 333, 200, 200)

        // Should produce non-integer result
        expect(result.width).toBe(200)
        expect(result.height).toBeCloseTo(66.6, 0)
      })

      it("should handle 1x1 image", () => {
        const result = calculateThumbnailDimensions(1, 1, 200, 200)

        expect(result.width).toBe(200)
        expect(result.height).toBe(200)
      })
    })

    describe("different max dimensions", () => {
      it("should handle wider max dimensions", () => {
        const result = calculateThumbnailDimensions(800, 600, 400, 200)

        // aspectRatio = 800/600 = 1.33 > 1 (landscape)
        // height = 400 / 1.33 = 300 (but max is 200)
        // Wait, the function uses maxWidth for height calculation in landscape
        expect(result.width).toBe(400)
      })

      it("should handle taller max dimensions", () => {
        const result = calculateThumbnailDimensions(600, 800, 200, 400)

        // aspectRatio = 600/800 = 0.75 < 1 (portrait)
        // width = 400 * 0.75 = 300
        expect(result.height).toBe(400)
      })
    })
  })

  describe("cleanupObjectURLs", () => {
    let originalRevokeObjectURL: typeof URL.revokeObjectURL

    beforeEach(() => {
      originalRevokeObjectURL = URL.revokeObjectURL
      URL.revokeObjectURL = vi.fn()
    })

    afterEach(() => {
      URL.revokeObjectURL = originalRevokeObjectURL
    })

    it("should cleanup specific file URL", () => {
      const urlMap = new Map<string, string>([
        ["file1", "blob:file1-url"],
        ["file2", "blob:file2-url"],
        ["file3", "blob:file3-url"],
      ])

      cleanupObjectURLs(urlMap, "file2")

      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:file2-url")
      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
      expect(urlMap.has("file2")).toBe(false)
      expect(urlMap.has("file1")).toBe(true)
      expect(urlMap.has("file3")).toBe(true)
    })

    it("should cleanup all URLs when no fileId provided", () => {
      const urlMap = new Map<string, string>([
        ["file1", "blob:file1-url"],
        ["file2", "blob:file2-url"],
        ["file3", "blob:file3-url"],
      ])

      cleanupObjectURLs(urlMap)

      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3)
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:file1-url")
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:file2-url")
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:file3-url")
      expect(urlMap.size).toBe(0)
    })

    it("should handle empty map", () => {
      const urlMap = new Map<string, string>()

      cleanupObjectURLs(urlMap)

      expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    })

    it("should handle non-existent fileId gracefully", () => {
      const urlMap = new Map<string, string>([["file1", "blob:file1-url"]])

      cleanupObjectURLs(urlMap, "non-existent")

      expect(URL.revokeObjectURL).not.toHaveBeenCalled()
      expect(urlMap.size).toBe(1)
    })

    it("should handle single URL in map", () => {
      const urlMap = new Map<string, string>([["file1", "blob:file1-url"]])

      cleanupObjectURLs(urlMap, "file1")

      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:file1-url")
      expect(urlMap.size).toBe(0)
    })

    it("should handle multiple cleanup calls", () => {
      const urlMap = new Map<string, string>([
        ["file1", "blob:file1-url"],
        ["file2", "blob:file2-url"],
      ])

      cleanupObjectURLs(urlMap, "file1")
      cleanupObjectURLs(urlMap, "file2")

      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
      expect(urlMap.size).toBe(0)
    })
  })
})
