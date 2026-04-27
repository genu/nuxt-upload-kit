import { defineEventHandler, readMultipartFormData, createError, getRequestHeader } from "h3"
// @ts-expect-error virtual user-config import
import userConfig from "#upload-kit-user-config"
import type { UploadServerConfig, UploadFileDescriptor, ServerHookContext } from "../types"
import { enforceRestrictions } from "../restrictions"
import { generateFileId, getRestrictions, requireStorage, requireStorageMethod } from "../utils"

const config = userConfig as UploadServerConfig

export default defineEventHandler(async (event) => {
  const storage = requireStorage(config)
  const put = requireStorageMethod(storage, "put")

  if (config.maxBodySize != null) {
    const contentLength = Number(getRequestHeader(event, "content-length"))
    if (Number.isFinite(contentLength) && contentLength > config.maxBodySize) {
      throw createError({
        statusCode: 413,
        statusMessage: "Payload Too Large",
        message: `Request body exceeds maxBodySize (${config.maxBodySize} bytes).`,
      })
    }
  }

  const parts = await readMultipartFormData(event)
  const filePart = parts?.find((p) => p.name === "file" && p.filename)
  if (!filePart || !filePart.filename || !filePart.data) {
    throw createError({
      statusCode: 400,
      statusMessage: "Bad Request",
      message: "Expected a multipart body with a `file` part.",
    })
  }

  const file: UploadFileDescriptor = {
    name: filePart.filename,
    size: filePart.data.length,
    mimeType: filePart.type || "application/octet-stream",
  }

  enforceRestrictions(file, getRestrictions())

  const auth = config.authorize ? await config.authorize(event, { type: "direct-upload", file }) : {}
  const ctx: ServerHookContext = { event, auth }

  if (config.validators) {
    for (const validate of config.validators) await validate(file, ctx)
  }

  const fileId = generateFileId(file)
  const key = storage.resolveKey?.({ ...file, fileId }) ?? `uploads/${fileId}`

  const result = await put({ key, body: filePart.data, contentType: file.mimeType }, ctx)

  await config.hooks?.afterUpload?.(file, ctx)

  return { publicUrl: result.publicUrl, fileId: key }
})
