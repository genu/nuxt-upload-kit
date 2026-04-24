import { defineEventHandler, getRouterParam, createError } from "h3"
// @ts-expect-error virtual user-config import
import userConfig from "#upload-kit-user-config"
import type { UploadServerConfig, ServerHookContext } from "../types"

const config = userConfig as UploadServerConfig

export default defineEventHandler(async (event) => {
  if (!config.storage) {
    throw createError({
      statusCode: 500,
      statusMessage: "Server Misconfigured",
      message: "No storage adapter configured. Set `storage` in your upload.server.config.ts.",
    })
  }
  if (!config.storage.delete) {
    throw createError({
      statusCode: 501,
      statusMessage: "Not Implemented",
      message: `Storage adapter "${config.storage.id}" does not implement delete().`,
    })
  }

  const raw = getRouterParam(event, "fileId")
  if (!raw) {
    throw createError({ statusCode: 400, statusMessage: "Bad Request", message: "Missing fileId." })
  }
  let key: string
  try {
    key = decodeURIComponent(raw)
  } catch {
    throw createError({ statusCode: 400, statusMessage: "Bad Request", message: "Invalid fileId encoding." })
  }

  const auth = config.authorize ? await config.authorize(event, { type: "delete", key }) : {}
  const ctx: ServerHookContext = { event, auth }

  await config.hooks?.beforeDelete?.(key, ctx)
  await config.storage.delete(key, ctx)

  return { ok: true }
})
