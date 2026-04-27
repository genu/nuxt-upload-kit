import type { Rule } from "../types"
import { matchesMimeType } from "./mime"

export const allowedMimeTypesRule = (patterns: string[] | undefined): Rule => {
  if (!patterns || patterns.length === 0) return () => null
  return (file) => {
    const ok = patterns.some((p) => matchesMimeType(file.type, p))
    if (ok) return null
    return {
      code: "allowed-mime-types",
      message: `File type "${file.type}" is not allowed. Allowed: ${patterns.join(", ")}.`,
      meta: { fileType: file.type, allowed: patterns, fileName: file.name },
    }
  }
}
