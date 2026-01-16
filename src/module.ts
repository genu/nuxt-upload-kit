import { defineNuxtModule, addImports, createResolver } from "@nuxt/kit"

// Export all types from runtime
export type * from "./runtime/types"

// Module options TypeScript interface definition
export interface ModuleOptions {
  /**
   * Enable auto-import of useUploadKit composable
   * @default true
   */
  autoImport?: boolean
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: "nuxt-upload-kit",
    configKey: "uploadKit",
  },
  defaults: {
    autoImport: true,
  },
  setup(options, _nuxt) {
    const resolver = createResolver(import.meta.url)

    // Exclude FFmpeg packages from Vite's dependency optimization
    // @see https://github.com/ffmpegwasm/ffmpeg.wasm/issues/532
    // FFmpeg uses Web Workers that don't work correctly when pre-bundled by Vite
    _nuxt.options.vite = _nuxt.options.vite ?? {}
    _nuxt.options.vite.optimizeDeps = _nuxt.options.vite.optimizeDeps ?? {}
    _nuxt.options.vite.optimizeDeps.exclude = _nuxt.options.vite.optimizeDeps.exclude ?? []
    _nuxt.options.vite.optimizeDeps.exclude.push("@ffmpeg/ffmpeg", "@ffmpeg/util")

    if (options.autoImport) {
      // Auto-import useUploadKit composable
      addImports([
        {
          name: "useUploadKit",
          from: resolver.resolve("./runtime/composables/useUploadKit"),
        },
        {
          name: "useFFMpeg",
          from: resolver.resolve("./runtime/composables/useFFMpeg"),
        },
      ])
    }

    // Add #upload-kit alias for types and runtime
    _nuxt.options.alias["#upload-kit"] = resolver.resolve("./runtime")
  },
})
