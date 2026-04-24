import { describe, it, expect, vi, beforeEach } from "vitest"
import { createError } from "h3"
import type { StorageAdapter, UploadServerConfig } from "../../../src/runtime/server/types"

let userConfig: UploadServerConfig

vi.mock("#upload-kit-user-config", () => ({
  get default() {
    return userConfig
  },
}))

const stubStorage = (): StorageAdapter & { delete: ReturnType<typeof vi.fn> } => ({
  id: "stub",
  presignUpload: vi.fn(),
  delete: vi.fn(async () => {}),
})

const callHandler = async () => {
  const mod = await import("../../../src/runtime/server/handlers/delete")
  return mod.default
}

const fakeEvent = (fileId: string) =>
  ({
    node: { req: { method: "DELETE", headers: {} } },
    context: { params: { fileId } },
  }) as unknown as Parameters<Awaited<ReturnType<typeof callHandler>>>[0]

beforeEach(() => {
  vi.resetModules()
})

describe("delete handler", () => {
  it("authorizes, runs beforeDelete, then deletes", async () => {
    const order: string[] = []
    const storage = stubStorage()
    storage.delete.mockImplementation(async () => {
      order.push("delete")
    })
    userConfig = {
      storage,
      authorize: async () => {
        order.push("authorize")
        return { userId: "u1" }
      },
      hooks: {
        beforeDelete: async () => {
          order.push("beforeDelete")
        },
      },
    }

    const handler = await callHandler()
    const result = await handler(fakeEvent("uploads%2Fabc.png"))

    expect(order).toEqual(["authorize", "beforeDelete", "delete"])
    expect(storage.delete).toHaveBeenCalledWith("uploads/abc.png", expect.objectContaining({ auth: { userId: "u1" } }))
    expect(result).toEqual({ ok: true })
  })

  it("propagates authorize errors before deleting", async () => {
    const storage = stubStorage()
    userConfig = {
      storage,
      authorize: async () => {
        throw createError({ statusCode: 403, message: "nope" })
      },
    }

    const handler = await callHandler()
    await expect(handler(fakeEvent("abc"))).rejects.toMatchObject({ statusCode: 403 })
    expect(storage.delete).not.toHaveBeenCalled()
  })

  it("propagates beforeDelete errors before deleting", async () => {
    const storage = stubStorage()
    userConfig = {
      storage,
      hooks: {
        beforeDelete: async () => {
          throw createError({ statusCode: 409, message: "in use" })
        },
      },
    }

    const handler = await callHandler()
    await expect(handler(fakeEvent("abc"))).rejects.toMatchObject({ statusCode: 409 })
    expect(storage.delete).not.toHaveBeenCalled()
  })

  it("returns 400 when fileId is malformed URL encoding", async () => {
    const storage = stubStorage()
    userConfig = { storage }
    const handler = await callHandler()
    await expect(handler(fakeEvent("%E0%A4%A"))).rejects.toMatchObject({ statusCode: 400 })
    expect(storage.delete).not.toHaveBeenCalled()
  })

  it("returns 400 when fileId is missing", async () => {
    userConfig = { storage: stubStorage() }
    const handler = await callHandler()
    await expect(
      handler({ node: { req: { method: "DELETE", headers: {} } }, context: { params: {} } } as never),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it("returns 501 when the adapter doesn't implement delete", async () => {
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
