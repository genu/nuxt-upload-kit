import type { H3Event } from "h3"
import type { ServerUpload } from "./types"

const NOT_CONFIGURED = (op: string) => () => {
  throw new Error(
    `[nuxt-upload-kit] useServerUpload().${op}() called but server is not configured. ` +
      `Create ~~/server/upload.server.config.ts and export defineUploadServerConfig({ storage, ... }).`,
  )
}

export function useServerUpload(_event: H3Event): ServerUpload {
  return {
    put: NOT_CONFIGURED("put"),
    presignUpload: NOT_CONFIGURED("presignUpload"),
    presignDownload: NOT_CONFIGURED("presignDownload"),
    delete: NOT_CONFIGURED("delete"),
    list: NOT_CONFIGURED("list"),
  }
}
