import { defineProcessingPlugin } from "../types"

interface ValidatorAllowedFileTypesOptions {
  allowedFileTypes?: string[]
}

export const ValidatorAllowedFileTypes = defineProcessingPlugin<ValidatorAllowedFileTypesOptions>((options) => {
  return {
    id: "validator-allowed-file-types",
    hooks: {
      validate: async (file, _context) => {
        // Allow all files if no allowedFileTypes specified or empty array
        if (!options.allowedFileTypes || options.allowedFileTypes.length === 0) {
          return file
        }

        // Check if file type is in allowed list
        if (options.allowedFileTypes.includes(file.mimeType)) {
          return file
        }

        throw { message: `File type ${file.mimeType} is not allowed` }
      },
    },
  }
})
