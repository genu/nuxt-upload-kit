import { describe, it, expect, vi } from "vitest"
import { ValidatorMaxFileSize } from "../../../src/runtime/composables/useUploadKit/validators/max-file-size"
import { createMockLocalUploadFile, createMockPluginContext } from "../../helpers"

describe("ValidatorMaxFileSize", () => {
  describe("validate hook", () => {
    it("should allow file under size limit", async () => {
      const validator = ValidatorMaxFileSize({ maxFileSize: 1024 * 1024 }) // 1MB
      const file = createMockLocalUploadFile({ size: 500 * 1024 }) // 500KB
      const context = createMockPluginContext()

      const result = await validator.hooks.validate!(file, context)

      expect(result).toBe(file)
    })

    it("should allow file at exact size limit", async () => {
      const validator = ValidatorMaxFileSize({ maxFileSize: 1024 })
      const file = createMockLocalUploadFile({ size: 1024 })
      const context = createMockPluginContext()

      const result = await validator.hooks.validate!(file, context)

      expect(result).toBe(file)
    })

    it("should reject file over size limit", async () => {
      const validator = ValidatorMaxFileSize({ maxFileSize: 1024 })
      const file = createMockLocalUploadFile({ size: 2048 })
      const context = createMockPluginContext()

      await expect(validator.hooks.validate!(file, context)).rejects.toEqual({
        message: "File size exceeds the maximum limit of 1024 bytes",
      })
    })

    it("should allow all files when maxFileSize is undefined", async () => {
      const validator = ValidatorMaxFileSize({})
      const file = createMockLocalUploadFile({ size: 100 * 1024 * 1024 }) // 100MB
      const context = createMockPluginContext()

      const result = await validator.hooks.validate!(file, context)

      expect(result).toBe(file)
    })

    it("should allow all files when maxFileSize is Infinity", async () => {
      const validator = ValidatorMaxFileSize({ maxFileSize: Infinity })
      const file = createMockLocalUploadFile({ size: 100 * 1024 * 1024 }) // 100MB
      const context = createMockPluginContext()

      const result = await validator.hooks.validate!(file, context)

      expect(result).toBe(file)
    })

    it("should allow all files when maxFileSize is 0 (falsy)", async () => {
      const validator = ValidatorMaxFileSize({ maxFileSize: 0 })
      const file = createMockLocalUploadFile({ size: 1024 })
      const context = createMockPluginContext()

      // maxFileSize: 0 is falsy, so it allows all files
      const result = await validator.hooks.validate!(file, context)

      expect(result).toBe(file)
    })

    it("should have correct plugin ID", () => {
      const validator = ValidatorMaxFileSize({ maxFileSize: 1024 })

      expect(validator.id).toBe("validator-max-file-size")
    })
  })

  describe("edge cases", () => {
    it("should handle very small files", async () => {
      const validator = ValidatorMaxFileSize({ maxFileSize: 100 })
      const file = createMockLocalUploadFile({ size: 1 })
      const context = createMockPluginContext()

      const result = await validator.hooks.validate!(file, context)

      expect(result).toBe(file)
    })

    it("should handle very large size limits", async () => {
      const validator = ValidatorMaxFileSize({ maxFileSize: Number.MAX_SAFE_INTEGER })
      const file = createMockLocalUploadFile({ size: 1024 * 1024 * 1024 }) // 1GB
      const context = createMockPluginContext()

      const result = await validator.hooks.validate!(file, context)

      expect(result).toBe(file)
    })

    it("should reject file 1 byte over limit", async () => {
      const validator = ValidatorMaxFileSize({ maxFileSize: 1000 })
      const file = createMockLocalUploadFile({ size: 1001 })
      const context = createMockPluginContext()

      await expect(validator.hooks.validate!(file, context)).rejects.toEqual({
        message: "File size exceeds the maximum limit of 1000 bytes",
      })
    })

    it("should handle zero-byte files", async () => {
      const validator = ValidatorMaxFileSize({ maxFileSize: 1024 })
      const file = createMockLocalUploadFile({ size: 0 })
      const context = createMockPluginContext()

      const result = await validator.hooks.validate!(file, context)

      expect(result).toBe(file)
    })
  })

  describe("realistic file size scenarios", () => {
    it("should handle 5MB limit for images", async () => {
      const validator = ValidatorMaxFileSize({ maxFileSize: 5 * 1024 * 1024 }) // 5MB
      const file = createMockLocalUploadFile({
        size: 3 * 1024 * 1024, // 3MB
        mimeType: "image/jpeg",
        name: "photo.jpg",
      })
      const context = createMockPluginContext()

      const result = await validator.hooks.validate!(file, context)

      expect(result).toBe(file)
    })

    it("should reject image over 5MB limit", async () => {
      const validator = ValidatorMaxFileSize({ maxFileSize: 5 * 1024 * 1024 }) // 5MB
      const file = createMockLocalUploadFile({
        size: 10 * 1024 * 1024, // 10MB
        mimeType: "image/jpeg",
        name: "large-photo.jpg",
      })
      const context = createMockPluginContext()

      await expect(validator.hooks.validate!(file, context)).rejects.toEqual({
        message: `File size exceeds the maximum limit of ${5 * 1024 * 1024} bytes`,
      })
    })

    it("should handle 100MB limit for videos", async () => {
      const validator = ValidatorMaxFileSize({ maxFileSize: 100 * 1024 * 1024 }) // 100MB
      const file = createMockLocalUploadFile({
        size: 50 * 1024 * 1024, // 50MB
        mimeType: "video/mp4",
        name: "video.mp4",
      })
      const context = createMockPluginContext()

      const result = await validator.hooks.validate!(file, context)

      expect(result).toBe(file)
    })
  })
})
