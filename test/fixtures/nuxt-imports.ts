// Stub for Nuxt's virtual `#imports` module in unit tests.
import type { Restrictions } from "../../src/runtime/shared"

interface UploadKitPublicConfig {
  handlerRoute?: string
  mode?: "presigned" | "server"
  restrictions?: Restrictions
  capabilities?: { presigned: boolean; server: boolean; download: boolean; delete: boolean }
}

let publicConfig: { uploadKit?: UploadKitPublicConfig } = {}

/** Test-only helper: set the public runtime config seen by the stub. */
export const __setRuntimeConfig = (cfg: { uploadKit?: UploadKitPublicConfig }) => {
  publicConfig = cfg
}

export const useRuntimeConfig = (): { public: { uploadKit?: UploadKitPublicConfig } } => ({ public: publicConfig })

export const defineNitroPlugin = <T extends (...args: unknown[]) => unknown>(plugin: T): T => plugin
