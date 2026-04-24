import { createError } from "h3"
import type { ServerValidator } from "../types"

const matches = (mimeType: string, pattern: string): boolean => {
  if (pattern === mimeType) return true
  if (pattern.endsWith("/*")) return mimeType.startsWith(pattern.slice(0, -1))
  return false
}

export const AllowedMimeTypes = (patterns: string[]): ServerValidator => {
  // RFC 2045/6838: MIME types are case-insensitive. Normalize once at construction.
  const normalized = patterns.map((p) => p.toLowerCase())
  return (file) => {
    const mime = file.mimeType.toLowerCase()
    if (!normalized.some((p) => matches(mime, p))) {
      throw createError({
        statusCode: 415,
        statusMessage: "Unsupported Media Type",
        message: `File "${file.name}" has disallowed type "${file.mimeType}". Allowed: ${patterns.join(", ")}.`,
      })
    }
  }
}
