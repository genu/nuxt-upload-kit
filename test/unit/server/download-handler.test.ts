import { describe, it, expect, vi, beforeEach } from "vitest"
import { createError } from "h3"
import type { StorageAdapter, UploadServerConfig } from "../../../src/runtime/server/types"

let userConfig: UploadServerConfig

vi.mock("#upload-kit-user-config", () => ({
  get default() {
    return userConfig
  },
}))

const stubStorage = (): StorageAdapter & { presignDownload: ReturnType<typeof vi.fn> } => ({
  id: "stub",
  presignUpload: vi.fn(),
  presignDownload: vi.fn(async (key: string) => ({ downloadUrl: `https://signed/${key}` })),
})

const callHandler = async () => {
  const mod = await import("../../../src/runtime/server/handlers/download")
  return mod.default
}

const fakeEvent = (fileId: string) =>
  ({
    node: { req: { method: "GET", headers: {} } },
    context: { params: { fileId } },
  }) as unknown as Parameters<Awaited<ReturnType<typeof callHandler>>>[0]

beforeEach(() => {
  vi.resetModules()
})

describe("download handler", () => {
  it("authorizes, then presigns a download URL", async () => {
    const storage = stubStorage()
    const authorize = vi.fn(async () => ({ userId: "u1" }))
    userConfig = { storage, authorize }

    const handler = await callHandler()
    const result = await handler(fakeEvent("uploads%2Fabc.png"))

    expect(authorize).toHaveBeenCalledWith(expect.anything(), { type: "presign-download", key: "uploads/abc.png" })
    expect(storage.presignDownload).toHaveBeenCalledWith("uploads/abc.png", expect.objectContaining({ auth: { userId: "u1" } }))
    expect(result).toEqual({ downloadUrl: "https://signed/uploads/abc.png" })
  })

  it("propagates authorize errors before presigning", async () => {
    const storage = stubStorage()
    userConfig = {
      storage,
      authorize: async () => {
        throw createError({ statusCode: 403, message: "nope" })
      },
    }

    const handler = await callHandler()
    await expect(handler(fakeEvent("abc"))).rejects.toMatchObject({ statusCode: 403 })
    expect(storage.presignDownload).not.toHaveBeenCalled()
  })

  it("returns 400 when fileId is malformed URL encoding", async () => {
    const storage = stubStorage()
    userConfig = { storage }
    const handler = await callHandler()
    await expect(handler(fakeEvent("%E0%A4%A"))).rejects.toMatchObject({ statusCode: 400 })
    expect(storage.presignDownload).not.toHaveBeenCalled()
  })

  it("returns 400 when fileId is missing", async () => {
    userConfig = { storage: stubStorage() }
    const handler = await callHandler()
    await expect(
      handler({ node: { req: { method: "GET", headers: {} } }, context: { params: {} } } as never),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it("returns 501 when the adapter doesn't implement presignDownload", async () => {
    userConfig = { storage: { id: "stub", presignUpload: vi.fn() } }
    const handler = await callHandler()
    await expect(handler(fakeEvent("abc"))).rejects.toMatchObject({ statusCode: 501 })
  })

  it("returns 500 when storage is not configured", async () => {
    userConfig = {}
    const handler = await callHandler()
    await expect(handler(fakeEvent("abc"))).rejects.toMatchObject({ statusCode: 500 })
  })
})
