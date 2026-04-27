import { describe, expect, it } from "vitest"
import { minFileSizeRule } from "../../../../src/runtime/shared/rules/min-file-size"

const file = (size: number) => ({ name: "f.jpg", size, type: "image/jpeg" })
const ctx = { existingCount: 0, existingTotalSize: 0 }

describe("minFileSizeRule", () => {
  it("returns null when undefined or zero", () => {
    expect(minFileSizeRule(undefined)(file(0), ctx)).toBeNull()
    expect(minFileSizeRule(0)(file(0), ctx)).toBeNull()
  })

  it("returns null when at or above minimum", () => {
    expect(minFileSizeRule(100)(file(100), ctx)).toBeNull()
    expect(minFileSizeRule(100)(file(200), ctx)).toBeNull()
  })

  it("returns violation when below minimum", () => {
    const v = minFileSizeRule(100)(file(50), ctx)
    expect(v?.code).toBe("min-file-size")
    expect(v?.meta).toEqual({ minBytes: 100, actual: 50, fileName: "f.jpg" })
  })
})
