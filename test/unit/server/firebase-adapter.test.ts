// @vitest-environment node
import { describe, it, expect, beforeAll } from "vitest"
import { generateKeyPairSync } from "node:crypto"
import type { H3Event } from "h3"
import { FirebaseStorage } from "../../../src/runtime/server/adapters/firebase"

const ctx = { event: {} as H3Event, auth: {} }

let privateKey: string

beforeAll(() => {
  // firebase-admin V4 signing is local (HMAC over the private key) — generate an ephemeral
  // key so tests don't need a real service account.
  const { privateKey: pem } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  })
  privateKey = pem
})

const makeStorage = (overrides: Partial<Parameters<typeof FirebaseStorage>[0]> = {}) =>
  FirebaseStorage({
    bucket: overrides.bucket ?? `test-bucket-${Math.random().toString(36).slice(2)}.appspot.com`,
    credentials: { projectId: "test-project", clientEmail: "test@test-project.iam.gserviceaccount.com", privateKey },
    ...overrides,
  })

describe("FirebaseStorage", () => {
  it("returns a V4 signed upload URL plus the resolved key", async () => {
    const bucket = `bucket-a-${Date.now()}.appspot.com`
    const storage = makeStorage({ bucket })

    const result = await storage.presignUpload(
      { fileId: "abc123.png", name: "photo.png", size: 1024, mimeType: "image/png" },
      ctx,
    )

    expect(result.uploadUrl).toMatch(new RegExp(`^https://storage\\.googleapis\\.com/${bucket}/uploads/abc123\\.png\\?`))
    expect(result.uploadUrl).toContain("X-Goog-Signature")
    expect(result.uploadUrl).toContain("X-Goog-Algorithm=GOOG4-RSA-SHA256")
    expect(result.publicUrl).toBe(`https://storage.googleapis.com/${bucket}/uploads/abc123.png`)
    expect(result.fileId).toBe("uploads/abc123.png")
  })

  it("honours a custom keyStrategy", async () => {
    const bucket = `bucket-b-${Date.now()}.appspot.com`
    const storage = makeStorage({
      bucket,
      keyStrategy: ({ fileId }) => `tenant-42/${fileId}`,
    })

    const result = await storage.presignUpload(
      { fileId: "logo.svg", name: "logo.svg", size: 100, mimeType: "image/svg+xml" },
      ctx,
    )

    expect(result.fileId).toBe("tenant-42/logo.svg")
    expect(result.publicUrl).toBe(`https://storage.googleapis.com/${bucket}/tenant-42/logo.svg`)
  })

  it("exposes resolveKey mirroring the keyStrategy", () => {
    const storage = makeStorage({ keyStrategy: ({ fileId }) => `tenant-7/${fileId}` })
    expect(storage.resolveKey?.({ fileId: "abc", name: "abc", size: 1, mimeType: "text/plain" })).toBe("tenant-7/abc")
  })

  it("produces a V4 signed download URL", async () => {
    const bucket = `bucket-c-${Date.now()}.appspot.com`
    const storage = makeStorage({ bucket })

    const result = await storage.presignDownload!("uploads/file.bin", ctx)

    expect(result.downloadUrl).toMatch(new RegExp(`^https://storage\\.googleapis\\.com/${bucket}/uploads/file\\.bin\\?`))
    expect(result.downloadUrl).toContain("X-Goog-Signature")
  })
})
