import type { Ref } from "vue"
import type { Emitter } from "mitt"
import type { UploadFile, LocalUploadFile, UploadOptions, StoragePlugin, PluginLifecycleStage } from "./types"
import { cleanupObjectURLs, createPluginContext } from "./utils"

export interface FileOperationsDeps<TUploadResult = any> {
  /** Reactive ref containing the files array */
  files: Ref<UploadFile<TUploadResult>[]>
  /** Event emitter for file events */
  emitter: Emitter<any>
  /** Upload options configuration */
  options: UploadOptions
  /** Map tracking created object URLs for cleanup */
  createdObjectURLs: Map<string, string>
  /** Function to get the active storage plugin */
  getStoragePlugin: () => StoragePlugin<any, any> | null
  /** Function to run plugin lifecycle stages */
  runPluginStage: (stage: Exclude<PluginLifecycleStage, "upload">, file?: UploadFile) => Promise<UploadFile | undefined | null>
  /** Function to trigger upload */
  upload: () => Promise<void>
  /** Function to update the hasEmittedFilesUploaded flag */
  setHasEmittedFilesUploaded: (value: boolean) => void
}

/**
 * Creates file operation functions with injected dependencies.
 *
 * This factory function creates all file access and manipulation operations
 * with proper closure over the composable's internal state.
 */
