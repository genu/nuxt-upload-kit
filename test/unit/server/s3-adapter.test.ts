import { describe, it, expect } from "vitest"
import type { H3Event } from "h3"
import { S3Storage } from "../../../src/runtime/server/adapters/s3"

const ctx = { event: {} as H3Event, auth: {} }

describe("S3Storage", () => {
  it("returns a presigned PUT URL plus the resolved key", async () => {
    const storage = S3Storage({
      bucket: "test-bucket",
      region: "us-east-1",
      credentials: { accessKeyId: "AKIATEST", secretAccessKey: "secretkeyfortesting" },
    })

    const result = await storage.presignUpload(
      { fileId: "abc123.png", name: "photo.png", size: 1024, mimeType: "image/png" },
      ctx,
    )

    expect(result.uploadUrl).toMatch(/^https:\/\/test-bucket\.s3\.us-east-1\.amazonaws\.com\/uploads\/abc123\.png\?/)
    expect(result.uploadUrl).toContain("X-Amz-Signature")
    expect(result.publicUrl).toBe("https://test-bucket.s3.us-east-1.amazonaws.com/uploads/abc123.png")
    expect(result.fileId).toBe("uploads/abc123.png")
  })

  it("honours a custom keyStrategy", async () => {
    const storage = S3Storage({
      bucket: "b",
      region: "us-east-1",
      credentials: { accessKeyId: "x", secretAccessKey: "y" },
      keyStrategy: ({ fileId }) => `tenant-42/${fileId}`,
    })

    const result = await storage.presignUpload(
      { fileId: "logo.svg", name: "logo.svg", size: 100, mimeType: "image/svg+xml" },
      ctx,
    )

    expect(result.fileId).toBe("tenant-42/logo.svg")
    expect(result.publicUrl).toBe("https://b.s3.us-east-1.amazonaws.com/tenant-42/logo.svg")
  })

  it("uses path-style URLs for S3-compatible endpoints", async () => {
    const storage = S3Storage({
      bucket: "minio-bucket",
      region: "us-east-1",
      endpoint: "http://localhost:9000",
      forcePathStyle: true,
      credentials: { accessKeyId: "x", secretAccessKey: "y" },
    })

    const result = await storage.presignUpload(
      { fileId: "file.bin", name: "file.bin", size: 10, mimeType: "application/octet-stream" },
      ctx,
    )

    expect(result.uploadUrl).toMatch(/^http:\/\/localhost:9000\/minio-bucket\/uploads\/file\.bin\?/)
    expect(result.publicUrl).toBe("http://localhost:9000/minio-bucket/uploads/file.bin")
  })
})
