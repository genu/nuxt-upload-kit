// @ts-expect-error virtual user-config import; resolved by the module
import userConfig from "#upload-kit-user-config"
import { defineNitroPlugin, useRuntimeConfig } from "#imports"
import type { UploadServerConfig } from "../types"
import { resolveMode } from "../capabilities"

const config = userConfig as UploadServerConfig

export default defineNitroPlugin(() => {
  if (!config.storage) return

  const { mode, capabilities } = resolveMode(config.storage, config.mode)

  const runtimeConfig = useRuntimeConfig()
  const existing = (runtimeConfig.public.uploadKit ?? {}) as Record<string, unknown>
  runtimeConfig.public.uploadKit = {
    ...existing,
    mode,
    capabilities,
  }
})
