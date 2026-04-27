import { createError, getRouterParam, type H3Event } from "h3"
import { useRuntimeConfig } from "#imports"
import type { Restrictions } from "../shared"
import type { StorageAdapter, UploadFileDescriptor, UploadServerConfig } from "./types"

export function generateFileId(file: UploadFileDescriptor): string {
  const ts = Date.now()
  const rand = Math.random().toString(36).slice(2, 10)
  const dot = file.name.lastIndexOf(".")
  const ext = dot > 0 ? file.name.slice(dot) : ""
  return `${ts}-${rand}${ext}`
}

export function requireStorage(config: UploadServerConfig): StorageAdapter {
  if (!config.storage) {
    throw createError({
      statusCode: 500,
      statusMessage: "Server Misconfigured",
      message: "No storage adapter configured. Set `storage` in your upload.server.config.ts.",
    })
  }
  return config.storage
}

export function requireStorageMethod<K extends keyof StorageAdapter>(
  storage: StorageAdapter,
  method: K,
): NonNullable<StorageAdapter[K]> {
  const fn = storage[method]
  if (typeof fn !== "function") {
    throw createError({
      statusCode: 501,
      statusMessage: "Not Implemented",
      message: `Storage adapter "${storage.id}" does not implement ${String(method)}().`,
    })
  }
  return fn as NonNullable<StorageAdapter[K]>
}

export function decodeFileIdParam(event: H3Event): string {
  const raw = getRouterParam(event, "fileId")
  if (!raw) {
    throw createError({ statusCode: 400, statusMessage: "Bad Request", message: "Missing fileId." })
  }
  try {
    return decodeURIComponent(raw)
  } catch {
    throw createError({ statusCode: 400, statusMessage: "Bad Request", message: "Invalid fileId encoding." })
  }
}

export function getRestrictions(): Restrictions | undefined {
  return (useRuntimeConfig().public.uploadKit as { restrictions?: Restrictions } | undefined)?.restrictions
}
