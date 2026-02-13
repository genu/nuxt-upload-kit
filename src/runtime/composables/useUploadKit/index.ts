import mitt from "mitt"
import { computed, onBeforeUnmount, readonly, ref } from "vue"
import type {
  UploaderEvents,
  UploadFile,
  LocalUploadFile,
  RemoteUploadFile,
  UploadOptions,
  UploadStatus,
  FileError,
  Plugin as UploaderPlugin,
  ProcessingPlugin,
  StoragePlugin,
  InitialFileInput,
} from "./types"
import { ValidatorAllowedFileTypes, ValidatorMaxFileSize, ValidatorMaxFiles } from "./validators"
import { PluginThumbnailGenerator, PluginImageCompressor } from "./plugins"
import { createPluginContext, createFileError, getExtension, setupInitialFiles } from "./utils"
import { createPluginRunner } from "./plugin-runner"
import { createFileOperations } from "./file-operations"

const defaultOptions: UploadOptions = {
  storage: undefined,
  plugins: [],
  maxFileSize: false,
  allowedFileTypes: false,
  maxFiles: false,
  thumbnails: false,
  imageCompression: false,
  autoUpload: false,
}

export const useUploadKit = <TUploadResult = any>(_options: UploadOptions = {}) => {
  const options = { ...defaultOptions, ..._options } as UploadOptions
  const files = ref<UploadFile<TUploadResult>[]>([])
  const emitter = mitt<any>()
  const status = ref<UploadStatus>("waiting")
  const isReady = ref(options.initialFiles === undefined)

  // Track created object URLs for automatic cleanup
  const createdObjectURLs = new Map<string, string>()

  // Track if we've emitted files:uploaded to prevent duplicate emissions
  let hasEmittedFilesUploaded = false

  /**
   * Get the active storage plugin
   */
  const getStoragePlugin = (): StoragePlugin<any, any> | null => {
    return options.storage || null
  }

  const addPlugin = (plugin: UploaderPlugin<any, any>) => {
    if (options.plugins) {
      options.plugins.push(plugin as ProcessingPlugin<any, any>)
    } else {
      options.plugins = [plugin as ProcessingPlugin<any, any>]
    }
  }

  // Add built-in plugins based on options
  if (options.maxFiles !== false && options.maxFiles !== undefined) {
    addPlugin(ValidatorMaxFiles({ maxFiles: options.maxFiles }))
  }

  if (options.maxFileSize !== false && options.maxFileSize !== undefined) {
    addPlugin(ValidatorMaxFileSize({ maxFileSize: options.maxFileSize }))
  }

  if (options.allowedFileTypes !== false && options.allowedFileTypes !== undefined && options.allowedFileTypes.length > 0) {
    addPlugin(ValidatorAllowedFileTypes({ allowedFileTypes: options.allowedFileTypes }))
  }

  if (options.thumbnails !== false && options.thumbnails !== undefined) {
    const thumbOpts = options.thumbnails === true ? {} : options.thumbnails || {}
    addPlugin(
      PluginThumbnailGenerator({
        maxWidth: thumbOpts.width ?? 128,
        maxHeight: thumbOpts.height ?? 128,
        quality: thumbOpts.quality ?? 1,
        upload: thumbOpts.upload ?? false,
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

  // Create plugin runner
  const { getPluginEmitFn, runPluginStage } = createPluginRunner({ options, files, emitter, getStoragePlugin })

  // Upload function holder - assigned after upload() is defined below
  const uploadHolder: { fn: () => Promise<void> } = { fn: async () => {} }

  // Create file operations (cast files to avoid Vue's UnwrapRef type complexity)
  const fileOps = createFileOperations({
    files: files as any,
    emitter,
    options,
    createdObjectURLs,
    getStoragePlugin,
    runPluginStage,
    upload: () => uploadHolder.fn(),
    setHasEmittedFilesUploaded: (value: boolean) => {
      hasEmittedFilesUploaded = value
    },
  })

  const totalProgress = computed(() => {
    if (files.value.length === 0) return 0
    const sum = files.value.reduce((acc, file) => acc + file.progress.percentage, 0)
    return Math.round(sum / files.value.length)
  })

  // Default event handlers
  emitter.on("upload:progress", ({ file, progress }) => {
    updateFile(file.id, { progress: { percentage: progress } })
  })

  const updateFile = (fileId: string, updatedFile: Partial<UploadFile<TUploadResult>>) => {
    files.value = files.value.map((file) => (file.id === fileId ? ({ ...file, ...updatedFile } as UploadFile) : file))
  }

  /**
   * Resolve an array of InitialFileInput into RemoteUploadFile objects via the storage plugin.
   */
  const resolveRemoteFiles = async (initialFiles: InitialFileInput[]): Promise<UploadFile<TUploadResult>[]> => {
    const storagePlugin = getStoragePlugin()
    if (!storagePlugin?.hooks.getRemoteFile) {
      throw new Error("Storage plugin with getRemoteFile hook is required to resolve remote files")
    }

    const resolved = await Promise.all(
      initialFiles.map(async (file) => {
        const storageKey = file.storageKey
        if (!storageKey) return null

        const context = createPluginContext(storagePlugin.id, files.value, options, emitter, storagePlugin)
        const remoteFileData = await storagePlugin.hooks.getRemoteFile(storageKey, context)

        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
        const name = storageKey.split("/").pop() || storageKey

        const existingFile: RemoteUploadFile<TUploadResult> = {
          ...file,
          id,
          storageKey,
          name,
          data: null,
          status: "complete",
          progress: { percentage: 100 },
          meta: {},
          size: remoteFileData.size,
          mimeType: remoteFileData.mimeType,
          remoteUrl: remoteFileData.remoteUrl,
          preview: remoteFileData.preview || remoteFileData.remoteUrl,
          source: "storage",
          uploadResult: remoteFileData.uploadResult,
        }

        return existingFile
      }),
    )

    return resolved.filter((f) => f !== null) as UploadFile<TUploadResult>[]
  }

  const initializeExistingFiles = async (initialFiles: InitialFileInput[]) => {
    const resolvedFiles = await resolveRemoteFiles(initialFiles)
    files.value = [...resolvedFiles]
  }

  /**
   * Append pre-existing remote files without replacing current files.
   * Skips files already present (matched by storageKey) and respects maxFiles.
   */
  const appendExistingFiles = async (initialFiles: InitialFileInput[]): Promise<UploadFile<TUploadResult>[]> => {
    // Deduplicate: skip files already present by storageKey
    const existingKeys = new Set(files.value.map((f) => f.storageKey).filter(Boolean))
    let filesToAdd = initialFiles.filter((f) => f.storageKey && !existingKeys.has(f.storageKey))

    if (filesToAdd.length === 0) return []

    // Respect maxFiles limit
    if (options.maxFiles !== false && options.maxFiles !== undefined) {
      const available = options.maxFiles - files.value.length
      if (available <= 0) return []
      filesToAdd = filesToAdd.slice(0, available)
    }

    const resolvedFiles = await resolveRemoteFiles(filesToAdd)

    files.value.push(...resolvedFiles)

    resolvedFiles.forEach((file) => {
      emitter.emit("file:added", file)
    })

    return resolvedFiles
  }

  const addFile = async (file: File) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const extension = getExtension(file.name)

    const uploadFile: LocalUploadFile = {
      id: `${id}.${extension}`,
      progress: { percentage: 0 },
      name: file.name,
      size: file.size,
      status: "waiting",
      mimeType: file.type,
      data: file,
      source: "local",
      meta: { extension },
    }

    try {
      const validatedFile = await runPluginStage("validate", uploadFile)
      if (!validatedFile) {
        throw new Error(`File validation failed for ${file.name}`)
      }

      const preprocessedFile = await runPluginStage("preprocess", validatedFile)
      const fileToAdd = preprocessedFile || validatedFile

      files.value.push(fileToAdd)
      emitter.emit("file:added", fileToAdd)

      hasEmittedFilesUploaded = false

      if (options.autoUpload) {
        uploadHolder.fn()
      }

      return validatedFile
    } catch (err) {
      const error = createFileError(uploadFile, err)
      const fileWithError = { ...uploadFile, status: "error" as const, error }
      files.value.push(fileWithError)
      emitter.emit("file:error", { file: fileWithError, error })
      throw err
    }
  }

  const addFiles = async (newFiles: File[]) => {
    const results = await Promise.allSettled(newFiles.map((file) => addFile(file)))
    const addedFiles = results
      .filter((r): r is PromiseFulfilledResult<UploadFile> => r.status === "fulfilled")
      .map((r) => r.value)
    return addedFiles
  }

  /**
   * Extract storageKey from upload result if available
   */
  const extractStorageKey = (uploadResult: TUploadResult): string | undefined => {
    if (uploadResult && typeof uploadResult === "object" && "storageKey" in uploadResult) {
      return (uploadResult as { storageKey: string }).storageKey
    }
    return undefined
  }

  /**
   * Upload a single file and update its state
   */
  const uploadSingleFile = async (file: UploadFile<TUploadResult>): Promise<void> => {
    const processedFile = await runPluginStage("process", file)

    if (!processedFile) {
      const error = createFileError(file, new Error("File processing failed"))
      updateFile(file.id, { status: "error", error })
      emitter.emit("file:error", { file, error } as { file: Readonly<UploadFile<TUploadResult>>; error: FileError })
      return
    }

    if (processedFile.id !== file.id) {
      files.value = files.value.map((f) => (f.id === file.id ? processedFile : f))
    }

    updateFile(processedFile.id, { status: "uploading" })

    const onProgress = (progress: number) => {
      updateFile(processedFile.id, { progress: { percentage: progress } })
      emitter.emit("upload:progress", { file: processedFile, progress } as {
        file: Readonly<UploadFile<TUploadResult>>
        progress: number
      })
    }

    const storagePlugin = getStoragePlugin()
    if (!storagePlugin?.hooks.upload) {
      throw new Error("Storage plugin with upload hook is required")
    }

    const context = {
      files: files.value,
      options,
      onProgress,
      emit: getPluginEmitFn(storagePlugin.id),
    }
    const result = await storagePlugin.hooks.upload(file, context)
    const uploadResult = result as TUploadResult
    const remoteUrl = result.url

    const currentFile = files.value.find((f) => f.id === processedFile.id)
    const preview = currentFile?.preview || remoteUrl
    const storageKey = extractStorageKey(uploadResult)

    // Get thumbnail from file if it was uploaded by the thumbnail plugin
    const thumbnail = currentFile?.thumbnail

    updateFile(processedFile.id, { status: "complete", uploadResult, remoteUrl, preview, storageKey, thumbnail })
  }

  // Define upload function
  const upload = async () => {
    const filesToUpload = files.value.filter((f) => f.status === "waiting")

    emitter.emit("upload:start", filesToUpload as Array<Readonly<UploadFile<TUploadResult>>>)

    for (const file of filesToUpload) {
      try {
        await uploadSingleFile(file as UploadFile<TUploadResult>)
      } catch (err) {
        const error = createFileError(file as UploadFile<TUploadResult>, err)
        updateFile(file.id, { status: "error", error })
        emitter.emit("file:error", { file, error } as { file: Readonly<UploadFile<TUploadResult>>; error: FileError })
      }
    }

    const completed = files.value.filter((f) => f.status === "complete")
    emitter.emit("upload:complete", completed as Array<Required<Readonly<UploadFile<TUploadResult>>>>)

    const allComplete = files.value.length > 0 && files.value.every((f) => f.status === "complete")
    if (allComplete && !hasEmittedFilesUploaded) {
      hasEmittedFilesUploaded = true
      emitter.emit("files:uploaded", files.value as Array<Readonly<UploadFile<TUploadResult>>>)
    }
  }

  // Assign upload function to holder for file operations to use
  uploadHolder.fn = upload

  // Clean up object URLs when component unmounts
  onBeforeUnmount(() => {
    createdObjectURLs.forEach((url) => {
      URL.revokeObjectURL(url)
    })
    createdObjectURLs.clear()
  })

  // Handle initialFiles option
  setupInitialFiles({
    initialFiles: options.initialFiles,
    files,
    isReady,
    emitter,
    initializeExistingFiles,
  })

  return {
    // State
    files: readonly(files),
    totalProgress,
    isReady: readonly(isReady),

    // Core Methods
    addFiles,
    addFile,
    removeFile: fileOps.removeFile,
    removeFiles: fileOps.removeFiles,
    clearFiles: fileOps.clearFiles,
    reorderFile: fileOps.reorderFile,
    getFile: fileOps.getFile,
    upload,
    reset: fileOps.reset,
    status,

    // File Data Access (for editing/processing)
    getFileData: fileOps.getFileData,
    getFileURL: fileOps.getFileURL,
    getFileStream: fileOps.getFileStream,
    replaceFileData: fileOps.replaceFileData,
    updateFile,
    initializeExistingFiles,
    appendExistingFiles,

    // Utilities
    addPlugin,

    // Events
    on: emitter.on as {
      <K extends keyof UploaderEvents<TUploadResult>>(type: K, handler: (event: UploaderEvents<TUploadResult>[K]) => void): void
      (type: string, handler: (event: any) => void): void
    },
  }
}
