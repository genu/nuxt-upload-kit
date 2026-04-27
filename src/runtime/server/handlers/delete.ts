import { defineEventHandler } from "h3"
// @ts-expect-error virtual user-config import
import userConfig from "#upload-kit-user-config"
import type { UploadServerConfig, ServerHookContext } from "../types"
import { decodeFileIdParam, requireStorage, requireStorageMethod } from "../utils"

const config = userConfig as UploadServerConfig

export default defineEventHandler(async (event) => {
  const storage = requireStorage(config)
  const remove = requireStorageMethod(storage, "delete")

  const key = decodeFileIdParam(event)

  const auth = config.authorize ? await config.authorize(event, { type: "delete", key }) : {}
  const ctx: ServerHookContext = { event, auth }

  await config.hooks?.beforeDelete?.(key, ctx)
  await remove(key, ctx)

  return { ok: true }
})
