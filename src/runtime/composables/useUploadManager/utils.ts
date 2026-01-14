import type { PluginContext, UploadFile, FileError, UploadOptions } from "./types"
import type { Emitter } from "mitt"

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
