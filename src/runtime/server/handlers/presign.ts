import { defineEventHandler, readBody, createError } from "h3"
// Resolved by the module's Nitro alias to ~~/server/upload.server.config.ts
// @ts-expect-error virtual user-config import
import userConfig from "#upload-kit-user-config"
import type { UploadServerConfig, UploadFileDescriptor, ServerHookContext } from "../types"

const config = userConfig as UploadServerConfig

const isFileDescriptor = (v: unknown): v is UploadFileDescriptor => {
  if (!v || typeof v !== "object") return false
  const f = v as Record<string, unknown>
  return typeof f.name === "string" && typeof f.size === "number" && typeof f.mimeType === "string"
}

const generateFileId = (file: UploadFileDescriptor): string => {
  const ts = Date.now()
  const rand = Math.random().toString(36).slice(2, 10)
  const dot = file.name.lastIndexOf(".")
  const ext = dot > 0 ? file.name.slice(dot) : ""
  return `${ts}-${rand}${ext}`
}

export default defineEventHandler(async (event) => {
  if (!config.storage) {
    throw createError({
      statusCode: 500,
      statusMessage: "Server Misconfigured",
      message: "No storage adapter configured. Set `storage` in your upload.server.config.ts.",
    })
  }

  const body = (await readBody(event)) as { file?: unknown } | null
  const file = body?.file
  if (!isFileDescriptor(file)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Body must be `{ file: { name, size, mimeType } }`.",
    })
  }

  const auth = config.authorize ? await config.authorize(event, { type: "presign-upload", file }) : {}
  const ctx: ServerHookContext = { event, auth }

  if (config.validators) {
    for (const validate of config.validators) {
      await validate(file, ctx)
    }
  }

  await config.hooks?.beforePresign?.(file, ctx)

  const fileId = generateFileId(file)
  return await config.storage.presignUpload({ ...file, fileId }, ctx)
})
