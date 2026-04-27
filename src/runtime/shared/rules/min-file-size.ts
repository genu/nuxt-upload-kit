import type { Rule } from "../types"

export const minFileSizeRule =
  (minBytes: number | undefined): Rule =>
  (file) => {
    if (minBytes === undefined || minBytes <= 0) return null
    if (file.size >= minBytes) return null
    return {
      code: "min-file-size",
      message: `File "${file.name}" (${file.size} bytes) is below the ${minBytes}-byte minimum.`,
      meta: { minBytes, actual: file.size, fileName: file.name },
    }
  }
