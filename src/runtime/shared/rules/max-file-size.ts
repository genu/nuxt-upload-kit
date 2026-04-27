import type { Rule } from "../types"

export const maxFileSizeRule =
  (maxBytes: number | undefined): Rule =>
  (file) => {
    if (maxBytes === undefined || maxBytes === Infinity) return null
    if (file.size <= maxBytes) return null
    return {
      code: "max-file-size",
      message: `File "${file.name}" (${file.size} bytes) exceeds the ${maxBytes}-byte limit.`,
      meta: { maxBytes, actual: file.size, fileName: file.name },
    }
  }
