import type { H3Event } from "h3"
// @ts-expect-error virtual user-config import
import userConfig from "#upload-kit-user-config"
import type { ServerUpload, UploadServerConfig, PresignedFileInput, ServerHookContext, StorageAdapter } from "./types"

const config = userConfig as UploadServerConfig

const requireStorage = (): StorageAdapter => {
  if (!config.storage) {
    throw new Error("[nuxt-upload-kit] useServerUpload(): no `storage` configured in upload.server.config.ts.")
  }
  return config.storage
}

const notImplemented = (op: string, id: string): never => {
  throw new Error(`[nuxt-upload-kit] storage adapter "${id}" does not implement ${op}().`)
}

export function useServerUpload(event: H3Event): ServerUpload {
  const ctx: ServerHookContext = { event, auth: {} }
  return {
    presignUpload: (file: PresignedFileInput) => requireStorage().presignUpload(file, ctx),
    presignDownload: (key: string) => {
      const s = requireStorage()
      return s.presignDownload ? s.presignDownload(key, ctx) : notImplemented("presignDownload", s.id)
    },
    delete: (key: string) => {
      const s = requireStorage()
      return s.delete ? s.delete(key, ctx) : notImplemented("delete", s.id)
    },
    put: (input) => {
      const s = requireStorage()
      return s.put ? s.put(input, ctx) : notImplemented("put", s.id)
    },
    list: (prefix?: string) => {
      const s = requireStorage()
      return s.list ? s.list(prefix, ctx) : notImplemented("list", s.id)
    },
  }
}
