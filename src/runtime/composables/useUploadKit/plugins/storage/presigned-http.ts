import { defineStorageAdapter, type StandaloneUploadOptions } from "../../types"

export interface PresignedHttpOptions {
  /** Mount path of the auto-mounted upload endpoints. Defaults to the module's `handlerRoute`. */
  endpoint: string
}

export interface PresignedHttpUploadResult {
  url: string
  storageKey: string
  etag?: string
}

/**
 * Built-in client transport for `mode: "presigned"`.
 * POSTs file metadata to `${endpoint}/presign`, then PUTs the file to the returned signed URL.
 * Storage credentials and key strategy live server-side in the upload server config.
 */
export const PluginPresignedHttp = defineStorageAdapter<PresignedHttpOptions, PresignedHttpUploadResult>((options) => {
  const presignEndpoint = `${options.endpoint.replace(/\/+$/, "")}/presign`

  const requestPresign = async (file: { name: string; size: number; mimeType: string }) => {
    const response = await fetch(presignEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file }),
    })
    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new Error(`[presigned-http] ${presignEndpoint} returned ${response.status}: ${text}`)
    }
    return (await response.json()) as {
      uploadUrl: string
      publicUrl: string
      fileId: string
      headers?: Record<string, string>
    }
  }

  const putWithProgress = (
    url: string,
    data: File | Blob,
    contentType: string,
    onProgress: (percentage: number) => void,
    extraHeaders?: Record<string, string>,
  ): Promise<string | undefined> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
      })
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.getResponseHeader("ETag")?.replaceAll('"', ""))
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.statusText}`))
        }
      })
      xhr.addEventListener("error", () => reject(new Error("Upload failed due to network error")))
      xhr.addEventListener("abort", () => reject(new Error("Upload was aborted")))
      xhr.open("PUT", url)
      xhr.setRequestHeader("Content-Type", contentType)
      if (extraHeaders) {
        for (const [k, v] of Object.entries(extraHeaders)) xhr.setRequestHeader(k, v)
      }
      xhr.send(data)
    })

  return {
    id: "presigned-http",
    async upload(data: Blob | File, storageKey: string, uploadOptions?: StandaloneUploadOptions) {
      const contentType = uploadOptions?.contentType || "application/octet-stream"
      const { uploadUrl, publicUrl, fileId, headers } = await requestPresign({
        name: storageKey,
        size: data.size,
        mimeType: contentType,
      })
      const etag = await putWithProgress(uploadUrl, data, contentType, uploadOptions?.onProgress || (() => {}), headers)
      return { url: publicUrl, storageKey: fileId, etag }
    },
    hooks: {
      async upload(file, context) {
        if (file.source !== "local" || file.data === null) {
          throw new Error("Cannot upload remote file - no local data available")
        }
        const { uploadUrl, publicUrl, fileId, headers } = await requestPresign({
          name: file.name,
          size: file.size,
          mimeType: file.mimeType,
        })
        const etag = await putWithProgress(uploadUrl, file.data, file.mimeType, context.onProgress, headers)
        return { url: publicUrl, storageKey: fileId, etag }
      },
    },
  }
})
