import { defineEventHandler } from "h3"
// @ts-expect-error virtual user-config import
import userConfig from "#upload-kit-user-config"
import type { UploadServerConfig, ServerHookContext } from "../types"
import { decodeFileIdParam, requireStorage, requireStorageMethod } from "../utils"

const config = userConfig as UploadServerConfig

export default defineEventHandler(async (event) => {
  const storage = requireStorage(config)
  const presignDownload = requireStorageMethod(storage, "presignDownload")

  const key = decodeFileIdParam(event)

  const auth = config.authorize ? await config.authorize(event, { type: "presign-download", key }) : {}
  const ctx: ServerHookContext = { event, auth }

  return await presignDownload(key, ctx)
})
