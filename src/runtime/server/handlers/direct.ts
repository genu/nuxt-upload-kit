import { defineEventHandler, readMultipartFormData, createError, getRequestHeader } from "h3"
// @ts-expect-error virtual user-config import
import userConfig from "#upload-kit-user-config"
import type { UploadServerConfig, UploadFileDescriptor, ServerHookContext } from "../types"

const config = userConfig as UploadServerConfig

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
  if (!config.storage.put) {
    throw createError({
      statusCode: 501,
      statusMessage: "Not Implemented",
      message: `Storage adapter "${config.storage.id}" does not implement put().`,
    })
  }

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

  const auth = config.authorize ? await config.authorize(event, { type: "direct-upload", file }) : {}
  const ctx: ServerHookContext = { event, auth }

  if (config.validators) {
    for (const validate of config.validators) {
      await validate(file, ctx)
    }
  }

  const fileId = generateFileId(file)
  const key = config.storage.resolveKey?.({ ...file, fileId }) ?? `uploads/${fileId}`

  const result = await config.storage.put({ key, body: filePart.data, contentType: file.mimeType }, ctx)

  await config.hooks?.afterUpload?.(file, ctx)

  return { publicUrl: result.publicUrl, fileId: key }
})
