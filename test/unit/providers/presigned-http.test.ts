import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PluginPresignedHttp } from "../../../src/runtime/composables/useUploadKit/plugins/storage/presigned-http"

describe("PluginPresignedHttp", () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    globalThis.fetch = originalFetch
  })

  it("retries /presign on 5xx and eventually surfaces the error", async () => {
    const fetchMock = vi.fn(async () => new Response("boom", { status: 503 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const adapter = PluginPresignedHttp({ endpoint: "/api/_upload", retries: 2 })
    const blob = new Blob(["x"], { type: "image/jpeg" })

    // Attach the rejection handler synchronously before the timers flush, so vitest
    // doesn't observe an unhandled rejection while the retry loop runs.
    const assertion = expect(adapter.upload(blob, "f.jpg", { contentType: "image/jpeg" })).rejects.toThrow(/503/)
    await vi.runAllTimersAsync()
    await assertion
    expect(fetchMock).toHaveBeenCalledTimes(3) // initial + 2 retries
  })

  it("does not retry on 4xx (e.g. validator rejection)", async () => {
    const fetchMock = vi.fn(async () => new Response("rejected", { status: 413 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const adapter = PluginPresignedHttp({ endpoint: "/api/_upload", retries: 5 })
    const blob = new Blob(["x"], { type: "image/jpeg" })

    const assertion = expect(adapter.upload(blob, "f.jpg", { contentType: "image/jpeg" })).rejects.toThrow(/413/)
    await vi.runAllTimersAsync()
    await assertion
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("succeeds after a transient 5xx", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("temporary", { status: 502 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ uploadUrl: "https://signed/", publicUrl: "https://cdn/f", fileId: "f" }), { status: 200 }),
      )
    globalThis.fetch = fetchMock as unknown as typeof fetch

    // Mock XHR for the PUT step
    class FakeXHR {
      upload = { addEventListener: () => {} }
      status = 200
      statusText = "OK"
      private listeners: Record<string, () => void> = {}
      addEventListener(event: string, cb: () => void) {
        this.listeners[event] = cb
      }
      open() {}
      setRequestHeader() {}
      getResponseHeader() {
        return null
      }
      send() {
        queueMicrotask(() => this.listeners.load?.())
      }
    }
    // @ts-expect-error stub doesn't satisfy XMLHttpRequest's full interface
    globalThis.XMLHttpRequest = FakeXHR

    const adapter = PluginPresignedHttp({ endpoint: "/api/_upload", retries: 3 })
    const blob = new Blob(["x"], { type: "image/jpeg" })

    const promise = adapter.upload(blob, "f.jpg", { contentType: "image/jpeg" })
    await vi.runAllTimersAsync()
    const result = await promise
    expect(result.url).toBe("https://cdn/f")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
