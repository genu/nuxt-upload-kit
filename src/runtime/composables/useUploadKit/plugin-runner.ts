import type { Ref } from "vue"
import type { Emitter } from "mitt"
import type {
  UploadFile,
  UploadOptions,
  PluginLifecycleStage,
  FileError,
  ValidationHook,
  ProcessingHook,
  SetupHook,
  PluginContext,
  StoragePlugin,
} from "./types"

type EmitFn = <K extends string | number | symbol>(event: K, payload: any) => void

export interface PluginRunnerDeps<TUploadResult = any> {
  options: UploadOptions
  files: Ref<UploadFile<TUploadResult>[]>
  emitter: Emitter<any>
  getStoragePlugin: () => StoragePlugin<any, any> | null
}

/**
 * Creates the plugin execution system with cached emit functions
 *
 * Performance optimization: Creates emit functions once per plugin instead of on every hook call.
 * - For 100 files × 5 plugins = 500+ function allocations without caching
 * - With caching: Only 5 function allocations total
 */
export function createPluginRunner<TUploadResult = any>(deps: PluginRunnerDeps<TUploadResult>) {
  const { options, files, emitter, getStoragePlugin } = deps

  // Cache for plugin emit functions
  const pluginEmitFunctions = new Map<string, EmitFn>()

  /**
   * Get or create a cached emit function for a plugin.
   * The emit function automatically prefixes events with the plugin ID:
   * - context.emit("skip", data) → emitter.emit("image-compressor:skip", data)
   */
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

  /**
   * Call a plugin hook based on the lifecycle stage
   */
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

  /**
   * Run all plugins for a given lifecycle stage
   */
  async function runPluginStage(
    stage: Exclude<PluginLifecycleStage, "upload">,
    file?: UploadFile,
  ): Promise<UploadFile | undefined | null> {
    if (!options.plugins) return file

    let currentFile = file

    for (const plugin of options.plugins) {
      const hook = plugin.hooks[stage]
      if (!hook) continue

      try {
        const storage = getStoragePlugin()
        const context: PluginContext = {
          files: files.value,
          options,
          storage: storage || undefined,
          emit: getPluginEmitFn(plugin.id),
        }

        const result = await callPluginHook(hook, stage, currentFile, context)

        if (result && currentFile && "id" in result) {
          currentFile = result
        }
      } catch (error) {
        if (currentFile) {
          emitter.emit("file:error", { file: currentFile, error: error as FileError })
        }
        console.error(`Plugin ${plugin.id} ${stage} hook error:`, error)
        return null
      }
    }

    return currentFile
  }

  return {
    getPluginEmitFn,
    runPluginStage,
  }
}
