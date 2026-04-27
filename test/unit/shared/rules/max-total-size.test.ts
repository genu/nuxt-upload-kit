import { describe, expect, it } from "vitest"
import { maxTotalSizeRule } from "../../../../src/runtime/shared/rules/max-total-size"

const file = (size: number) => ({ name: "f.jpg", size, type: "image/jpeg" })

describe("maxTotalSizeRule", () => {
  it("returns null when undefined", () => {
    expect(maxTotalSizeRule(undefined)(file(1000), { existingCount: 0, existingTotalSize: 0 })).toBeNull()
  })

  it("returns null when projected total is within limit", () => {
    expect(maxTotalSizeRule(1000)(file(400), { existingCount: 1, existingTotalSize: 600 })).toBeNull()
  })

  it("returns violation when projected total exceeds limit", () => {
    const v = maxTotalSizeRule(1000)(file(500), { existingCount: 1, existingTotalSize: 600 })
    expect(v?.code).toBe("max-total-size")
    expect(v?.meta).toMatchObject({ maxTotal: 1000, projected: 1100, existingTotalSize: 600, fileSize: 500 })
  })
})
