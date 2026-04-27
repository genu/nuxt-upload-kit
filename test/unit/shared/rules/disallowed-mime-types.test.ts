import { describe, expect, it } from "vitest"
import { disallowedMimeTypesRule } from "../../../../src/runtime/shared/rules/disallowed-mime-types"

const file = (type: string) => ({ name: "f", size: 100, type })
const ctx = { existingCount: 0, existingTotalSize: 0 }

describe("disallowedMimeTypesRule", () => {
  it("returns null when patterns are undefined or empty", () => {
    expect(disallowedMimeTypesRule(undefined)(file("image/jpeg"), ctx)).toBeNull()
    expect(disallowedMimeTypesRule([])(file("image/jpeg"), ctx)).toBeNull()
  })

  it("returns null when MIME does not match any pattern", () => {
    expect(disallowedMimeTypesRule(["application/x-msdownload"])(file("image/jpeg"), ctx)).toBeNull()
  })

  it("returns violation when MIME matches", () => {
    const v = disallowedMimeTypesRule(["application/*"])(file("application/pdf"), ctx)
    expect(v?.code).toBe("disallowed-mime-types")
    expect(v?.meta).toMatchObject({ fileType: "application/pdf", disallowed: ["application/*"] })
  })
})
