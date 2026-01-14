import { defineProcessingPlugin } from "../types"

interface ValidatorMaxFilesOptions {
  maxFiles?: number
}

export const ValidatorMaxFiles = defineProcessingPlugin<ValidatorMaxFilesOptions>((options) => {
  return {
    id: "validator-max-files",
    hooks: {
      validate: async (file, context) => {
        // Allow all files if no maxFiles specified or Infinity
        if (options.maxFiles === undefined || options.maxFiles === Infinity) {
          return file
        }

        // Check if adding this file would exceed the limit
        if (context.files.length < options.maxFiles) {
          return file
        }

        throw { message: `Maximum number of files (${options.maxFiles}) exceeded` }
      },
    },
  }
})
