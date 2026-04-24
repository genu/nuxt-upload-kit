import { describe, it, expect, vi, beforeEach } from "vitest"
import { createError } from "h3"
import type { StorageAdapter, UploadServerConfig } from "../../../src/runtime/server/types"

let userConfig: UploadServerConfig

vi.mock("#upload-kit-user-config", () => ({
  get default() {
    return userConfig
  },
}))

const stubStorage = (): StorageAdapter & {
  put: ReturnType<typeof vi.fn>
  resolveKey: ReturnType<typeof vi.fn>
} => ({
  id: "stub",
  presignUpload: vi.fn(),
  resolveKey: vi.fn((input) => `uploads/${input.fileId}`),
  put: vi.fn(async (input) => ({ publicUrl: `https://cdn/${input.key}` })),
})

const callHandler = async () => {
  const mod = await import("../../../src/runtime/server/handlers/direct")
  return mod.default
}

const fakeEvent = (headers: Record<string, string> = {}) =>
  ({
    node: { req: { method: "POST", headers: { "content-type": "multipart/form-data", ...headers } } },
    context: {},
  }) as unknown as Parameters<Awaited<ReturnType<typeof callHandler>>>[0]

const mockMultipart = (parts: Array<{ name: string; filename?: string; type?: string; data: Buffer }>) => {
  vi.doMock("h3", async (importOriginal) => {
    const actual = await importOriginal<typeof import("h3")>()
    return {
      ...actual,
      readMultipartFormData: async () => parts,
      getRequestHeader: (event: { node: { req: { headers: Record<string, string> } } }, name: string) =>
        event.node.req.headers[name.toLowerCase()],
    }
  })
}

beforeEach(() => {
  vi.resetModules()
  vi.doUnmock("h3")
})

describe("direct handler", () => {
  it("authorizes, validates, puts, then runs afterUpload", async () => {
    const order: string[] = []
    const storage = stubStorage()
    storage.put.mockImplementation(async (input) => {
      order.push("put")
      return { publicUrl: `https://cdn/${input.key}` }
    })
    userConfig = {
      storage,
      authorize: vi.fn(async () => {
        order.push("authorize")
        return { userId: "u1" }
      }),
      validators: [
        () => {
          order.push("validate")
        },
      ],
      hooks: {
        afterUpload: vi.fn(async () => {
          order.push("afterUpload")
        }),
      },
    }

    mockMultipart([{ name: "file", filename: "photo.png", type: "image/png", data: Buffer.from("pixels") }])

    const handler = await callHandler()
    const result = await handler(fakeEvent())

    expect(order).toEqual(["authorize", "validate", "put", "afterUpload"])
    expect(storage.resolveKey).toHaveBeenCalled()
    expect(storage.put).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.any(Buffer), contentType: "image/png", key: expect.stringMatching(/^uploads\//) }),
      expect.objectContaining({ auth: { userId: "u1" } }),
    )
    expect(result).toMatchObject({
      publicUrl: expect.stringMatching(/^https:\/\/cdn\//),
      fileId: expect.stringMatching(/^uploads\//),
    })
  })

  it("propagates validator errors before putting", async () => {
    const storage = stubStorage()
    userConfig = {
      storage,
      validators: [
        () => {
          throw createError({ statusCode: 413, message: "too big" })
        },
      ],
    }

    mockMultipart([{ name: "file", filename: "big.bin", type: "application/octet-stream", data: Buffer.from("x") }])
    const handler = await callHandler()
    await expect(handler(fakeEvent())).rejects.toMatchObject({ statusCode: 413 })
    expect(storage.put).not.toHaveBeenCalled()
  })

  it("propagates authorize errors before putting", async () => {
    const storage = stubStorage()
    userConfig = {
      storage,
      authorize: async () => {
        throw createError({ statusCode: 401, message: "nope" })
      },
    }

    mockMultipart([{ name: "file", filename: "f.bin", type: "application/octet-stream", data: Buffer.from("x") }])
    const handler = await callHandler()
    await expect(handler(fakeEvent())).rejects.toMatchObject({ statusCode: 401 })
    expect(storage.put).not.toHaveBeenCalled()
  })

  it("rejects when multipart has no file part", async () => {
    userConfig = { storage: stubStorage() }
    mockMultipart([{ name: "notfile", data: Buffer.from("x") }])
    const handler = await callHandler()
    await expect(handler(fakeEvent())).rejects.toMatchObject({ statusCode: 400 })
  })

  it("returns 501 when the adapter does not implement put", async () => {
    userConfig = { storage: { id: "stub", presignUpload: vi.fn() } }
    mockMultipart([{ name: "file", filename: "f.bin", type: "application/octet-stream", data: Buffer.from("x") }])
    const handler = await callHandler()
    await expect(handler(fakeEvent())).rejects.toMatchObject({ statusCode: 501 })
  })

  it("returns 500 when storage is not configured", async () => {
    userConfig = {}
    mockMultipart([{ name: "file", filename: "f.bin", type: "application/octet-stream", data: Buffer.from("x") }])
    const handler = await callHandler()
    await expect(handler(fakeEvent())).rejects.toMatchObject({ statusCode: 500 })
  })

  it("rejects with 413 when Content-Length exceeds maxBodySize, before authorize/read", async () => {
    const storage = stubStorage()
    const authorize = vi.fn(async () => ({}))
    userConfig = { storage, authorize, maxBodySize: 100 }

    mockMultipart([{ name: "file", filename: "big.bin", type: "application/octet-stream", data: Buffer.from("x") }])
    const handler = await callHandler()
    await expect(handler(fakeEvent({ "content-length": "500" }))).rejects.toMatchObject({ statusCode: 413 })
    expect(authorize).not.toHaveBeenCalled()
    expect(storage.put).not.toHaveBeenCalled()
  })

  it("passes when Content-Length is within maxBodySize", async () => {
    const storage = stubStorage()
    userConfig = { storage, maxBodySize: 1000 }

    mockMultipart([{ name: "file", filename: "small.png", type: "image/png", data: Buffer.from("pix") }])
    const handler = await callHandler()
    const result = await handler(fakeEvent({ "content-length": "50" }))
    expect(result.fileId).toMatch(/^uploads\//)
  })

  it("falls back to uploads/{fileId} when adapter has no resolveKey", async () => {
    const storage: StorageAdapter & { put: ReturnType<typeof vi.fn> } = {
      id: "stub",
      presignUpload: vi.fn(),
      put: vi.fn(async (input) => ({ publicUrl: `https://cdn/${input.key}` })),
    }
    userConfig = { storage }
    mockMultipart([{ name: "file", filename: "a.png", type: "image/png", data: Buffer.from("pix") }])
    const handler = await callHandler()
    const result = await handler(fakeEvent())
    expect(storage.put).toHaveBeenCalledWith(
      expect.objectContaining({ key: expect.stringMatching(/^uploads\//) }),
      expect.anything(),
    )
    expect(result.fileId).toMatch(/^uploads\//)
  })
})
