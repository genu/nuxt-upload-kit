import { defineEventHandler, readBody, createError } from "h3"
// Resolved by the module's Nitro alias to ~~/server/upload.server.config.ts
// @ts-expect-error virtual user-config import
import userConfig from "#upload-kit-user-config"
import type { UploadServerConfig, UploadFileDescriptor, ServerHookContext } from "../types"
import { enforceRestrictions } from "../restrictions"
import { generateFileId, getRestrictions, requireStorage } from "../utils"

const config = userConfig as UploadServerConfig

const isFileDescriptor = (v: unknown): v is UploadFileDescriptor => {
  if (!v || typeof v !== "object") return false
  const f = v as Record<string, unknown>
  return (
    typeof f.name === "string" &&
    f.name.length > 0 &&
    typeof f.size === "number" &&
    Number.isFinite(f.size) &&
    f.size >= 0 &&
    typeof f.mimeType === "string" &&
    f.mimeType.length > 0
  )
}

export default defineEventHandler(async (event) => {
  const storage = requireStorage(config)

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

  const state = config.getExistingState ? await config.getExistingState(ctx) : undefined
  enforceRestrictions(file, getRestrictions(), state)

  if (config.validators) {
    for (const validate of config.validators) await validate(file, ctx)
  }

  await config.hooks?.beforePresign?.(file, ctx)

  const fileId = generateFileId(file)
  return await storage.presignUpload({ ...file, fileId }, ctx)
})
