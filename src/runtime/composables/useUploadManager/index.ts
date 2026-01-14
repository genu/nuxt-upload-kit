import mitt from "mitt"
import { computed, onBeforeUnmount, readonly, ref } from "vue"
import type {
  UploaderEvents,
  UploadFile,
  LocalUploadFile,
  RemoteUploadFile,
  UploadOptions,
  UploadStatus,
  PluginLifecycleStage,
  FileError,
  ValidationHook,
  ProcessingHook,
  SetupHook,
  PluginContext,
  UploadFn,
  GetRemoteFileFn,
  Plugin as UploaderPlugin,
  ProcessingPlugin,
  StoragePlugin,
} from "./types"
import { ValidatorAllowedFileTypes, ValidatorMaxFileSize, ValidatorMaxFiles } from "./validators"
import { PluginThumbnailGenerator, PluginImageCompressor } from "./plugins"
import { createPluginContext, createFileError, cleanupObjectURLs } from "./utils"

/**
 * Type guard to check if a plugin is a storage plugin
 */
function isStoragePlugin(plugin: UploaderPlugin<any, any> | null): plugin is StoragePlugin<any, any> {
  return plugin !== null && "upload" in plugin.hooks
}

/**
 * Get file extension from filename
 */
function getExtension(fullFileName: string): string {
  const lastDot = fullFileName.lastIndexOf(".")

  if (lastDot === -1 || lastDot === fullFileName.length - 1) {
    throw new Error("Invalid file name")
  }

  return fullFileName.slice(lastDot + 1).toLocaleLowerCase()
}

const defaultOptions: UploadOptions = {
  storage: undefined,
  plugins: [],
  maxFileSize: false,
  allowedFileTypes: false,
  maxFiles: false,
  thumbnails: false,
  imageCompression: false,
  autoProceed: false,
}

