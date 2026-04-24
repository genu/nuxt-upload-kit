import { createError } from "h3"
import type { ServerValidator } from "../types"

const matches = (mimeType: string, pattern: string): boolean => {
  if (pattern === mimeType) return true
  if (pattern.endsWith("/*")) {
    const prefix = pattern.slice(0, -1)
    return mimeType.startsWith(prefix)
  }
  return false
}

export const AllowedMimeTypes = (patterns: string[]): ServerValidator => {
  return (file) => {
    if (!patterns.some((p) => matches(file.mimeType, p))) {
      throw createError({
        statusCode: 415,
        statusMessage: "Unsupported Media Type",
        message: `File "${file.name}" has disallowed type "${file.mimeType}". Allowed: ${patterns.join(", ")}.`,
      })
    }
  }
}
