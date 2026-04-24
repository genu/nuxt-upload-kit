import { describe, it, expect } from "vitest"
import type { H3Event } from "h3"
import { MaxFileSize } from "../../../src/runtime/server/validators/max-file-size"
import { AllowedMimeTypes } from "../../../src/runtime/server/validators/allowed-mime-types"

const ctx = { event: {} as H3Event, auth: {} }

describe("MaxFileSize", () => {
  it("passes files at or below the limit", () => {
    const validate = MaxFileSize(1000)
    expect(() => validate({ name: "a", size: 1000, mimeType: "image/png" }, ctx)).not.toThrow()
  })

  it("throws 413 for oversized files", () => {
    const validate = MaxFileSize(1000)
    expect(() => validate({ name: "big.png", size: 1001, mimeType: "image/png" }, ctx)).toThrow(/exceeds the 1000-byte limit/)
  })
})

describe("AllowedMimeTypes", () => {
  it("accepts exact matches", () => {
    const validate = AllowedMimeTypes(["image/png"])
    expect(() => validate({ name: "a", size: 1, mimeType: "image/png" }, ctx)).not.toThrow()
  })

  it("accepts wildcard prefix matches", () => {
    const validate = AllowedMimeTypes(["image/*"])
    expect(() => validate({ name: "a", size: 1, mimeType: "image/jpeg" }, ctx)).not.toThrow()
  })

  it("rejects mismatches with 415", () => {
    const validate = AllowedMimeTypes(["image/*"])
    expect(() => validate({ name: "doc.pdf", size: 1, mimeType: "application/pdf" }, ctx)).toThrow(/disallowed type/)
  })
})
