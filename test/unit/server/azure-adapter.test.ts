import { describe, it, expect } from "vitest"
import type { H3Event } from "h3"
import { AzureStorage } from "../../../src/runtime/server/adapters/azure"

const ctx = { event: {} as H3Event, auth: {} }

// A valid base64 account key — SDK validates the length/encoding when constructing StorageSharedKeyCredential.
const ACCOUNT_KEY = Buffer.from("a".repeat(64)).toString("base64")

describe("AzureStorage", () => {
  it("returns a SAS-signed PUT URL and the blob's public URL", async () => {
    const storage = AzureStorage({
      account: "mystorage",
      container: "uploads",
      credentials: { accountKey: ACCOUNT_KEY },
    })

    const result = await storage.presignUpload(
      { fileId: "abc123.png", name: "photo.png", size: 1024, mimeType: "image/png" },
      ctx,
    )

    expect(result.uploadUrl).toMatch(/^https:\/\/mystorage\.blob\.core\.windows\.net\/uploads\/uploads\/abc123\.png\?/)
    expect(result.uploadUrl).toContain("sig=")
    expect(result.uploadUrl).toContain("sp=") // permissions
    expect(result.uploadUrl).toContain("sr=b") // resource = blob
    expect(result.publicUrl).toBe("https://mystorage.blob.core.windows.net/uploads/uploads/abc123.png")
    expect(result.fileId).toBe("uploads/abc123.png")
    expect(result.headers).toEqual({ "x-ms-blob-type": "BlockBlob" })
  })

  it("honours a custom keyStrategy", async () => {
    const storage = AzureStorage({
      account: "s",
      container: "c",
      credentials: { accountKey: ACCOUNT_KEY },
      keyStrategy: ({ fileId }) => `tenant-42/${fileId}`,
    })

    const result = await storage.presignUpload(
      { fileId: "logo.svg", name: "logo.svg", size: 100, mimeType: "image/svg+xml" },
      ctx,
    )

    expect(result.fileId).toBe("tenant-42/logo.svg")
    expect(result.publicUrl).toBe("https://s.blob.core.windows.net/c/tenant-42/logo.svg")
  })

  it("honours a custom endpointSuffix for sovereign clouds", async () => {
    const storage = AzureStorage({
      account: "s",
      container: "c",
      credentials: { accountKey: ACCOUNT_KEY },
      endpointSuffix: "core.chinacloudapi.cn",
    })

    const result = await storage.presignUpload(
      { fileId: "f.bin", name: "f.bin", size: 1, mimeType: "application/octet-stream" },
      ctx,
    )

    expect(result.uploadUrl).toMatch(/^https:\/\/s\.blob\.core\.chinacloudapi\.cn\/c\/uploads\/f\.bin\?/)
    expect(result.publicUrl).toBe("https://s.blob.core.chinacloudapi.cn/c/uploads/f.bin")
  })

  it("exposes resolveKey mirroring the keyStrategy", () => {
    const storage = AzureStorage({
      account: "s",
      container: "c",
      credentials: { accountKey: ACCOUNT_KEY },
      keyStrategy: ({ fileId }) => `tenant-7/${fileId}`,
    })
    expect(storage.resolveKey?.({ fileId: "abc", name: "abc", size: 1, mimeType: "text/plain" })).toBe("tenant-7/abc")
  })

  it("generates a read-scoped SAS for presignDownload", async () => {
    const storage = AzureStorage({
      account: "s",
      container: "c",
      credentials: { accountKey: ACCOUNT_KEY },
    })

    const { downloadUrl } = await storage.presignDownload!("uploads/abc.png", ctx)
    expect(downloadUrl).toMatch(/^https:\/\/s\.blob\.core\.windows\.net\/c\/uploads\/abc\.png\?/)
    expect(downloadUrl).toContain("sp=r")
    expect(downloadUrl).toContain("sig=")
  })

  it("percent-encodes reserved characters in keys per path segment", async () => {
    const storage = AzureStorage({
      account: "s",
      container: "c",
      credentials: { accountKey: ACCOUNT_KEY },
      keyStrategy: ({ fileId }) => `tenant a/${fileId}`,
    })

    const result = await storage.presignUpload(
      { fileId: "weird?name#1+2.png", name: "weird?name#1+2.png", size: 1, mimeType: "image/png" },
      ctx,
    )

    // `/` between segments preserved; reserved chars within a segment are encoded.
    expect(result.uploadUrl.startsWith("https://s.blob.core.windows.net/c/tenant%20a/weird%3Fname%231%2B2.png?")).toBe(true)
    expect(result.publicUrl).toBe("https://s.blob.core.windows.net/c/tenant%20a/weird%3Fname%231%2B2.png")
  })
})