export function createFileOperations<TUploadResult = any>(deps: FileOperationsDeps<TUploadResult>) {
  const { files, emitter, options, createdObjectURLs, getStoragePlugin, runPluginStage, upload, setHasEmittedFilesUploaded } =
    deps

  /**
   * Get a file by ID.
   * @throws Error if file is not found
   */
  const getFile = (fileId: string): UploadFile<TUploadResult> => {
    const file = files.value.find((f) => f.id === fileId)
    if (!file) {
      throw new Error(`File not found: ${fileId}`)
    }
    return file
  }

  /**
   * Get a File/Blob object for any file, regardless of source.
   * For local files, returns the existing data.
   * For remote files, fetches the file from the remote URL.
   *
   * ⚠️ WARNING: For large files (>100MB), this loads the entire file into memory.
   * Consider using getFileURL() or getFileStream() for large files instead.
   */
  const getFileData = async (fileId: string): Promise<Blob> => {
    const file = getFile(fileId)

    // Log warning for large files
    if (file.size > 100 * 1024 * 1024) {
      console.warn(
        `getFileData: Loading large file (${(file.size / 1024 / 1024).toFixed(2)}MB) into memory. ` +
          `Consider using getFileURL() or getFileStream() for better performance.`,
      )
    }

    // For local files, return the data directly
    if (file.source === "local") {
      return file.data
    }

    // For remote files, fetch from the URL
    const response = await fetch(file.remoteUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`)
    }
    return await response.blob()
  }

  /**
   * Get a URL for a file (object URL for local, remote URL for storage files)
   */
  const getFileURL = async (fileId: string): Promise<string> => {
    const file = getFile(fileId)

    if (file.source === "local") {
      // Check if we already created an object URL for this file
      const existingURL = createdObjectURLs.get(file.id)
      if (existingURL) {
        return existingURL
      }

      // Create object URL (doesn't copy data, just creates a reference)
      const objectURL = URL.createObjectURL(file.data)

      // Track it for cleanup
      createdObjectURLs.set(file.id, objectURL)

      return objectURL
    }

    // For remote files, return the URL directly
    return file.remoteUrl
  }

  /**
   * Get a ReadableStream for a file (most memory efficient for large files)
   */
  const getFileStream = async (fileId: string): Promise<ReadableStream<Uint8Array>> => {
    const file = getFile(fileId)

    if (file.source === "local") {
      // Convert Blob to stream (supported in modern browsers)
      return file.data.stream()
    }

    // For remote files, fetch and return the stream (doesn't load into memory!)
    const response = await fetch(file.remoteUrl)
    if (!response.ok || !response.body) {
      throw new Error(`Failed to fetch file stream: ${response.statusText}`)
    }
    return response.body
  }

  /**
   * Replace a file's data with new content (e.g., after cropping/editing).
   * This creates a new File/Blob and marks the file as needing re-upload.
   *
   * @param fileId - The ID of the file to replace
   * @param newData - The new file data (Blob or File)
   * @param newName - Optional new filename
   * @param shouldAutoUpload - Whether to auto-upload after replacing (defaults to autoUpload setting)
   */
  const replaceFileData = async (
    fileId: string,
    newData: Blob,
    newName?: string,
    shouldAutoUpload?: boolean,
  ): Promise<UploadFile<TUploadResult>> => {
    const file = getFile(fileId)

    // Cleanup cached object URL to prevent stale thumbnail display
    cleanupObjectURLs(createdObjectURLs, fileId)

    // Convert to LocalUploadFile since we now have local data
    const updatedFile: LocalUploadFile = {
      ...file,
      source: "local",
      data: newData,
      name: newName || file.name,
      size: newData.size,
      status: "waiting",
      progress: { percentage: 0 },
      remoteUrl: undefined,
      meta: {},
    }

    // Re-run preprocess hooks to regenerate thumbnails/previews with new data
    const preprocessedFile = await runPluginStage("preprocess", updatedFile)
    const finalFile = preprocessedFile || updatedFile

    // Update the file in the array
    const index = files.value.findIndex((f) => f.id === fileId)
    if (index === -1) {
      throw new Error(`File not found: ${fileId}`)
    }
    files.value[index] = finalFile

    // Emit events
    emitter.emit("file:replaced", finalFile)
    emitter.emit("file:added", finalFile)

    // Reset files:uploaded flag since we have a file that needs re-upload
    setHasEmittedFilesUploaded(false)

    // Auto-upload if requested (respects autoUpload setting by default)
    const shouldUpload = shouldAutoUpload ?? options.autoUpload
    if (shouldUpload) {
      upload()
    }

    return finalFile
  }

  /**
   * Reorder a file in the list
   */
  const reorderFile = (oldIndex: number, newIndex: number): void => {
    if (oldIndex === newIndex) {
      if (import.meta.dev) {
        console.warn("Cannot reorder file to the same index")
      }
      return
    }

    if (oldIndex < 0 || oldIndex >= files.value.length || newIndex < 0 || newIndex >= files.value.length) {
      if (import.meta.dev) {
        console.warn(`Cannot reorder file from ${oldIndex} to ${newIndex} since it is out of bounds`)
      }
      return
    }

    const filesCopy = [...files.value]
    const [movedFile] = filesCopy.splice(oldIndex, 1)
    filesCopy.splice(newIndex, 0, movedFile!)

    files.value = filesCopy

    emitter.emit("files:reorder", { oldIndex, newIndex })
  }

  /**
   * Remove a file from the upload manager.
   *
   * @param fileId - The ID of the file to remove
   * @param removeOptions - Options for controlling storage deletion behavior
   * @param removeOptions.deleteFromStorage - Controls whether to delete the file from remote storage:
   *   - `"always"` (default): Always delete from storage if the file has a remoteUrl
   *   - `"never"`: Never delete from storage, only remove from local state
   *   - `"local-only"`: Only delete files that were uploaded in this session (source === "local"),
   *     preserving files that were loaded from storage via initializeExistingFiles
   */
  const removeFile = async (
    fileId: string,
    removeOptions?: { deleteFromStorage?: "always" | "never" | "local-only" },
  ): Promise<void> => {
    const { deleteFromStorage = "always" } = removeOptions ?? {}
    const file = files.value.find((f) => f.id === fileId)

    if (!file) return

    // Determine if we should delete from storage based on the deleteFromStorage option
    let shouldDelete: boolean
    switch (deleteFromStorage) {
      case "always":
        shouldDelete = true
        break
      case "never":
        shouldDelete = false
        break
      case "local-only":
        shouldDelete = file.source === "local"
        break
    }

    // Only call storage plugin's remove hook if shouldDelete is true and file has remoteUrl
    if (shouldDelete && file.remoteUrl) {
      const storagePlugin = getStoragePlugin()
      if (storagePlugin?.hooks.remove) {
        try {
          const context = createPluginContext(storagePlugin.id, files.value, options, emitter, storagePlugin)
          await storagePlugin.hooks.remove(file, context)
        } catch (error) {
          console.error(`Storage plugin remove error:`, error)
          // Continue with local removal even if storage removal fails
        }
      }
    }

    // Clean up any object URLs we created for this file
    cleanupObjectURLs(createdObjectURLs, file.id)

    files.value = files.value.filter((f) => f.id !== fileId)
    emitter.emit("file:removed", file)
  }

  /**
   * Remove multiple files from the upload manager.
   * Note: This only removes files locally and does NOT delete from remote storage.
   * Use removeFile() individually if storage deletion is needed.
   */
  const removeFiles = (fileIds: string[]): UploadFile<TUploadResult>[] => {
    const removedFiles = files.value.filter((f) => fileIds.includes(f.id))

    // Clean up object URLs for removed files
    removedFiles.forEach((file) => {
      cleanupObjectURLs(createdObjectURLs, file.id)
    })

    files.value = files.value.filter((f) => !fileIds.includes(f.id))

    removedFiles.forEach((file) => {
      emitter.emit("file:removed", file)
    })

    return removedFiles
  }

  /**
   * Clear all files from the upload manager.
   * Note: This only removes files locally and does NOT delete from remote storage.
   * Use removeFile() individually if storage deletion is needed.
   */
  const clearFiles = (): UploadFile<TUploadResult>[] => {
    const allFiles = [...files.value]

    // Clean up all object URLs
    cleanupObjectURLs(createdObjectURLs)

    files.value = []

    allFiles.forEach((file) => {
      emitter.emit("file:removed", file)
    })

    return allFiles
  }

  /**
   * Reset the upload manager (clear files and cleanup)
   */
  const reset = (): void => {
    cleanupObjectURLs(createdObjectURLs)
    files.value = []
  }

  return {
    getFile,
    getFileData,
    getFileURL,
    getFileStream,
    replaceFileData,
    reorderFile,
    removeFile,
    removeFiles,
    clearFiles,
    reset,
  }
}
