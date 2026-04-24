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
  if (!config.storage.presignDownload) {
    throw createError({
      statusCode: 501,
      statusMessage: "Not Implemented",
      message: `Storage adapter "${config.storage.id}" does not implement presignDownload().`,
    })
  }

  const raw = getRouterParam(event, "fileId")
  if (!raw) {
    throw createError({ statusCode: 400, statusMessage: "Bad Request", message: "Missing fileId." })
  }
  // Clients URL-encode keys that contain "/"; decode back to the raw storage key.
  const key = decodeURIComponent(raw)

  const auth = config.authorize ? await config.authorize(event, { type: "presign-download", key }) : {}
  const ctx: ServerHookContext = { event, auth }

  return await config.storage.presignDownload(key, ctx)
})
