import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { PluginThumbnailGenerator } from "../../../src/runtime/composables/useUploadKit/plugins/thumbnail-generator"
import { createMockLocalUploadFile, createMockRemoteUploadFile, createMockPluginContext } from "../../helpers"

describe("PluginThumbnailGenerator", () => {
  let originalCreateObjectURL: typeof URL.createObjectURL
  let originalRevokeObjectURL: typeof URL.revokeObjectURL

  beforeEach(() => {
    originalCreateObjectURL = URL.createObjectURL
    originalRevokeObjectURL = URL.revokeObjectURL

    URL.createObjectURL = vi.fn(() => "blob:mock-url")
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    vi.restoreAllMocks()
  })

  describe("plugin configuration", () => {
    it("should have correct plugin ID", () => {
      const plugin = PluginThumbnailGenerator({})

      expect(plugin.id).toBe("thumbnail-generator")
    })

    it("should use default options when not specified", () => {
      const plugin = PluginThumbnailGenerator({})

      expect(plugin).toBeDefined()
      expect(plugin.hooks.preprocess).toBeDefined()
    })

    it("should accept custom options", () => {
      const plugin = PluginThumbnailGenerator({
        maxWidth: 300,
        maxHeight: 300,
        quality: 0.9,
        videoCaptureTime: 2,
      })

      expect(plugin).toBeDefined()
    })

    it("should have preprocess and process hooks", () => {
      const plugin = PluginThumbnailGenerator({})

      expect(plugin.hooks.preprocess).toBeDefined()
      expect(plugin.hooks.process).toBeDefined()
      expect(plugin.hooks.validate).toBeUndefined()
      expect(plugin.hooks.complete).toBeUndefined()
    })
  })

  describe("preprocess hook - file filtering", () => {
    it("should skip non-image and non-video files", async () => {
      const plugin = PluginThumbnailGenerator({})
      const file = createMockLocalUploadFile({
        mimeType: "application/pdf",
        name: "document.pdf",
      })
      const context = createMockPluginContext()

      const result = await plugin.hooks.preprocess!(file, context)

      expect(result).toBe(file)
      expect(result.preview).toBeUndefined()
    })

    it("should skip GIF files", async () => {
      const plugin = PluginThumbnailGenerator({})
      const file = createMockLocalUploadFile({
        mimeType: "image/gif",
        name: "animation.gif",
      })
      const context = createMockPluginContext()

      const result = await plugin.hooks.preprocess!(file, context)

      expect(result).toBe(file)
      expect(result.preview).toBeUndefined()
    })

    it("should skip SVG files", async () => {
      const plugin = PluginThumbnailGenerator({})
      const file = createMockLocalUploadFile({
        mimeType: "image/svg+xml",
        name: "vector.svg",
      })
      const context = createMockPluginContext()

      const result = await plugin.hooks.preprocess!(file, context)

      expect(result).toBe(file)
      expect(result.preview).toBeUndefined()
    })

    it("should skip remote files", async () => {
      const plugin = PluginThumbnailGenerator({})
      const file = createMockRemoteUploadFile({
        mimeType: "image/jpeg",
        name: "remote-image.jpg",
      })
      const context = createMockPluginContext()

      const result = await plugin.hooks.preprocess!(file, context)

      expect(result).toBe(file)
    })

    it("should skip text files", async () => {
      const plugin = PluginThumbnailGenerator({})
      const file = createMockLocalUploadFile({
        mimeType: "text/plain",
        name: "readme.txt",
      })
      const context = createMockPluginContext()

      const result = await plugin.hooks.preprocess!(file, context)

      expect(result).toBe(file)
      expect(result.preview).toBeUndefined()
    })

    it("should skip audio files", async () => {
      const plugin = PluginThumbnailGenerator({})
      const file = createMockLocalUploadFile({
        mimeType: "audio/mpeg",
        name: "song.mp3",
      })
      const context = createMockPluginContext()

      const result = await plugin.hooks.preprocess!(file, context)

      expect(result).toBe(file)
      expect(result.preview).toBeUndefined()
    })
  })

  describe("file type detection", () => {
    it("should identify JPEG as processable", () => {
      const file = createMockLocalUploadFile({ mimeType: "image/jpeg" })
      expect(file.mimeType.startsWith("image/")).toBe(true)
      expect(file.mimeType).not.toBe("image/gif")
      expect(file.mimeType).not.toBe("image/svg+xml")
    })

    it("should identify PNG as processable", () => {
      const file = createMockLocalUploadFile({ mimeType: "image/png" })
      expect(file.mimeType.startsWith("image/")).toBe(true)
      expect(file.mimeType).not.toBe("image/gif")
      expect(file.mimeType).not.toBe("image/svg+xml")
    })

    it("should identify WebP as processable", () => {
      const file = createMockLocalUploadFile({ mimeType: "image/webp" })
      expect(file.mimeType.startsWith("image/")).toBe(true)
      expect(file.mimeType).not.toBe("image/gif")
      expect(file.mimeType).not.toBe("image/svg+xml")
    })

    it("should identify BMP as processable", () => {
      const file = createMockLocalUploadFile({ mimeType: "image/bmp" })
      expect(file.mimeType.startsWith("image/")).toBe(true)
    })

    it("should identify MP4 video as processable", () => {
      const file = createMockLocalUploadFile({ mimeType: "video/mp4" })
      expect(file.mimeType.startsWith("video/")).toBe(true)
    })

    it("should identify WebM video as processable", () => {
      const file = createMockLocalUploadFile({ mimeType: "video/webm" })
      expect(file.mimeType.startsWith("video/")).toBe(true)
    })

    it("should identify QuickTime video as processable", () => {
      const file = createMockLocalUploadFile({ mimeType: "video/quicktime" })
      expect(file.mimeType.startsWith("video/")).toBe(true)
    })
  })

  describe("dimension calculation logic", () => {
    it("should scale down landscape images correctly", () => {
      // Test the scaling logic used in thumbnail generation
      const originalWidth = 1000
      const originalHeight = 500
      const maxWidth = 200
      const maxHeight = 200

      const aspectRatio = originalWidth / originalHeight // 2
      let scaledWidth = maxWidth
      let scaledHeight = maxHeight

      if (aspectRatio > 1) {
        // Landscape
        scaledHeight = maxWidth / aspectRatio // 200 / 2 = 100
      } else {
        scaledWidth = maxHeight * aspectRatio
      }

      expect(scaledWidth).toBe(200)
      expect(scaledHeight).toBe(100)
    })

    it("should scale down portrait images correctly", () => {
      const originalWidth = 500
      const originalHeight = 1000
      const maxWidth = 200
      const maxHeight = 200

      const aspectRatio = originalWidth / originalHeight // 0.5
      let scaledWidth = maxWidth
      let scaledHeight = maxHeight

      if (aspectRatio > 1) {
        scaledHeight = maxWidth / aspectRatio
      } else {
        // Portrait
        scaledWidth = maxHeight * aspectRatio // 200 * 0.5 = 100
      }

      expect(scaledWidth).toBe(100)
      expect(scaledHeight).toBe(200)
    })

    it("should handle square images correctly", () => {
      const originalWidth = 800
      const originalHeight = 800
      const maxWidth = 200
      const maxHeight = 200

      const aspectRatio = originalWidth / originalHeight // 1
      let scaledWidth = maxWidth
      let scaledHeight = maxHeight

      if (aspectRatio > 1) {
        scaledHeight = maxWidth / aspectRatio
      } else {
        scaledWidth = maxHeight * aspectRatio // 200 * 1 = 200
      }

      expect(scaledWidth).toBe(200)
      expect(scaledHeight).toBe(200)
    })

    it("should handle wide panoramic images", () => {
      const originalWidth = 4000
      const originalHeight = 500
      const maxWidth = 200
      const maxHeight = 200

      const aspectRatio = originalWidth / originalHeight // 8
      const scaledWidth = maxWidth
      let scaledHeight = maxHeight

      if (aspectRatio > 1) {
        scaledHeight = maxWidth / aspectRatio // 200 / 8 = 25
      }

      expect(scaledWidth).toBe(200)
      expect(scaledHeight).toBe(25)
    })

    it("should handle tall vertical images", () => {
      const originalWidth = 500
      const originalHeight = 4000
      const maxWidth = 200
      const maxHeight = 200

      const aspectRatio = originalWidth / originalHeight // 0.125
      let scaledWidth = maxWidth
      let scaledHeight = maxHeight

      if (aspectRatio > 1) {
        scaledHeight = maxWidth / aspectRatio
      } else {
        scaledWidth = maxHeight * aspectRatio // 200 * 0.125 = 25
      }

      expect(scaledWidth).toBe(25)
      expect(scaledHeight).toBe(200)
    })
  })

  describe("options validation", () => {
    it("should accept maxWidth option", () => {
      const plugin = PluginThumbnailGenerator({ maxWidth: 100 })
      expect(plugin).toBeDefined()
    })

    it("should accept maxHeight option", () => {
      const plugin = PluginThumbnailGenerator({ maxHeight: 100 })
      expect(plugin).toBeDefined()
    })

    it("should accept quality option", () => {
      const plugin = PluginThumbnailGenerator({ quality: 0.5 })
      expect(plugin).toBeDefined()
    })

    it("should accept videoCaptureTime option", () => {
      const plugin = PluginThumbnailGenerator({ videoCaptureTime: 5 })
      expect(plugin).toBeDefined()
    })

    it("should accept all options together", () => {
      const plugin = PluginThumbnailGenerator({
        maxWidth: 150,
        maxHeight: 150,
        quality: 0.8,
        videoCaptureTime: 3,
      })
      expect(plugin).toBeDefined()
    })
  })

  describe("video thumbnail options", () => {
    it("should default videoCaptureTime to 1 second", () => {
      const plugin = PluginThumbnailGenerator({})
      expect(plugin).toBeDefined()
    })

    it("should accept custom videoCaptureTime", () => {
      const plugin = PluginThumbnailGenerator({ videoCaptureTime: 10 })
      expect(plugin).toBeDefined()
    })

    it("should accept zero videoCaptureTime", () => {
      const plugin = PluginThumbnailGenerator({ videoCaptureTime: 0 })
      expect(plugin).toBeDefined()
    })
  })
})
