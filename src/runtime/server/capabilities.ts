import type { StorageAdapter } from "./types"

export type UploadMode = "presigned" | "server"

export interface StorageCapabilities {
  presigned: boolean
  server: boolean
  download: boolean
  delete: boolean
}

export function deriveCapabilities(storage: StorageAdapter): StorageCapabilities {
  return {
    presigned: typeof storage.presignUpload === "function",
    server: typeof storage.put === "function",
    download: typeof storage.presignDownload === "function",
    delete: typeof storage.delete === "function",
  }
}

export function supportedModes(caps: StorageCapabilities): UploadMode[] {
  const modes: UploadMode[] = []
  if (caps.presigned) modes.push("presigned")
  if (caps.server) modes.push("server")
  return modes
}

export function resolveMode(
  storage: StorageAdapter,
  requested: UploadMode | undefined,
): { mode: UploadMode; capabilities: StorageCapabilities } {
  const capabilities = deriveCapabilities(storage)
  const supported = supportedModes(capabilities)

  if (supported.length === 0) {
    throw new Error(
      `Storage adapter "${storage.id}" implements no upload mode: it must define at least one of \`presignUpload\` (for "presigned") or \`put\` (for "server").`,
    )
  }

  if (requested) {
    if (!supported.includes(requested)) {
      throw new Error(`Storage adapter "${storage.id}" does not support mode "${requested}". Supported: ${supported.join(", ")}.`)
    }
    return { mode: requested, capabilities }
  }

  return { mode: supported[0]!, capabilities }
}
