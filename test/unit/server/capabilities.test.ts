import { describe, expect, it } from "vitest"
import { deriveCapabilities, resolveMode, supportedModes } from "../../../src/runtime/server/capabilities"
import type { StorageAdapter } from "../../../src/runtime/server/types"

const presignOnly: StorageAdapter = {
  id: "presign-only",
  presignUpload: async () => ({ uploadUrl: "u", publicUrl: "p", fileId: "f" }),
}

const serverOnly: StorageAdapter = {
  id: "server-only",
  presignUpload: undefined as never,
  put: async () => ({ publicUrl: "p" }),
} as unknown as StorageAdapter

const both: StorageAdapter = {
  id: "both",
  presignUpload: async () => ({ uploadUrl: "u", publicUrl: "p", fileId: "f" }),
  put: async () => ({ publicUrl: "p" }),
  presignDownload: async () => ({ downloadUrl: "d" }),
  delete: async () => {},
}

describe("deriveCapabilities", () => {
  it("infers presigned-only capability", () => {
    expect(deriveCapabilities(presignOnly)).toEqual({
      presigned: true,
      server: false,
      download: false,
      delete: false,
    })
  })

  it("infers server-only capability", () => {
    expect(deriveCapabilities(serverOnly)).toEqual({
      presigned: false,
      server: true,
      download: false,
      delete: false,
    })
  })

  it("infers all capabilities", () => {
    expect(deriveCapabilities(both)).toEqual({
      presigned: true,
      server: true,
      download: true,
      delete: true,
    })
  })
})

describe("supportedModes", () => {
  it("returns presigned first when both supported", () => {
    expect(supportedModes(deriveCapabilities(both))).toEqual(["presigned", "server"])
  })

  it("returns only server when only server supported", () => {
    expect(supportedModes(deriveCapabilities(serverOnly))).toEqual(["server"])
  })
})

describe("resolveMode", () => {
  it("defaults to presigned when both supported and no preference", () => {
    expect(resolveMode(both, undefined).mode).toBe("presigned")
  })

  it("uses the only supported mode when no preference", () => {
    expect(resolveMode(serverOnly, undefined).mode).toBe("server")
  })

  it("honors explicit preference when supported", () => {
    expect(resolveMode(both, "server").mode).toBe("server")
  })

  it("throws when explicit mode is not supported", () => {
    expect(() => resolveMode(presignOnly, "server")).toThrow(/does not support mode "server"/)
  })

  it("throws when adapter implements neither presignUpload nor put", () => {
    const broken = { id: "broken" } as unknown as StorageAdapter
    expect(() => resolveMode(broken, undefined)).toThrow(/implements no upload mode/)
  })
})
