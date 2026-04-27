import type { Rule } from "../types"

export const maxFilesRule =
  (maxFiles: number | undefined): Rule =>
  (_file, ctx) => {
    if (maxFiles === undefined || maxFiles === Infinity) return null
    if (ctx.existingCount < maxFiles) return null
    return {
      code: "max-files",
      message: `Maximum number of files (${maxFiles}) exceeded.`,
      meta: { maxFiles, existingCount: ctx.existingCount },
    }
  }
