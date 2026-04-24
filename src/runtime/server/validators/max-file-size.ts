import { createError } from "h3"
import type { ServerValidator } from "../types"

export const MaxFileSize = (maxBytes: number): ServerValidator => {
  return (file) => {
    if (file.size > maxBytes) {
      throw createError({
        statusCode: 413,
        statusMessage: "Payload Too Large",
        message: `File "${file.name}" (${file.size} bytes) exceeds the ${maxBytes}-byte limit.`,
      })
    }
  }
}
