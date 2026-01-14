import { defineUploaderPlugin } from "../types"

interface ValidatorDuplicateFileOptions {
  /**
   * Whether to allow duplicate files
   * @default false
   */
  allowDuplicates?: boolean
  /**
   * Custom error message for duplicates
   */
  errorMessage?: string
}

export const ValidatorDuplicateFile = defineUploaderPlugin<ValidatorDuplicateFileOptions>((options) => {
  const { allowDuplicates = false, errorMessage = "This file has already been added" } = options

  return {
    id: "validator-duplicate-file",
    hooks: {
      validate: async (file, context) => {
        if (allowDuplicates) {
          return file
        }

        // Check for duplicates based on name, size, and lastModified
        const isDuplicate = context.files.some((existingFile) => {
          const sameSize = existingFile.size === file.size
          const sameName = existingFile.name === file.name

          // For File objects, also check lastModified if available
          let sameDate = true
          if (file.data instanceof File && existingFile.data instanceof File) {
            sameDate = existingFile.data.lastModified === file.data.lastModified
          }

          return sameSize && sameName && sameDate
        })

        if (isDuplicate) {
          throw { message: errorMessage, details: { fileName: file.name } }
        }

        return file
      },
    },
  }
})
