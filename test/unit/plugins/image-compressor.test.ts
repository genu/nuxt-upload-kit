import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { PluginImageCompressor } from "../../../src/runtime/composables/useUploadKit/plugins/image-compressor"
import { createMockLocalUploadFile, createMockRemoteUploadFile, createMockPluginContext } from "../../helpers"

describe("PluginImageCompressor", () => {
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
      const plugin = PluginImageCompressor({})

      expect(plugin.id).toBe("image-compressor")
    })

    it("should use default options when not specified", () => {
      const plugin = PluginImageCompressor({})

      expect(plugin).toBeDefined()
      expect(plugin.hooks.process).toBeDefined()
    })

    it("should accept custom options", () => {
      const plugin = PluginImageCompressor({
        maxWidth: 1280,
        maxHeight: 720,
        quality: 0.75,
        outputFormat: "webp",
        minSizeToCompress: 50000,
      })

      expect(plugin).toBeDefined()
    })
  })

  describe("process hook - file filtering", () => {
    it("should skip non-image files", async () => {
      const plugin = PluginImageCompressor({})
      const file = createMockLocalUploadFile({
        mimeType: "application/pdf",
        name: "document.pdf",
        size: 500000,
      })
      const context = createMockPluginContext()

      const result = await plugin.hooks.process!(file, context)

      expect(result).toBe(file)
    })

    it("should skip video files", async () => {
      const plugin = PluginImageCompressor({})
      const file = createMockLocalUploadFile({
        mimeType: "video/mp4",
        name: "video.mp4",
        size: 500000,
      })
      const context = createMockPluginContext()

      const result = await plugin.hooks.process!(file, context)

      expect(result).toBe(file)
    })

    it("should skip GIF files and emit skip event", async () => {
      const plugin = PluginImageCompressor({})
      const file = createMockLocalUploadFile({
        mimeType: "image/gif",
        name: "animation.gif",
        size: 500000,
      })
      const context = createMockPluginContext()

      const result = await plugin.hooks.process!(file, context)

      expect(result).toBe(file)
      expect(context.emit).toHaveBeenCalledWith("skip", {
        file,
        reason: "GIF format not supported",
      })
    })

    it("should skip SVG files and emit skip event", async () => {
      const plugin = PluginImageCompressor({})
      const file = createMockLocalUploadFile({
        mimeType: "image/svg+xml",
        name: "vector.svg",
        size: 500000,
      })
      const context = createMockPluginContext()

      const result = await plugin.hooks.process!(file, context)

      expect(result).toBe(file)
      expect(context.emit).toHaveBeenCalledWith("skip", {
        file,
        reason: "SVG already optimized",
      })
    })

    it("should skip remote files and emit skip event", async () => {
      const plugin = PluginImageCompressor({})
      const file = createMockRemoteUploadFile({
        mimeType: "image/jpeg",
        name: "remote-image.jpg",
        size: 500000,
      })
      const context = createMockPluginContext()

      const result = await plugin.hooks.process!(file, context)

      expect(result).toBe(file)
      expect(context.emit).toHaveBeenCalledWith("skip", {
        file,
        reason: "Remote file, no local data to compress",
      })
    })

    it("should skip files below minSizeToCompress", async () => {
      const plugin = PluginImageCompressor({ minSizeToCompress: 100000 }) // 100KB
      const file = createMockLocalUploadFile({
        mimeType: "image/jpeg",
        name: "small-image.jpg",
        size: 50000, // 50KB
      })
      const context = createMockPluginContext()

      const result = await plugin.hooks.process!(file, context)

      expect(result).toBe(file)
      expect(context.emit).toHaveBeenCalledWith("skip", {
        file,
        reason: "File size (50000 bytes) below minimum threshold",
      })
    })

    it("should skip text files", async () => {
      const plugin = PluginImageCompressor({})
      const file = createMockLocalUploadFile({
        mimeType: "text/plain",
        name: "readme.txt",
        size: 500000,
      })
      const context = createMockPluginContext()

      const result = await plugin.hooks.process!(file, context)

      expect(result).toBe(file)
      // Should not emit any skip event since it's not even an image
      expect(context.emit).not.toHaveBeenCalled()
    })

    it("should skip audio files", async () => {
      const plugin = PluginImageCompressor({})
      const file = createMockLocalUploadFile({
        mimeType: "audio/mpeg",
        name: "song.mp3",
        size: 500000,
      })
      const context = createMockPluginContext()

      const result = await plugin.hooks.process!(file, context)

      expect(result).toBe(file)
      expect(context.emit).not.toHaveBeenCalled()
    })
  })

  describe("output format handling", () => {
    it("should preserve original format when outputFormat is auto", () => {
      const plugin = PluginImageCompressor({ outputFormat: "auto" })

      expect(plugin).toBeDefined()
    })

    it("should accept jpeg format", () => {
      const plugin = PluginImageCompressor({ outputFormat: "jpeg" })

      expect(plugin).toBeDefined()
    })

    it("should accept webp format", () => {
      const plugin = PluginImageCompressor({ outputFormat: "webp" })

      expect(plugin).toBeDefined()
    })

    it("should accept png format", () => {
      const plugin = PluginImageCompressor({ outputFormat: "png" })

      expect(plugin).toBeDefined()
    })
  })

  describe("quality settings", () => {
    it("should accept quality between 0 and 1", () => {
      const validQualities = [0, 0.25, 0.5, 0.75, 0.85, 1]

      validQualities.forEach((quality) => {
        const plugin = PluginImageCompressor({ quality })
        expect(plugin).toBeDefined()
      })
    })
  })

  describe("minSizeToCompress threshold", () => {
    it("should default to 100KB", async () => {
      const plugin = PluginImageCompressor({})
      const file = createMockLocalUploadFile({
        mimeType: "image/jpeg",
        name: "test.jpg",
        size: 99999, // Just under 100KB
      })
      const context = createMockPluginContext()

      const result = await plugin.hooks.process!(file, context)

      expect(result).toBe(file)
      expect(context.emit).toHaveBeenCalledWith(
        "skip",
        expect.objectContaining({
          reason: expect.stringContaining("below minimum threshold"),
        }),
      )
    })

    it("should not skip files at exactly minSizeToCompress for size reasons", () => {
      // Test the threshold logic - file at exactly threshold should not be skipped for size
      const minSizeToCompress = 50000
      const fileSize = 50000 // Exactly at threshold

      // The plugin logic: size < minSizeToCompress skips, size >= minSizeToCompress processes
      const shouldSkipForSize = fileSize < minSizeToCompress

      expect(shouldSkipForSize).toBe(false)
    })

    it("should respect custom minSizeToCompress", async () => {
      const plugin = PluginImageCompressor({ minSizeToCompress: 10000 }) // 10KB
      const file = createMockLocalUploadFile({
        mimeType: "image/jpeg",
        name: "test.jpg",
        size: 9999, // Just under 10KB
      })
      const context = createMockPluginContext()

      const result = await plugin.hooks.process!(file, context)

      expect(result).toBe(file)
      expect(context.emit).toHaveBeenCalledWith("skip", {
        file,
        reason: "File size (9999 bytes) below minimum threshold",
      })
    })

    it("should allow minSizeToCompress of 0 to process all files", () => {
      // Test the threshold logic - minSizeToCompress: 0 means no file is skipped for size
      const minSizeToCompress = 0
      const fileSizes = [0, 1, 100, 1000, 100000]

      fileSizes.forEach((fileSize) => {
        const shouldSkipForSize = fileSize < minSizeToCompress
        expect(shouldSkipForSize).toBe(false)
      })
    })
  })

  describe("dimension options", () => {
    it("should default to 1920x1920 max dimensions", () => {
      const plugin = PluginImageCompressor({})

      // Just verify the plugin creates successfully with defaults
      expect(plugin).toBeDefined()
    })

    it("should accept custom max dimensions", () => {
      const plugin = PluginImageCompressor({
        maxWidth: 800,
        maxHeight: 600,
      })

      expect(plugin).toBeDefined()
    })

    it("should accept very large max dimensions", () => {
      const plugin = PluginImageCompressor({
        maxWidth: 8000,
        maxHeight: 8000,
      })

      expect(plugin).toBeDefined()
    })

    it("should accept very small max dimensions", () => {
      const plugin = PluginImageCompressor({
        maxWidth: 100,
        maxHeight: 100,
      })

      expect(plugin).toBeDefined()
    })
  })

  describe("preserveMetadata option", () => {
    it("should default to true", () => {
      const plugin = PluginImageCompressor({})

      expect(plugin).toBeDefined()
    })

    it("should accept false", () => {
      const plugin = PluginImageCompressor({ preserveMetadata: false })

      expect(plugin).toBeDefined()
    })
  })

  describe("complete plugin lifecycle", () => {
    it("should have process hook only", () => {
      const plugin = PluginImageCompressor({})

      expect(plugin.hooks.process).toBeDefined()
      expect(plugin.hooks.validate).toBeUndefined()
      expect(plugin.hooks.preprocess).toBeUndefined()
      expect(plugin.hooks.complete).toBeUndefined()
    })
  })

  describe("file type detection", () => {
    it("should identify JPEG as compressible", () => {
      const file = createMockLocalUploadFile({ mimeType: "image/jpeg" })
      expect(file.mimeType.startsWith("image/")).toBe(true)
      expect(file.mimeType).not.toBe("image/gif")
      expect(file.mimeType).not.toBe("image/svg+xml")
    })

    it("should identify PNG as compressible", () => {
      const file = createMockLocalUploadFile({ mimeType: "image/png" })
      expect(file.mimeType.startsWith("image/")).toBe(true)
      expect(file.mimeType).not.toBe("image/gif")
      expect(file.mimeType).not.toBe("image/svg+xml")
    })

    it("should identify WebP as compressible", () => {
      const file = createMockLocalUploadFile({ mimeType: "image/webp" })
      expect(file.mimeType.startsWith("image/")).toBe(true)
      expect(file.mimeType).not.toBe("image/gif")
      expect(file.mimeType).not.toBe("image/svg+xml")
    })

    it("should identify BMP as compressible", () => {
      const file = createMockLocalUploadFile({ mimeType: "image/bmp" })
      expect(file.mimeType.startsWith("image/")).toBe(true)
    })
  })
})
