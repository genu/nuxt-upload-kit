import { defineUploadServerConfig, MaxFileSize, AllowedMimeTypes } from "#upload-kit/server"
import { S3Storage } from "nuxt-upload-kit/server/s3"

const env = process.env

export default defineUploadServerConfig({
  storage: S3Storage({
    bucket: env.S3_BUCKET ?? "playground-bucket",
    region: env.AWS_REGION ?? "us-east-1",
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_ENDPOINT ? true : undefined,
    credentials:
      env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
        ? { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY }
        : undefined,
  }),

  validators: [MaxFileSize(10 * 1024 * 1024), AllowedMimeTypes(["image/*", "video/*"])],

  authorize: async () => {
    return { userId: "playground" }
  },
})
