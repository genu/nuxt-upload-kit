import { defineStorageAdapter, type StandaloneUploadOptions } from "../../types"

export interface PresignedHttpOptions {
  /** Mount path of the auto-mounted upload endpoints. Defaults to the module's `handlerRoute`. */
  endpoint: string
  /**
   * Retry count for the `/presign` request when it fails with a network error or 5xx
   * response. Each retry waits `2^attempt * 200ms` (200ms, 400ms, 800ms by default).
   * 4xx responses (rejected by `authorize`/`validators`/`restrictions`) are not retried.
   * @default 3
   */
  retries?: number
}

export interface PresignedHttpUploadResult {
  url: string
  storageKey: string
  etag?: string
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Built-in client transport for `mode: "presigned"`.
 * POSTs file metadata to `${endpoint}/presign`, then PUTs the file to the returned signed URL.
 * Storage credentials and key strategy live server-side in the upload server config.
 */
export const PluginPresignedHttp = defineStorageAdapter<PresignedHttpOptions, PresignedHttpUploadResult>((options) => {
  const presignEndpoint = `${options.endpoint.replace(/\/+$/, "")}/presign`
  const maxRetries = options.retries ?? 3

  const requestPresign = async (file: { name: string; size: number; mimeType: string }) => {
    let lastError: unknown
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let response: Response | undefined
      try {
        response = await fetch(presignEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file }),
        })
      } catch (err) {
        // Network error — retryable.
        lastError = err
        if (attempt < maxRetries) await sleep(2 ** attempt * 200)
        continue
      }
      if (response.ok) {
        return (await response.json()) as {
          uploadUrl: string
          publicUrl: string
          fileId: string
          headers?: Record<string, string>
        }
      }
      const text = await response.text().catch(() => "")
      const error = new Error(`[presigned-http] ${presignEndpoint} returned ${response.status}: ${text}`)
      // 4xx is a rejection (auth, validators, restrictions). Don't retry — surface immediately.
      if (response.status >= 400 && response.status < 500) throw error
      // 5xx — retryable.
      lastError = error
      if (attempt < maxRetries) await sleep(2 ** attempt * 200)
    }
    throw lastError instanceof Error ? lastError : new Error("[presigned-http] /presign failed after retries")
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
      let extraHasContentType = false
      if (extraHeaders) {
        for (const [k, v] of Object.entries(extraHeaders)) {
          if (k.toLowerCase() === "content-type") extraHasContentType = true
          xhr.setRequestHeader(k, v)
        }
      }
      if (!extraHasContentType) xhr.setRequestHeader("Content-Type", contentType)
      xhr.send(data)
    })

  const upload = async (data: Blob | File, storageKey: string, uploadOptions?: StandaloneUploadOptions) => {
    const contentType = uploadOptions?.contentType || "application/octet-stream"
    const { uploadUrl, publicUrl, fileId, headers } = await requestPresign({
      name: storageKey,
      size: data.size,
      mimeType: contentType,
    })
    const etag = await putWithProgress(uploadUrl, data, contentType, uploadOptions?.onProgress || (() => {}), headers)
    return { url: publicUrl, storageKey: fileId, etag }
  }

  return {
    id: "presigned-http",
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
