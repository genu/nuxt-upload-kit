import { defineProcessingPlugin } from "../types"

interface ValidatorMaxFileSizeOptions {
  maxFileSize?: number
}

export const ValidatorMaxFileSize = defineProcessingPlugin<ValidatorMaxFileSizeOptions>((options) => {
  return {
    id: "validator-max-file-size",
    hooks: {
      validate: async (file, _context) => {
        // Allow all files if no maxFileSize specified or Infinity
        if (!options.maxFileSize || options.maxFileSize === Infinity) {
          return file
        }

        // Check if file size is within limit
        if (file.size <= options.maxFileSize) {
          return file
        }

        throw { message: `File size exceeds the maximum limit of ${options.maxFileSize} bytes` }
      },
    },
  }
})
