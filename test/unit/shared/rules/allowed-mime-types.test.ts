import { describe, expect, it } from "vitest"
import { allowedMimeTypesRule } from "../../../../src/runtime/shared/rules/allowed-mime-types"

const file = (type: string) => ({ name: "f", size: 100, type })
const ctx = { existingCount: 0, existingTotalSize: 0 }

describe("allowedMimeTypesRule", () => {
  it("returns null when patterns are undefined or empty", () => {
    expect(allowedMimeTypesRule(undefined)(file("image/jpeg"), ctx)).toBeNull()
    expect(allowedMimeTypesRule([])(file("image/jpeg"), ctx)).toBeNull()
  })

  it("returns null when MIME matches an exact pattern", () => {
    expect(allowedMimeTypesRule(["image/jpeg", "image/png"])(file("image/jpeg"), ctx)).toBeNull()
  })

  it("returns null when MIME matches a wildcard pattern", () => {
    expect(allowedMimeTypesRule(["image/*"])(file("image/jpeg"), ctx)).toBeNull()
    expect(allowedMimeTypesRule(["image/*", "video/*"])(file("video/mp4"), ctx)).toBeNull()
  })

  it("returns violation when MIME does not match", () => {
    const v = allowedMimeTypesRule(["image/*"])(file("application/pdf"), ctx)
    expect(v?.code).toBe("allowed-mime-types")
    expect(v?.meta).toMatchObject({ fileType: "application/pdf", allowed: ["image/*"] })
  })
})
