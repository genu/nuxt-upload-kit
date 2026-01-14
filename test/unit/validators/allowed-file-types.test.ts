import { describe, it, expect } from "vitest"
import { ValidatorAllowedFileTypes } from "../../../src/runtime/composables/useUploadKit/validators/allowed-file-types"
import { createMockLocalUploadFile, createMockPluginContext } from "../../helpers"

describe("ValidatorAllowedFileTypes", () => {
  describe("validate hook", () => {
    it("should allow file with allowed MIME type", async () => {
      const validator = ValidatorAllowedFileTypes({
        allowedFileTypes: ["image/jpeg", "image/png"],
      })
      const file = createMockLocalUploadFile({ mimeType: "image/jpeg" })
      const context = createMockPluginContext()

      const result = await validator.hooks.validate!(file, context)

      expect(result).toBe(file)
    })

    it("should allow file when MIME type matches any in list", async () => {
      const validator = ValidatorAllowedFileTypes({
        allowedFileTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
      })
      const file = createMockLocalUploadFile({ mimeType: "image/webp" })
      const context = createMockPluginContext()

      const result = await validator.hooks.validate!(file, context)

      expect(result).toBe(file)
    })

    it("should reject file with disallowed MIME type", async () => {
      const validator = ValidatorAllowedFileTypes({
        allowedFileTypes: ["image/jpeg", "image/png"],
      })
      const file = createMockLocalUploadFile({ mimeType: "application/pdf" })
      const context = createMockPluginContext()

      await expect(validator.hooks.validate!(file, context)).rejects.toEqual({
        message: "File type application/pdf is not allowed",
      })
    })

    it("should allow all files when allowedFileTypes is undefined", async () => {
      const validator = ValidatorAllowedFileTypes({})
      const file = createMockLocalUploadFile({ mimeType: "application/octet-stream" })
      const context = createMockPluginContext()

      const result = await validator.hooks.validate!(file, context)

      expect(result).toBe(file)
    })

    it("should allow all files when allowedFileTypes is empty array", async () => {
      const validator = ValidatorAllowedFileTypes({ allowedFileTypes: [] })
      const file = createMockLocalUploadFile({ mimeType: "video/mp4" })
      const context = createMockPluginContext()

      const result = await validator.hooks.validate!(file, context)

      expect(result).toBe(file)
    })

    it("should have correct plugin ID", () => {
      const validator = ValidatorAllowedFileTypes({ allowedFileTypes: ["image/jpeg"] })

      expect(validator.id).toBe("validator-allowed-file-types")
    })
  })

  describe("image types", () => {
    const imageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"]

    it("should allow common image types", async () => {
      const validator = ValidatorAllowedFileTypes({ allowedFileTypes: imageTypes })

      for (const mimeType of imageTypes) {
        const file = createMockLocalUploadFile({ mimeType })
        const context = createMockPluginContext()

        const result = await validator.hooks.validate!(file, context)
        expect(result).toBe(file)
      }
    })

    it("should reject non-image types when only images allowed", async () => {
      const validator = ValidatorAllowedFileTypes({ allowedFileTypes: imageTypes })
      const file = createMockLocalUploadFile({ mimeType: "video/mp4" })
      const context = createMockPluginContext()

      await expect(validator.hooks.validate!(file, context)).rejects.toEqual({
        message: "File type video/mp4 is not allowed",
      })
    })
  })

  describe("video types", () => {
    const videoTypes = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"]

    it("should allow common video types", async () => {
      const validator = ValidatorAllowedFileTypes({ allowedFileTypes: videoTypes })

      for (const mimeType of videoTypes) {
        const file = createMockLocalUploadFile({ mimeType })
        const context = createMockPluginContext()

        const result = await validator.hooks.validate!(file, context)
        expect(result).toBe(file)
      }
    })
  })

  describe("document types", () => {
    const documentTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ]

    it("should allow document types", async () => {
      const validator = ValidatorAllowedFileTypes({ allowedFileTypes: documentTypes })

      for (const mimeType of documentTypes) {
        const file = createMockLocalUploadFile({ mimeType })
        const context = createMockPluginContext()

        const result = await validator.hooks.validate!(file, context)
        expect(result).toBe(file)
      }
    })
  })

  describe("edge cases", () => {
    it("should be case-sensitive for MIME types", async () => {
      const validator = ValidatorAllowedFileTypes({
        allowedFileTypes: ["image/jpeg"],
      })
      const file = createMockLocalUploadFile({ mimeType: "IMAGE/JPEG" })
      const context = createMockPluginContext()

      // MIME types are case-sensitive per spec
      await expect(validator.hooks.validate!(file, context)).rejects.toEqual({
        message: "File type IMAGE/JPEG is not allowed",
      })
    })

    it("should handle empty MIME type in file", async () => {
      const validator = ValidatorAllowedFileTypes({
        allowedFileTypes: ["image/jpeg"],
      })
      const file = createMockLocalUploadFile({ mimeType: "" })
      const context = createMockPluginContext()

      await expect(validator.hooks.validate!(file, context)).rejects.toEqual({
        message: "File type  is not allowed",
      })
    })

    it("should allow single allowed type", async () => {
      const validator = ValidatorAllowedFileTypes({
        allowedFileTypes: ["application/pdf"],
      })
      const file = createMockLocalUploadFile({ mimeType: "application/pdf" })
      const context = createMockPluginContext()

      const result = await validator.hooks.validate!(file, context)

      expect(result).toBe(file)
    })

    it("should handle vendor-specific MIME types", async () => {
      const validator = ValidatorAllowedFileTypes({
        allowedFileTypes: ["application/vnd.ms-excel"],
      })
      const file = createMockLocalUploadFile({ mimeType: "application/vnd.ms-excel" })
      const context = createMockPluginContext()

      const result = await validator.hooks.validate!(file, context)

      expect(result).toBe(file)
    })

    it("should handle MIME types with parameters (stripping them)", async () => {
      const validator = ValidatorAllowedFileTypes({
        allowedFileTypes: ["text/plain; charset=utf-8"],
      })
      const file = createMockLocalUploadFile({ mimeType: "text/plain; charset=utf-8" })
      const context = createMockPluginContext()

      const result = await validator.hooks.validate!(file, context)

      expect(result).toBe(file)
    })
  })

  describe("mixed media uploads", () => {
    it("should allow both images and videos", async () => {
      const validator = ValidatorAllowedFileTypes({
        allowedFileTypes: ["image/jpeg", "image/png", "video/mp4", "video/webm"],
      })

      const imageFile = createMockLocalUploadFile({ mimeType: "image/jpeg" })
      const videoFile = createMockLocalUploadFile({ mimeType: "video/mp4" })
      const context = createMockPluginContext()

      const imageResult = await validator.hooks.validate!(imageFile, context)
      const videoResult = await validator.hooks.validate!(videoFile, context)

      expect(imageResult).toBe(imageFile)
      expect(videoResult).toBe(videoFile)
    })

    it("should reject audio when only images and videos allowed", async () => {
      const validator = ValidatorAllowedFileTypes({
        allowedFileTypes: ["image/jpeg", "image/png", "video/mp4"],
      })
      const file = createMockLocalUploadFile({ mimeType: "audio/mpeg" })
      const context = createMockPluginContext()

      await expect(validator.hooks.validate!(file, context)).rejects.toEqual({
        message: "File type audio/mpeg is not allowed",
      })
    })
  })
})
