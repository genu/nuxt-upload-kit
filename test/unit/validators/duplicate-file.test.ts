import { describe, it, expect } from "vitest"
import { ValidatorDuplicateFile } from "../../../src/runtime/composables/useUploadKit/validators/duplicate-file"
import { createMockLocalUploadFile, createMockPluginContext, createMockFile } from "../../helpers"

describe("ValidatorDuplicateFile", () => {
  describe("validate hook", () => {
    it("should allow unique file", async () => {
      const validator = ValidatorDuplicateFile({})
      const existingFile = createMockLocalUploadFile({ name: "existing.jpg", size: 1024 })
      const newFile = createMockLocalUploadFile({ name: "new.jpg", size: 2048 })
      const context = createMockPluginContext([existingFile])

      const result = await validator.hooks.validate!(newFile, context)

      expect(result).toBe(newFile)
    })

    it("should reject duplicate file with same name and size", async () => {
      const validator = ValidatorDuplicateFile({})
      const lastModified = Date.now()
      const file1Data = createMockFile("duplicate.jpg", 1024, "image/jpeg", lastModified)
      const file2Data = createMockFile("duplicate.jpg", 1024, "image/jpeg", lastModified)

      const existingFile = createMockLocalUploadFile({
        name: "duplicate.jpg",
        size: 1024,
        data: file1Data,
      })
      const newFile = createMockLocalUploadFile({
        name: "duplicate.jpg",
        size: 1024,
        data: file2Data,
      })
      const context = createMockPluginContext([existingFile])

      await expect(validator.hooks.validate!(newFile, context)).rejects.toEqual({
        message: "This file has already been added",
        details: { fileName: "duplicate.jpg" },
      })
    })

    it("should allow files with same name but different size", async () => {
      const validator = ValidatorDuplicateFile({})
      const existingFile = createMockLocalUploadFile({ name: "file.jpg", size: 1024 })
      const newFile = createMockLocalUploadFile({ name: "file.jpg", size: 2048 })
      const context = createMockPluginContext([existingFile])

      const result = await validator.hooks.validate!(newFile, context)

      expect(result).toBe(newFile)
    })

    it("should allow files with same size but different name", async () => {
      const validator = ValidatorDuplicateFile({})
      const existingFile = createMockLocalUploadFile({ name: "file1.jpg", size: 1024 })
      const newFile = createMockLocalUploadFile({ name: "file2.jpg", size: 1024 })
      const context = createMockPluginContext([existingFile])

      const result = await validator.hooks.validate!(newFile, context)

      expect(result).toBe(newFile)
    })

    it("should allow duplicates when allowDuplicates is true", async () => {
      const validator = ValidatorDuplicateFile({ allowDuplicates: true })
      const lastModified = Date.now()
      const file1Data = createMockFile("duplicate.jpg", 1024, "image/jpeg", lastModified)
      const file2Data = createMockFile("duplicate.jpg", 1024, "image/jpeg", lastModified)

      const existingFile = createMockLocalUploadFile({
        name: "duplicate.jpg",
        size: 1024,
        data: file1Data,
      })
      const newFile = createMockLocalUploadFile({
        name: "duplicate.jpg",
        size: 1024,
        data: file2Data,
      })
      const context = createMockPluginContext([existingFile])

      const result = await validator.hooks.validate!(newFile, context)

      expect(result).toBe(newFile)
    })

    it("should use custom error message", async () => {
      const customMessage = "You already added this file!"
      const validator = ValidatorDuplicateFile({ errorMessage: customMessage })
      const lastModified = Date.now()
      const file1Data = createMockFile("duplicate.jpg", 1024, "image/jpeg", lastModified)
      const file2Data = createMockFile("duplicate.jpg", 1024, "image/jpeg", lastModified)

      const existingFile = createMockLocalUploadFile({
        name: "duplicate.jpg",
        size: 1024,
        data: file1Data,
      })
      const newFile = createMockLocalUploadFile({
        name: "duplicate.jpg",
        size: 1024,
        data: file2Data,
      })
      const context = createMockPluginContext([existingFile])

      await expect(validator.hooks.validate!(newFile, context)).rejects.toEqual({
        message: customMessage,
        details: { fileName: "duplicate.jpg" },
      })
    })

    it("should have correct plugin ID", () => {
      const validator = ValidatorDuplicateFile({})

      expect(validator.id).toBe("validator-duplicate-file")
    })
  })

  describe("lastModified detection", () => {
    it("should detect duplicate by lastModified when File objects are used", async () => {
      const validator = ValidatorDuplicateFile({})
      const lastModified = Date.now()

      const file1Data = createMockFile("test.jpg", 1024, "image/jpeg", lastModified)
      const file2Data = createMockFile("test.jpg", 1024, "image/jpeg", lastModified)

      const existingFile = createMockLocalUploadFile({
        name: "test.jpg",
        size: 1024,
        data: file1Data,
      })
      const newFile = createMockLocalUploadFile({
        name: "test.jpg",
        size: 1024,
        data: file2Data,
      })
      const context = createMockPluginContext([existingFile])

      await expect(validator.hooks.validate!(newFile, context)).rejects.toEqual({
        message: "This file has already been added",
        details: { fileName: "test.jpg" },
      })
    })

    it("should allow files with same name/size but different lastModified", async () => {
      const validator = ValidatorDuplicateFile({})

      const file1Data = createMockFile("test.jpg", 1024, "image/jpeg", Date.now() - 1000)
      const file2Data = createMockFile("test.jpg", 1024, "image/jpeg", Date.now())

      const existingFile = createMockLocalUploadFile({
        name: "test.jpg",
        size: 1024,
        data: file1Data,
      })
      const newFile = createMockLocalUploadFile({
        name: "test.jpg",
        size: 1024,
        data: file2Data,
      })
      const context = createMockPluginContext([existingFile])

      const result = await validator.hooks.validate!(newFile, context)

      expect(result).toBe(newFile)
    })
  })

  describe("multiple existing files", () => {
    it("should check against all existing files", async () => {
      const validator = ValidatorDuplicateFile({})
      const lastModified = Date.now()

      const existingFiles = [
        createMockLocalUploadFile({ name: "file1.jpg", size: 1000, data: createMockFile("file1.jpg", 1000) }),
        createMockLocalUploadFile({ name: "file2.jpg", size: 2000, data: createMockFile("file2.jpg", 2000) }),
        createMockLocalUploadFile({
          name: "file3.jpg",
          size: 3000,
          data: createMockFile("file3.jpg", 3000, "image/jpeg", lastModified),
        }),
      ]

      const duplicateOfThird = createMockLocalUploadFile({
        name: "file3.jpg",
        size: 3000,
        data: createMockFile("file3.jpg", 3000, "image/jpeg", lastModified),
      })
      const context = createMockPluginContext(existingFiles)

      await expect(validator.hooks.validate!(duplicateOfThird, context)).rejects.toEqual({
        message: "This file has already been added",
        details: { fileName: "file3.jpg" },
      })
    })

    it("should allow file if no duplicates in list", async () => {
      const validator = ValidatorDuplicateFile({})
      const existingFiles = [
        createMockLocalUploadFile({ name: "file1.jpg", size: 1000 }),
        createMockLocalUploadFile({ name: "file2.jpg", size: 2000 }),
        createMockLocalUploadFile({ name: "file3.jpg", size: 3000 }),
      ]

      const uniqueFile = createMockLocalUploadFile({ name: "unique.jpg", size: 5000 })
      const context = createMockPluginContext(existingFiles)

      const result = await validator.hooks.validate!(uniqueFile, context)

      expect(result).toBe(uniqueFile)
    })
  })

  describe("edge cases", () => {
    it("should allow first file (empty existing list)", async () => {
      const validator = ValidatorDuplicateFile({})
      const newFile = createMockLocalUploadFile({ name: "first.jpg" })
      const context = createMockPluginContext([])

      const result = await validator.hooks.validate!(newFile, context)

      expect(result).toBe(newFile)
    })

    it("should handle files with Blob data (no lastModified)", async () => {
      const validator = ValidatorDuplicateFile({})
      const blob = new Blob([new Uint8Array(1024)], { type: "image/jpeg" })

      const existingFile = createMockLocalUploadFile({
        name: "test.jpg",
        size: 1024,
        data: blob,
      })
      const newFile = createMockLocalUploadFile({
        name: "test.jpg",
        size: 1024,
        data: blob,
      })
      const context = createMockPluginContext([existingFile])

      // Blobs don't have lastModified, so sameDate defaults to true
      await expect(validator.hooks.validate!(newFile, context)).rejects.toEqual({
        message: "This file has already been added",
        details: { fileName: "test.jpg" },
      })
    })

    it("should handle mixed File and Blob data", async () => {
      const validator = ValidatorDuplicateFile({})
      const blob = new Blob([new Uint8Array(1024)], { type: "image/jpeg" })
      const file = createMockFile("test.jpg", 1024, "image/jpeg")

      const existingFile = createMockLocalUploadFile({
        name: "test.jpg",
        size: 1024,
        data: blob,
      })
      const newFile = createMockLocalUploadFile({
        name: "test.jpg",
        size: 1024,
        data: file,
      })
      const context = createMockPluginContext([existingFile])

      // Mixed types: if one is not a File, sameDate defaults to true
      await expect(validator.hooks.validate!(newFile, context)).rejects.toEqual({
        message: "This file has already been added",
        details: { fileName: "test.jpg" },
      })
    })

    it("should handle empty filename", async () => {
      const validator = ValidatorDuplicateFile({})
      const existingFile = createMockLocalUploadFile({ name: "", size: 1024 })
      const newFile = createMockLocalUploadFile({ name: "", size: 1024 })
      const context = createMockPluginContext([existingFile])

      await expect(validator.hooks.validate!(newFile, context)).rejects.toEqual({
        message: "This file has already been added",
        details: { fileName: "" },
      })
    })
  })
})
