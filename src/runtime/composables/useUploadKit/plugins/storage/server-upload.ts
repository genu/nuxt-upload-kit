import { defineStorageAdapter, type StandaloneUploadOptions } from "../../types"

export interface ServerUploadOptions {
  /** Mount path of the auto-mounted upload endpoints. Defaults to the module's `handlerRoute`. */
  endpoint: string
}

export interface ServerUploadResult {
  url: string
  storageKey: string
}

const postMultipartWithProgress = (
  url: string,
  data: Blob | File,
  filename: string,
  contentType: string,
  onProgress: (percentage: number) => void,
): Promise<{ publicUrl: string; fileId: string }> =>
  new Promise((resolve, reject) => {
    const form = new FormData()
    form.append("file", new Blob([data], { type: contentType }), filename)

    const xhr = new XMLHttpRequest()
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    })
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch (err) {
          reject(new Error(`[server-upload] failed to parse response: ${(err as Error).message}`))
        }
      } else {
        reject(new Error(`[server-upload] ${url} returned ${xhr.status}: ${xhr.statusText} ${xhr.responseText}`))
      }
    })
    xhr.addEventListener("error", () => reject(new Error("Upload failed due to network error")))
    xhr.addEventListener("abort", () => reject(new Error("Upload was aborted")))
    xhr.open("POST", url)
    xhr.send(form)
  })

/**
 * Built-in client transport for `mode: "server"`.
 * POSTs the file as multipart/form-data to `${endpoint}/direct`. The Nitro handler forwards
 * it to the configured storage adapter server-side. Credentials never leave the server.
 */
export const PluginServerUpload = defineStorageAdapter<ServerUploadOptions, ServerUploadResult>((options) => {
  const directEndpoint = `${options.endpoint.replace(/\/+$/, "")}/direct`

  const upload = async (data: Blob | File, storageKey: string, uploadOptions?: StandaloneUploadOptions) => {
    const contentType = uploadOptions?.contentType || "application/octet-stream"
    const { publicUrl, fileId } = await postMultipartWithProgress(
      directEndpoint,
      data,
      storageKey,
      contentType,
      uploadOptions?.onProgress || (() => {}),
    )
    return { url: publicUrl, storageKey: fileId }
  }

  return {
    id: "server-upload",
    upload,
    hooks: {
      async upload(file, context) {
        if (file.source !== "local" || file.data === null) {
          throw new Error("Cannot upload remote file - no local data available")
        }
        return upload(file.data, file.name, { contentType: file.mimeType, onProgress: context.onProgress })
      },
    },
  }
})
