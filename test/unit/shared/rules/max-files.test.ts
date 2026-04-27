import { describe, expect, it } from "vitest"
import { maxFilesRule } from "../../../../src/runtime/shared/rules/max-files"

const file = { name: "f.jpg", size: 1000, type: "image/jpeg" }

describe("maxFilesRule", () => {
  it("returns null when undefined or Infinity", () => {
    expect(maxFilesRule(undefined)(file, { existingCount: 999, existingTotalSize: 0 })).toBeNull()
    expect(maxFilesRule(Infinity)(file, { existingCount: 999, existingTotalSize: 0 })).toBeNull()
  })

  it("returns null when under the limit", () => {
    expect(maxFilesRule(5)(file, { existingCount: 4, existingTotalSize: 0 })).toBeNull()
  })

  it("returns violation when at the limit", () => {
    const v = maxFilesRule(5)(file, { existingCount: 5, existingTotalSize: 0 })
    expect(v?.code).toBe("max-files")
    expect(v?.meta).toEqual({ maxFiles: 5, existingCount: 5 })
  })
})