export const useUploadManager = <TUploadResult = any>(_options: UploadOptions = {}) => {
  const options = { ...defaultOptions, ..._options } as UploadOptions
  const files = ref<UploadFile<TUploadResult>[]>([])
  // Use any internally to avoid intersection type issues, but provide proper types on the return
  const emitter = mitt<any>()
  const status = ref<UploadStatus>("waiting")

  // Track created object URLs for automatic cleanup
  const createdObjectURLs = new Map<string, string>() // fileId -> objectURL

  /**
   * Performance optimization: Create emit functions once per plugin instead of on every hook call.
   *
   * Why this matters:
   * - For 100 files × 5 plugins = 500+ function allocations without caching
   * - With caching: Only 5 function allocations total
   * - Emit functions are stable (only depend on plugin.id and emitter)
   *
   * The emit function automatically prefixes events with the plugin ID:
   * - context.emit("skip", data) → emitter.emit("image-compressor:skip", data)
   */
  type EmitFn = <K extends string | number | symbol>(event: K, payload: any) => void
  const pluginEmitFunctions = new Map<string, EmitFn>()

  const getPluginEmitFn = (pluginId: string): EmitFn => {
    let emitFn = pluginEmitFunctions.get(pluginId)
    if (!emitFn) {
      emitFn = (event: any, payload: any) => {
        const prefixedEvent = `${pluginId}:${String(event)}`
        emitter.emit(prefixedEvent, payload)
      }
      pluginEmitFunctions.set(pluginId, emitFn)
    }
    return emitFn
  }

  let uploadFn: UploadFn = async () => {
    throw new Error("No uploader configured")
  }

  let getRemoteFileFn: GetRemoteFileFn = async () => {
    throw new Error("Function to get remote file not configured")
  }

  const totalProgress = computed(() => {
    if (files.value.length === 0) return 0
    const sum = files.value.reduce((acc, file) => acc + file.progress.percentage, 0)

    return Math.round(sum / files.value.length)
  })

  /**
   * Utilities
   */

  /**
   * Get the active storage plugin
   * Priority: options.storage > legacy plugins array with storage hooks
   */
  const getStoragePlugin = (): StoragePlugin<any, any> | null => {
    // First check new storage option
    if (options.storage) {
      return options.storage
    }

    // Backward compatibility: check plugins array for storage plugins (deprecated)
    if (!options.plugins) return null

    // Find storage plugin in legacy plugins array (has upload hook)
    for (let i = options.plugins.length - 1; i >= 0; i--) {
      const plugin = options.plugins[i] || null
      if (isStoragePlugin(plugin)) {
        if (import.meta.dev) {
          console.warn(
            `[useUploadManager] Storage plugin "${plugin.id}" found in plugins array.\n` +
              `This is deprecated. Use the 'storage' option instead:\n\n` +
              `  useUploadManager({ storage: ${plugin.id}(...) })`,
          )
        }
        return plugin
      }
    }

    return null
  }

  const addPlugin = (plugin: UploaderPlugin<any, any>) => {
    // Detect and warn about storage plugins being added via addPlugin (deprecated)
    const hasUploadHook = "upload" in plugin.hooks
    if (hasUploadHook) {
      if (import.meta.dev) {
        console.warn(
          `[useUploadManager] Storage plugin "${plugin.id}" should use the 'storage' option instead of 'plugins':\n\n` +
            `  useUploadManager({\n` +
            `    storage: ${plugin.id}({ ... }),  // ✓ Correct\n` +
            `    plugins: [...]                    // Only for validators/processors\n` +
            `  })\n`,
        )
      }
    }

    if (options.plugins) {
      options.plugins.push(plugin as ProcessingPlugin<any, any>)
    } else {
      options.plugins = [plugin as ProcessingPlugin<any, any>]
    }
  }

  /**
   * Add built-in plugins based on options
   */

  // Validators - only add if explicitly configured
  if (options.maxFiles !== false && options.maxFiles !== undefined) {
    addPlugin(ValidatorMaxFiles({ maxFiles: options.maxFiles }))
  }

  if (options.maxFileSize !== false && options.maxFileSize !== undefined) {
    addPlugin(ValidatorMaxFileSize({ maxFileSize: options.maxFileSize }))
  }

  if (options.allowedFileTypes !== false && options.allowedFileTypes !== undefined && options.allowedFileTypes.length > 0) {
    addPlugin(ValidatorAllowedFileTypes({ allowedFileTypes: options.allowedFileTypes }))
  }

  // Processors - only add if explicitly enabled
  if (options.thumbnails !== false && options.thumbnails !== undefined) {
    const thumbOpts = options.thumbnails === true ? {} : options.thumbnails || {}
    addPlugin(
      PluginThumbnailGenerator({
        maxWidth: thumbOpts.width ?? 128,
        maxHeight: thumbOpts.height ?? 128,
        quality: thumbOpts.quality ?? 1,
      }),
    )
  }

  if (options.imageCompression !== false && options.imageCompression !== undefined) {
    const compressionOpts = options.imageCompression === true ? {} : options.imageCompression || {}
    addPlugin(
      PluginImageCompressor({
        maxWidth: compressionOpts.maxWidth ?? 1920,
        maxHeight: compressionOpts.maxHeight ?? 1920,
        quality: compressionOpts.quality ?? 0.85,
        outputFormat: compressionOpts.outputFormat ?? "auto",
        minSizeToCompress: compressionOpts.minSizeToCompress ?? 100000,
        preserveMetadata: compressionOpts.preserveMetadata ?? true,
      }),
    )
  }

  /**
   * Default events
   */

  emitter.on("upload:progress", ({ file, progress }) => {
    updateFile(file.id, { progress: { percentage: progress } })
  })

  /**
   * Callbacks
   */

  const updateFile = (fileId: string, updatedFile: Partial<UploadFile<TUploadResult>>) => {
    files.value = files.value.map((file) => (file.id === fileId ? ({ ...file, ...updatedFile } as UploadFile) : file))
  }

  /**
   * Upload function called for each file.
   *
   * @param fn - The function to call when uploading a file. This function receives a file and a progress callback.
   *             It should return a promise that resolves with the upload URL of the uploaded file.
   *             @example
   *             const uploadFn: UploadFn = async (file, onProgress) => {
   *               // Perform the upload and call onProgress with the upload progress percentage
   *               onProgress(50); // 50% progress
   *               return "https://example.com/uploaded-file-url"; // Return the upload URL
   *             }
   * @returns void
   */
  const onUpload = (fn: UploadFn<TUploadResult>) => {
    uploadFn = fn
  }

  /**
   * @param fn - The function to call when generating a remote preview URL for a file.
   */
  const onGetRemoteFile = (fn: GetRemoteFileFn) => {
    getRemoteFileFn = fn
  }

  const initializeExistingFiles = async (initialFiles: Array<Partial<UploadFile>>) => {
    const initializedfiles = await Promise.all(
      initialFiles.map(async (file) => {
        // If file.id is empty or undefined, skip this file because we can't get the remote file attributes
        if (!file.id) return null

        // Check if a storage plugin is available
        const storagePlugin = getStoragePlugin()
        let remoteFileData: { mimeType: string; size: number; remoteUrl: string; preview?: string }

        if (storagePlugin?.hooks.getRemoteFile) {
          // Use storage plugin to get remote file
          const context = createPluginContext(storagePlugin.id, files.value, options, emitter)
          remoteFileData = await storagePlugin.hooks.getRemoteFile(file.id!, context)
        } else {
          // Fall back to user-provided getRemoteFileFn
          remoteFileData = await getRemoteFileFn(file.id!)
        }

        const existingFile: RemoteUploadFile = {
          ...file,
          id: file.id!,
          name: file.id!,
          data: null,
          status: "complete",
          progress: { percentage: 100 },
          meta: {},
          size: remoteFileData.size,
          mimeType: remoteFileData.mimeType,
          remoteUrl: remoteFileData.remoteUrl,
          preview: remoteFileData.preview || file.preview || remoteFileData.remoteUrl, // Use preview from storage, passed-in value, or fallback to remoteUrl
          source: "storage", // File loaded from remote storage
        }

        // Remote files are already uploaded and processed - no need to run process hooks
        return existingFile
      }),
    )

    // Filter out files that failed to initialize
    const filteredFiles = initializedfiles.filter((f) => f !== null) as UploadFile[]

    files.value = [...filteredFiles]
  }

  const addFile = async (file: File) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const extension = getExtension(file.name)

    const uploadFile: LocalUploadFile = {
      id: `${id}.${extension}`,
      progress: {
        percentage: 0,
      },
      name: file.name,
      size: file.size,
      status: "waiting",
      mimeType: file.type,
      data: file,
      source: "local",
      meta: {
        extension,
      },
    }

    try {
      // Validate file before adding
      const validatedFile = await runPluginStage("validate", uploadFile)
      if (!validatedFile) {
        throw new Error(`File validation failed for ${file.name}`)
      }

      // Run preprocess hooks for immediate UI updates (thumbnails, previews)
      const preprocessedFile = await runPluginStage("preprocess", validatedFile)
      const fileToAdd = preprocessedFile || validatedFile

      // Add file - compression will happen before upload
      files.value.push(fileToAdd)
      emitter.emit("file:added", fileToAdd)

      if (options.autoProceed) {
        upload()
      }

      return validatedFile
    } catch (err) {
      // Add file with error status so user can see what failed
      const error = createFileError(uploadFile, err)

      const fileWithError = { ...uploadFile, status: "error" as const, error }
      files.value.push(fileWithError)
      emitter.emit("file:error", { file: fileWithError, error })

      throw err // Re-throw so caller knows validation failed
    }
  }

  const addFiles = async (newFiles: File[]) => {
    // Use allSettled to handle validation failures gracefully
    const results = await Promise.allSettled(newFiles.map((file) => addFile(file)))

    // Return successfully added files
    const addedFiles = results.filter((r): r is PromiseFulfilledResult<UploadFile> => r.status === "fulfilled").map((r) => r.value)

    return addedFiles
  }

  const removeFile = async (fileId: string) => {
    const file = files.value.find((f) => f.id === fileId)

    if (!file) return

    // Only call storage plugin's remove hook if file has a remoteUrl
    // remoteUrl indicates the file exists in remote storage and should be deleted
    // This applies to both:
    // - Local files that were uploaded (source: 'local', remoteUrl set after upload)
    // - Remote files (source: 'storage' | 'instagram' | etc., remoteUrl set from initialization)
    if (file.remoteUrl) {
      const storagePlugin = getStoragePlugin()
      if (storagePlugin?.hooks.remove) {
        try {
          const context = createPluginContext(storagePlugin.id, files.value, options, emitter)
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
    emitter.emit("file:removed", file as Readonly<UploadFile<TUploadResult>>)
  }

  const removeFiles = (fileIds: string[]) => {
    const removedFiles = files.value.filter((f) => fileIds.includes(f.id))

    // Clean up object URLs for removed files
    removedFiles.forEach((file) => {
      cleanupObjectURLs(createdObjectURLs, file.id)
    })

    files.value = files.value.filter((f) => !fileIds.includes(f.id))

    removedFiles.forEach((file) => {
      emitter.emit("file:removed", file as Readonly<UploadFile<TUploadResult>>)
    })

    return removedFiles
  }

  const clearFiles = () => {
    const allFiles = [...files.value]

    // Clean up all object URLs
    cleanupObjectURLs(createdObjectURLs)

    files.value = []

    allFiles.forEach((file) => {
      emitter.emit("file:removed", file as Readonly<UploadFile<TUploadResult>>)
    })

    return allFiles
  }

  /**
   * Get a File/Blob object for any file, regardless of source.
   * For local files, returns the existing data.
   * For remote files, fetches the file from the remote URL.
   *
   * ⚠️ WARNING: For large files (>100MB), this loads the entire file into memory.
   * Consider using getFileURL() or getFileStream() for large files instead.
   *
   * Use this when you need to edit/process small files (image cropping, etc.)
   *
   * @example
   * ```typescript
   * // User wants to crop an image
   * const blob = await getFileData(file.id)
   * const croppedBlob = await cropImage(blob)
   * await replaceFileData(file.id, croppedBlob)
   * ```
   */
  const getFileData = async (fileId: string): Promise<Blob> => {
    const file = getFile(fileId) // Now throws if not found

    // Log warning for large files
    if (file.size > 100 * 1024 * 1024) {
      // 100MB
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

  const getFileURL = async (fileId: string): Promise<string> => {
    const file = getFile(fileId) // Now throws if not found

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
   * Get a ReadableStream for a file (most memory efficient for large files).
   * For local files, converts the Blob to a stream.
   * For remote files, streams directly from the URL without loading into memory.
   *
   * Use this for processing large videos, raw images, or any file that doesn't fit in memory.
   *
   * @example
   * ```typescript
   * // Process a large video file with FFmpeg
   * const stream = await uploader.getFileStream(file.id)
   * const trimmedStream = await ffmpeg.trim(stream, startTime, endTime)
   * const trimmedBlob = await new Response(trimmedStream).blob()
   * await uploader.replaceFileData(file.id, trimmedBlob)
   * ```
   *
   * @example
   * ```typescript
   * // Process file in chunks
   * const stream = await uploader.getFileStream(file.id)
   * const reader = stream.getReader()
   * while (true) {
   *   const { done, value } = await reader.read()
   *   if (done) break
   *   processChunk(value) // Process each chunk
   * }
   * ```
   */
  const getFileStream = async (fileId: string): Promise<ReadableStream<Uint8Array>> => {
    const file = getFile(fileId) // Now throws if not found

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
   * @param shouldAutoUpload - Whether to auto-upload after replacing (defaults to autoProceed setting)
   *
   * @example
   * ```typescript
   * // After user crops an image - auto-upload if autoProceed is enabled
   * const croppedBlob = await cropImage(originalBlob)
   * await replaceFileData(file.id, croppedBlob, 'cropped-image.jpg')
   * ```
   *
   * @example
   * ```typescript
   * // Batch editing - prevent auto-upload until all edits are done
   * for (const fileId of selectedFiles) {
   *   const edited = await editFile(fileId)
   *   await replaceFileData(fileId, edited, undefined, false) // Don't upload yet
   * }
   * await upload() // Upload all at once
   * ```
   */
  const replaceFileData = async (fileId: string, newData: Blob, newName?: string, shouldAutoUpload?: boolean) => {
    const file = getFile(fileId) // Now throws if not found

    // Cleanup cached object URL to prevent stale thumbnail display
    cleanupObjectURLs(createdObjectURLs, fileId)

    // Convert to LocalUploadFile since we now have local data
    const updatedFile: LocalUploadFile = {
      ...file,
      source: "local",
      data: newData,
      name: newName || file.name,
      size: newData.size,
      status: "waiting", // Mark as needing upload
      progress: { percentage: 0 },
      remoteUrl: undefined, // Clear old remote URL
      meta: {}, // Clear old metadata (thumbnails, dimensions, etc.)
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
    emitter.emit("file:replaced", finalFile as Readonly<UploadFile<TUploadResult>>)
    emitter.emit("file:added", finalFile as Readonly<UploadFile<TUploadResult>>) // For backwards compatibility

    // Auto-upload if requested (respects autoProceed setting by default)
    const shouldUpload = shouldAutoUpload ?? options.autoProceed
    if (shouldUpload) {
      upload()
    }

    return finalFile
  }

  const reorderFile = (oldIndex: number, newIndex: number) => {
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

  const getFile = (fileId: string) => {
    const file = files.value.find((f) => f.id === fileId)
    if (!file) {
      throw new Error(`File not found: ${fileId}`)
    }
    return file
  }

  const upload = async () => {
    const filesToUpload = files.value.filter((f) => f.status === "waiting")

    emitter.emit("upload:start", filesToUpload as Array<Readonly<UploadFile<TUploadResult>>>)

    for (const file of filesToUpload) {
      try {
        // Process file (compression, etc.) before upload
        const processedFile = await runPluginStage("process", file)

        // If processing failed, mark as error and skip
        if (!processedFile) {
          const error = createFileError(file, new Error("File processing failed"))
          updateFile(file.id, { status: "error", error })
          emitter.emit("file:error", { file, error } as { file: Readonly<UploadFile<TUploadResult>>; error: FileError })
          continue
        }

        // Update file with processed data
        if (processedFile.id !== file.id) {
          // If processing changed the file, update it in the list
          files.value = files.value.map((f) => (f.id === file.id ? processedFile : f))
        }

        // Upload
        updateFile(processedFile.id, { status: "uploading" })

        const onProgress = (progress: number) => {
          updateFile(processedFile.id, { progress: { percentage: progress } })
          emitter.emit("upload:progress", { file: processedFile, progress } as {
            file: Readonly<UploadFile<TUploadResult>>
            progress: number
          })
        }

        // Check if a storage plugin is available
        const storagePlugin = getStoragePlugin()
        let uploadResult: TUploadResult
        let remoteUrl: string | undefined

        if (storagePlugin?.hooks.upload) {
          // Use storage plugin for upload
          const context = {
            files: files.value,
            options,
            onProgress,
            emit: getPluginEmitFn(storagePlugin.id),
          }
          const result = await storagePlugin.hooks.upload(processedFile, context)
          uploadResult = result
          // Storage plugins are required to return { url: string, ...other }
          remoteUrl = result.url
        } else {
          // Fall back to user-provided uploadFn
          uploadResult = await uploadFn(processedFile, onProgress)
          // Legacy uploadFn may return string URL directly or object with url
          remoteUrl = typeof uploadResult === "string" ? uploadResult : undefined
        }

        // Ensure preview is always set - fallback to remoteUrl if no preview exists
        const currentFile = files.value.find((f) => f.id === processedFile.id)
        const preview = currentFile?.preview || remoteUrl

        updateFile(processedFile.id, { status: "complete", uploadResult, remoteUrl, preview })
      } catch (err) {
        const error = createFileError(file, err)
        updateFile(file.id, { status: "error", error })
        emitter.emit("file:error", { file, error } as { file: Readonly<UploadFile<TUploadResult>>; error: FileError })
      }
    }

    const completed = files.value.filter((f) => f.status === "complete")
    emitter.emit("upload:complete", completed as Array<Required<Readonly<UploadFile<TUploadResult>>>>)
  }

  const reset = () => {
    // Clean up all object URLs
    cleanupObjectURLs(createdObjectURLs)

    files.value = []
  }

  // Clean up object URLs when component unmounts
  onBeforeUnmount(() => {
    createdObjectURLs.forEach((url) => {
      URL.revokeObjectURL(url)
    })
    createdObjectURLs.clear()
  })

  // Add this helper function before runPluginStage
  const callPluginHook = async (
    hook: ValidationHook | ProcessingHook | SetupHook,
    stage: PluginLifecycleStage,
    file: UploadFile | undefined,
    context: PluginContext,
  ) => {
    switch (stage) {
      case "validate":
        await (hook as ValidationHook)(file!, context)
        return file!
      case "preprocess":
      case "process":
      case "complete":
        if (!file) throw new Error("File is required for this hook type")

        await (hook as ProcessingHook)(file, context)

        return file
      default:
        return file
    }
  }

  // Replace the existing runPluginStage function
  async function runPluginStage(stage: Exclude<PluginLifecycleStage, "upload">, file?: UploadFile) {
    if (!options.plugins) return file

    let currentFile = file

    for (const plugin of options.plugins) {
      const hook = plugin.hooks[stage]
      if (hook) {
        try {
          // Create context with cached emit function (performance optimization)
          const context: PluginContext = {
            files: files.value,
            options,
            emit: getPluginEmitFn(plugin.id),
          }

          const result = await callPluginHook(hook, stage, currentFile, context)

          if (!result) continue

          if (currentFile && "id" in result) {
            currentFile = result as UploadFile
          }
        } catch (error) {
          if (currentFile) {
            emitter.emit("file:error", { file: currentFile, error: error as FileError })
          }
          console.error(`Plugin ${plugin.id} ${stage} hook error:`, error)
          return null
        }
      }
    }

    return currentFile
  }

  return {
    // State
    files: readonly(files),
    totalProgress,

    // Core Methods
    addFiles,
    addFile,
    onGetRemoteFile,
    onUpload,
    removeFile,
    removeFiles,
    clearFiles,
    reorderFile,
    getFile,
    upload,
    reset,
    status,

    // File Data Access (for editing/processing)
    getFileData,
    getFileURL,
    getFileStream,
    replaceFileData,
    updateFile,
    initializeExistingFiles,

    // Utilities
    addPlugin,

    // Events - autocomplete for core events, allow arbitrary strings for plugin events
    on: emitter.on as {
      <K extends keyof UploaderEvents<TUploadResult>>(type: K, handler: (event: UploaderEvents<TUploadResult>[K]) => void): void
      (type: string, handler: (event: any) => void): void
    },
  }
}
