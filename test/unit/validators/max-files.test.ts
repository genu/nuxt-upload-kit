import { describe, it, expect } from "vitest"
import { ValidatorMaxFiles } from "../../../src/runtime/composables/useUploadKit/validators/max-files"
import { createMockLocalUploadFile, createMockPluginContext } from "../../helpers"

describe("ValidatorMaxFiles", () => {
  describe("validate hook", () => {
    it("should allow file when under max limit", async () => {
      const validator = ValidatorMaxFiles({ maxFiles: 5 })
      const file = createMockLocalUploadFile()
      const context = createMockPluginContext([createMockLocalUploadFile(), createMockLocalUploadFile()]) // 2 existing files

      const result = await validator.hooks.validate!(file, context)

      expect(result).toBe(file)
    })

    it("should allow file when at max limit minus one", async () => {
      const validator = ValidatorMaxFiles({ maxFiles: 3 })
      const file = createMockLocalUploadFile()
      const context = createMockPluginContext([createMockLocalUploadFile(), createMockLocalUploadFile()]) // 2 existing files, adding 1 more = 3 total

      const result = await validator.hooks.validate!(file, context)

      expect(result).toBe(file)
    })

    it("should reject file when at max limit", async () => {
      const validator = ValidatorMaxFiles({ maxFiles: 2 })
      const file = createMockLocalUploadFile()
      const context = createMockPluginContext([createMockLocalUploadFile(), createMockLocalUploadFile()]) // Already at limit

      await expect(validator.hooks.validate!(file, context)).rejects.toEqual({
        message: "Maximum number of files (2) exceeded",
      })
    })

    it("should reject file when over max limit", async () => {
      const validator = ValidatorMaxFiles({ maxFiles: 1 })
      const file = createMockLocalUploadFile()
      const context = createMockPluginContext([
        createMockLocalUploadFile(),
        createMockLocalUploadFile(),
        createMockLocalUploadFile(),
      ]) // 3 existing files

      await expect(validator.hooks.validate!(file, context)).rejects.toEqual({
        message: "Maximum number of files (1) exceeded",
      })
    })

    it("should allow all files when maxFiles is undefined", async () => {
      const validator = ValidatorMaxFiles({})
      const file = createMockLocalUploadFile()
      const context = createMockPluginContext([
        createMockLocalUploadFile(),
        createMockLocalUploadFile(),
        createMockLocalUploadFile(),
      ])

      const result = await validator.hooks.validate!(file, context)

      expect(result).toBe(file)
    })

    it("should allow all files when maxFiles is Infinity", async () => {
      const validator = ValidatorMaxFiles({ maxFiles: Infinity })
      const file = createMockLocalUploadFile()
      const context = createMockPluginContext([
        createMockLocalUploadFile(),
        createMockLocalUploadFile(),
        createMockLocalUploadFile(),
      ])

      const result = await validator.hooks.validate!(file, context)

      expect(result).toBe(file)
    })

    it("should allow first file when maxFiles is 1", async () => {
      const validator = ValidatorMaxFiles({ maxFiles: 1 })
      const file = createMockLocalUploadFile()
      const context = createMockPluginContext([]) // Empty list

      const result = await validator.hooks.validate!(file, context)

      expect(result).toBe(file)
    })

    it("should have correct plugin ID", () => {
      const validator = ValidatorMaxFiles({ maxFiles: 5 })

      expect(validator.id).toBe("validator-max-files")
    })
  })

  describe("edge cases", () => {
    it("should handle maxFiles of 0", async () => {
      const validator = ValidatorMaxFiles({ maxFiles: 0 })
      const file = createMockLocalUploadFile()
      const context = createMockPluginContext([])

      // maxFiles: 0 means no files allowed
      await expect(validator.hooks.validate!(file, context)).rejects.toEqual({
        message: "Maximum number of files (0) exceeded",
      })
    })

    it("should handle negative maxFiles by rejecting", async () => {
      const validator = ValidatorMaxFiles({ maxFiles: -1 })
      const file = createMockLocalUploadFile()
      const context = createMockPluginContext([])

      // Negative value should effectively disable uploads
      await expect(validator.hooks.validate!(file, context)).rejects.toEqual({
        message: "Maximum number of files (-1) exceeded",
      })
    })
  })
})
