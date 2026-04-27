import type { Rule } from "../types"
import { matchesMimeType } from "./mime"

export const disallowedMimeTypesRule = (patterns: string[] | undefined): Rule => {
  if (!patterns || patterns.length === 0) return () => null
  return (file) => {
    const blocked = patterns.some((p) => matchesMimeType(file.type, p))
    if (!blocked) return null
    return {
      code: "disallowed-mime-types",
      message: `File type "${file.type}" is not allowed.`,
      meta: { fileType: file.type, disallowed: patterns, fileName: file.name },
    }
  }
}
