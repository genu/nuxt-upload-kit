import { isRef, toValue, watch } from "vue"
import type { PluginContext, UploadFile, FileError, UploadOptions, InitialFileInput } from "./types"
import type { Emitter } from "mitt"

/**
 * Get file extension from filename
 */
export function getExtension(fullFileName: string): string {
  const lastDot = fullFileName.lastIndexOf(".")

  if (lastDot === -1 || lastDot === fullFileName.length - 1) {
    throw new Error("Invalid file name")
  }

  return fullFileName.slice(lastDot + 1).toLocaleLowerCase()
}

/**
 * Create a plugin context object with consistent structure
 */
export function createPluginContext<TPluginEvents extends Record<string, any> = Record<string, never>>(
  pluginId: string,
  files: UploadFile[],
  options: UploadOptions,
  emitter: Emitter<any>,
): PluginContext<TPluginEvents> {
  return {
    files,
    options,
    emit: (event, payload) => {
      const prefixedEvent = `${pluginId}:${String(event)}` as any
      emitter.emit(prefixedEvent, payload)
    },
  }
}

/**
 * Create a consistent file error object
 */
export function createFileError(file: UploadFile, error: unknown): FileError {
  return {
    message: error instanceof Error ? error.message : String(error),
    details: {
      fileName: file.name,
      fileSize: file.size,
      timestamp: new Date().toISOString(),
    },
  }
}

/**
 * Calculate thumbnail dimensions while maintaining aspect ratio
 */
export function calculateThumbnailDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  const aspectRatio = originalWidth / originalHeight

  let width = maxWidth
  let height = maxHeight

  // Maintain aspect ratio
  if (aspectRatio > 1) {
    // Landscape
    height = maxWidth / aspectRatio
  } else {
    // Portrait
    width = maxHeight * aspectRatio
  }

  return { width, height }
}

/**
 * Convert a base64-encoded data URL (e.g., from canvas.toDataURL) to a Blob.
 * Only supports base64-encoded data URLs (`;base64,` format).
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  if (!dataUrl.includes(";base64,")) {
    throw new Error("dataUrlToBlob only supports base64-encoded data URLs")
  }
  const [header, base64] = dataUrl.split(",")
  const mimeType = header.match(/:(.*?);/)?.[1] ?? "image/jpeg"
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mimeType })
}

/**
 * Derive a thumbnail storage key from a file ID by appending '_thumb' before the extension
 * @example "1738345678901-abc123.jpg" → "1738345678901-abc123_thumb.jpg"
 */
export function deriveThumbnailKey(fileId: string): string {
  const lastDot = fileId.lastIndexOf(".")
  if (lastDot === -1) return `${fileId}_thumb`
  return `${fileId.slice(0, lastDot)}_thumb${fileId.slice(lastDot)}`
}

/**
 * Cleanup object URLs to prevent memory leaks
 * @param urlMap Map of file IDs to object URLs
 * @param fileId Optional file ID to cleanup specific URL, or cleanup all if not provided
 */
export function cleanupObjectURLs(urlMap: Map<string, string>, fileId?: string): void {
  if (fileId) {
    // Cleanup specific file's object URL
    const url = urlMap.get(fileId)
    if (url) {
      URL.revokeObjectURL(url)
      urlMap.delete(fileId)
    }
  } else {
    // Cleanup all object URLs
    for (const url of urlMap.values()) {
      URL.revokeObjectURL(url)
    }
    urlMap.clear()
  }
}

/**
 * Setup initial files from the initialFiles option
 * Handles both static values and reactive refs with deferred initialization
 */
export function setupInitialFiles<TUploadResult>({
  initialFiles,
  files,
  isReady,
  emitter,
  initializeExistingFiles,
}: {
  initialFiles: UploadOptions["initialFiles"]
  files: { value: UploadFile<TUploadResult>[] }
  isReady: { value: boolean }
  emitter: { emit: (type: string, data: unknown) => void }
  initializeExistingFiles: (files: InitialFileInput[]) => Promise<void>
}) {
  if (initialFiles === undefined) return

  let isInitialized = false

  const doInitialize = async (value: string | string[] | undefined) => {
    if (isInitialized || !value || files.value.length > 0) return

    const paths = Array.isArray(value) ? value : [value]
    if (paths.length > 0 && paths.every(Boolean)) {
      isInitialized = true
      try {
        await initializeExistingFiles(paths.map((storageKey) => ({ storageKey })))
        isReady.value = true
        emitter.emit("initialFiles:loaded", files.value)
      } catch (error) {
        isReady.value = true
        emitter.emit("initialFiles:error", error)
      }
    } else {
      isReady.value = true
    }
  }

  if (isRef(initialFiles)) {
    watch(
      () => toValue(initialFiles),
      (newValue) => doInitialize(newValue),
      { immediate: true },
    )
  } else {
    doInitialize(initialFiles)
  }
}
