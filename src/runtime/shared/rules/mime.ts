export function matchesMimeType(mimeType: string, pattern: string): boolean {
  const m = mimeType.toLowerCase()
  const p = pattern.toLowerCase()
  if (p === "*/*") return true
  if (p === m) return true
  if (p.endsWith("/*")) return m.startsWith(p.slice(0, -1))
  return false
}
