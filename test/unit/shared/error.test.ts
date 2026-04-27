import { describe, expect, it } from "vitest"
import { RestrictionError } from "../../../src/runtime/shared/error"

describe("RestrictionError", () => {
  it("carries code, meta, and message from the violation", () => {
    const err = new RestrictionError({
      code: "max-file-size",
      message: "too big",
      meta: { maxBytes: 100 },
    })
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe("RestrictionError")
    expect(err.message).toBe("too big")
    expect(err.code).toBe("max-file-size")
    expect(err.meta).toEqual({ maxBytes: 100 })
  })
})
