import { describe, it, expect, vi, beforeEach } from "vitest"
import { createError } from "h3"
import type { StorageAdapter, UploadServerConfig } from "../../../src/runtime/server/types"

let userConfig: UploadServerConfig

vi.mock("#upload-kit-user-config", () => ({
  get default() {
    return userConfig
  },
}))

const stubStorage = (): StorageAdapter & { presignUpload: ReturnType<typeof vi.fn> } => ({
  id: "stub",
  presignUpload: vi.fn(async (input) => ({
    uploadUrl: `https://signed/${input.fileId}`,
    publicUrl: `https://cdn/${input.fileId}`,
    fileId: input.fileId,
  })),
})

const callHandler = async () => {
  const mod = await import("../../../src/runtime/server/handlers/presign")
  return mod.default
}

const fakeEvent = (body: unknown) =>
  ({
    // h3's readBody just unwraps the body off of the event in tests; we satisfy its shape minimally.
    node: { req: { method: "POST", headers: {} } },
    _body: body,
    context: {},
  }) as unknown as Parameters<Awaited<ReturnType<typeof callHandler>>>[0]

beforeEach(() => {
  vi.resetModules()
})

describe("presign handler", () => {
  it("authorizes, validates, runs the hook, then presigns", async () => {
    const order: string[] = []
    const storage = stubStorage()
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
        beforePresign: vi.fn(async () => {
          order.push("beforePresign")
        }),
      },
    }
    storage.presignUpload.mockImplementation(async (input) => {
      order.push("presign")
      return { uploadUrl: "https://u/", publicUrl: "https://p/", fileId: input.fileId }
    })

    // Use h3's eventHandler stub: pass body via readBody mock
    vi.doMock("h3", async (importOriginal) => {
      const actual = await importOriginal<typeof import("h3")>()
      return { ...actual, readBody: async () => ({ file: { name: "a.png", size: 100, mimeType: "image/png" } }) }
    })

    const handler = await callHandler()
    await handler(fakeEvent({ file: { name: "a.png", size: 100, mimeType: "image/png" } }))

    expect(order).toEqual(["authorize", "validate", "beforePresign", "presign"])
    vi.doUnmock("h3")
  })

  it("propagates validator errors before presigning", async () => {
    const storage = stubStorage()
    userConfig = {
      storage,
      validators: [
        () => {
          throw createError({ statusCode: 413, message: "too big" })
        },
      ],
    }

    vi.doMock("h3", async (importOriginal) => {
      const actual = await importOriginal<typeof import("h3")>()
      return { ...actual, readBody: async () => ({ file: { name: "a.png", size: 9999, mimeType: "image/png" } }) }
    })

    const handler = await callHandler()
    await expect(handler(fakeEvent({}))).rejects.toMatchObject({ statusCode: 413 })
    expect(storage.presignUpload).not.toHaveBeenCalled()
    vi.doUnmock("h3")
  })

  it("propagates authorize errors before presigning", async () => {
    const storage = stubStorage()
    userConfig = {
      storage,
      authorize: async () => {
        throw createError({ statusCode: 401, message: "nope" })
      },
    }

    vi.doMock("h3", async (importOriginal) => {
      const actual = await importOriginal<typeof import("h3")>()
      return { ...actual, readBody: async () => ({ file: { name: "a.png", size: 1, mimeType: "image/png" } }) }
    })

    const handler = await callHandler()
    await expect(handler(fakeEvent({}))).rejects.toMatchObject({ statusCode: 401 })
    expect(storage.presignUpload).not.toHaveBeenCalled()
    vi.doUnmock("h3")
  })

  it("rejects malformed bodies with 400", async () => {
    userConfig = { storage: stubStorage() }

    vi.doMock("h3", async (importOriginal) => {
      const actual = await importOriginal<typeof import("h3")>()
      return { ...actual, readBody: async () => ({ file: { name: "a.png" } }) }
    })

    const handler = await callHandler()
    await expect(handler(fakeEvent({}))).rejects.toMatchObject({ statusCode: 400 })
    vi.doUnmock("h3")
  })
})
