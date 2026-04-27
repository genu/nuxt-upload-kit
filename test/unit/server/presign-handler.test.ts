import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
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

afterEach(async () => {
  vi.doUnmock("h3")
  const { __setRuntimeConfig } = await import("../../fixtures/nuxt-imports")
  __setRuntimeConfig({})
})

describe("presign handler", () => {
  it("authorizes, runs the hook, then presigns", async () => {
    const order: string[] = []
    const storage = stubStorage()
    userConfig = {
      storage,
      authorize: vi.fn(async () => {
        order.push("authorize")
        return { userId: "u1" }
      }),
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

    vi.doMock("h3", async (importOriginal) => {
      const actual = await importOriginal<typeof import("h3")>()
      return { ...actual, readBody: async () => ({ file: { name: "a.png", size: 100, mimeType: "image/png" } }) }
    })

    const handler = await callHandler()
    await handler(fakeEvent({ file: { name: "a.png", size: 100, mimeType: "image/png" } }))

    expect(order).toEqual(["authorize", "beforePresign", "presign"])
  })

  it("rejects with 413 when file exceeds shared maxFileSize restriction", async () => {
    const storage = stubStorage()
    userConfig = { storage }

    const { __setRuntimeConfig } = await import("../../fixtures/nuxt-imports")
    __setRuntimeConfig({ uploadKit: { restrictions: { maxFileSize: 100 } } })

    vi.doMock("h3", async (importOriginal) => {
      const actual = await importOriginal<typeof import("h3")>()
      return { ...actual, readBody: async () => ({ file: { name: "a.png", size: 9999, mimeType: "image/png" } }) }
    })

    const handler = await callHandler()
    await expect(handler(fakeEvent({}))).rejects.toMatchObject({ statusCode: 413 })
    expect(storage.presignUpload).not.toHaveBeenCalled()
  })

  it("runs validators after authorize and before hooks.beforePresign", async () => {
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

    vi.doMock("h3", async (importOriginal) => {
      const actual = await importOriginal<typeof import("h3")>()
      return { ...actual, readBody: async () => ({ file: { name: "a.png", size: 100, mimeType: "image/png" } }) }
    })

    const handler = await callHandler()
    await handler(fakeEvent({}))

    expect(order).toEqual(["authorize", "validate", "beforePresign", "presign"])
  })

  it("propagates validator errors before presigning", async () => {
    const storage = stubStorage()
    userConfig = {
      storage,
      validators: [
        () => {
          throw createError({ statusCode: 409, message: "quota exceeded" })
        },
      ],
    }

    vi.doMock("h3", async (importOriginal) => {
      const actual = await importOriginal<typeof import("h3")>()
      return { ...actual, readBody: async () => ({ file: { name: "a.png", size: 1, mimeType: "image/png" } }) }
    })

    const handler = await callHandler()
    await expect(handler(fakeEvent({}))).rejects.toMatchObject({ statusCode: 409 })
    expect(storage.presignUpload).not.toHaveBeenCalled()
  })

  it("rejects with 415 when MIME is not allowed", async () => {
    const storage = stubStorage()
    userConfig = { storage }

    const { __setRuntimeConfig } = await import("../../fixtures/nuxt-imports")
    __setRuntimeConfig({ uploadKit: { restrictions: { allowedMimeTypes: ["image/*"] } } })

    vi.doMock("h3", async (importOriginal) => {
      const actual = await importOriginal<typeof import("h3")>()
      return { ...actual, readBody: async () => ({ file: { name: "a.pdf", size: 100, mimeType: "application/pdf" } }) }
    })

    const handler = await callHandler()
    await expect(handler(fakeEvent({}))).rejects.toMatchObject({ statusCode: 415 })
    expect(storage.presignUpload).not.toHaveBeenCalled()
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
  })

  it("rejects malformed bodies with 400", async () => {
    userConfig = { storage: stubStorage() }

    vi.doMock("h3", async (importOriginal) => {
      const actual = await importOriginal<typeof import("h3")>()
      return { ...actual, readBody: async () => ({ file: { name: "a.png" } }) }
    })

    const handler = await callHandler()
    await expect(handler(fakeEvent({}))).rejects.toMatchObject({ statusCode: 400 })
  })
})
