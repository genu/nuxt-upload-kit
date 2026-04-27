import { describe, expect, it } from "vitest"
import { maxFileSizeRule } from "../../../../src/runtime/shared/rules/max-file-size"

const file = (size: number) => ({ name: "f.jpg", size, type: "image/jpeg" })
const ctx = { existingCount: 0, existingTotalSize: 0 }

describe("maxFileSizeRule", () => {
  it("returns null when undefined", () => {
    expect(maxFileSizeRule(undefined)(file(1000), ctx)).toBeNull()
  })

  it("returns null when Infinity", () => {
    expect(maxFileSizeRule(Infinity)(file(1_000_000), ctx)).toBeNull()
  })

  it("returns null when file size is at or below limit", () => {
    expect(maxFileSizeRule(1000)(file(1000), ctx)).toBeNull()
    expect(maxFileSizeRule(1000)(file(999), ctx)).toBeNull()
  })

  it("returns violation when file exceeds limit", () => {
    const v = maxFileSizeRule(1000)(file(2000), ctx)
    expect(v).not.toBeNull()
    expect(v?.code).toBe("max-file-size")
    expect(v?.meta).toEqual({ maxBytes: 1000, actual: 2000, fileName: "f.jpg" })
  })
})
