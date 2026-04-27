import { describe, expect, it } from "vitest"
import { applyRestrictions } from "../../../../src/runtime/shared/rules/apply"

const file = (overrides: Partial<{ name: string; size: number; type: string }> = {}) => ({
  name: "f.jpg",
  size: 1000,
  type: "image/jpeg",
  ...overrides,
})
const ctx = { existingCount: 0, existingTotalSize: 0 }

describe("applyRestrictions", () => {
  it("returns null when no restrictions are set", () => {
    expect(applyRestrictions(file(), ctx, {})).toBeNull()
  })

  it("returns null when file passes all rules", () => {
    expect(
      applyRestrictions(file({ size: 500 }), ctx, {
        maxFileSize: 1000,
        maxFiles: 10,
        allowedMimeTypes: ["image/*"],
      }),
    ).toBeNull()
  })

  it("returns the first violation in priority order (max-files before max-file-size)", () => {
    const v = applyRestrictions(
      file({ size: 5000 }),
      { existingCount: 10, existingTotalSize: 0 },
      { maxFiles: 10, maxFileSize: 1000 },
    )
    expect(v?.code).toBe("max-files")
  })

  it("returns max-file-size violation when only that rule fails", () => {
    const v = applyRestrictions(file({ size: 5000 }), ctx, { maxFileSize: 1000 })
    expect(v?.code).toBe("max-file-size")
  })

  it("returns allowed-mime-types violation for disallowed type", () => {
    const v = applyRestrictions(file({ type: "application/pdf" }), ctx, { allowedMimeTypes: ["image/*"] })
    expect(v?.code).toBe("allowed-mime-types")
  })

  it("returns disallowed-mime-types violation when blocked", () => {
    const v = applyRestrictions(file({ type: "application/x-msdownload" }), ctx, {
      disallowedMimeTypes: ["application/x-msdownload"],
    })
    expect(v?.code).toBe("disallowed-mime-types")
  })

  it("enforces max-total-size based on existing total + new file", () => {
    const v = applyRestrictions(file({ size: 500 }), { existingCount: 1, existingTotalSize: 700 }, { maxTotalSize: 1000 })
    expect(v?.code).toBe("max-total-size")
  })
})
