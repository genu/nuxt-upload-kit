import { describe, expect, it } from "vitest"
import { matchesMimeType } from "../../../../src/runtime/shared/rules/mime"

describe("matchesMimeType", () => {
  it("matches exact MIME types", () => {
    expect(matchesMimeType("image/jpeg", "image/jpeg")).toBe(true)
    expect(matchesMimeType("image/jpeg", "image/png")).toBe(false)
  })

  it("matches wildcard subtypes", () => {
    expect(matchesMimeType("image/jpeg", "image/*")).toBe(true)
    expect(matchesMimeType("video/mp4", "image/*")).toBe(false)
  })

  it("matches universal wildcard", () => {
    expect(matchesMimeType("application/octet-stream", "*/*")).toBe(true)
  })

  it("is case-insensitive", () => {
    expect(matchesMimeType("IMAGE/JPEG", "image/jpeg")).toBe(true)
    expect(matchesMimeType("image/jpeg", "IMAGE/*")).toBe(true)
  })
})
