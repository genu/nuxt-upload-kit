import { existsSync } from "node:fs"
import { join } from "node:path"
import {
  defineNuxtModule,
  addImports,
  addServerHandler,
  addServerImports,
  addServerPlugin,
  createResolver,
  useLogger,
} from "@nuxt/kit"
import type { Restrictions } from "./runtime/shared"

// Export all types from runtime
export type * from "./runtime/types"

// Module options TypeScript interface definition
export interface ModuleOptions {
  /**
   * Enable auto-import of useUploadKit composable
   * @default true
   */
  autoImport?: boolean

  /**
   * Mount path for the auto-generated server endpoints.
   * The catch-all handler is registered at `${handlerRoute}/**`.
   * @default "/api/_upload"
   */
  handlerRoute?: string

  /**
   * Shared upload restrictions, enforced identically on the client and the server.
   * Set here once; both the `useUploadKit` composable and the auto-mounted server
   * handlers consume them via `runtimeConfig.public.uploadKit.restrictions`.
   *
   * @example
   * ```ts
   * uploadKit: {
   *   restrictions: {
   *     maxFileSize: 5_000_000,
   *     maxFiles: 10,
   *     allowedMimeTypes: ["image/*", "video/*"],
   *   },
   * }
   * ```
   */
  restrictions?: Restrictions
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: "nuxt-upload-kit",
    configKey: "uploadKit",
  },
  defaults: {
    autoImport: true,
    handlerRoute: "/api/_upload",
    restrictions: {},
  },
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)
    const logger = useLogger("nuxt-upload-kit")

    // Configure Vite's dependency optimization
    nuxt.options.vite = nuxt.options.vite ?? {}
    nuxt.options.vite.optimizeDeps = nuxt.options.vite.optimizeDeps ?? {}

    // Exclude FFmpeg packages - they use Web Workers that don't work correctly when pre-bundled
    // @see https://github.com/ffmpegwasm/ffmpeg.wasm/issues/532
    nuxt.options.vite.optimizeDeps.exclude = nuxt.options.vite.optimizeDeps.exclude ?? []
    nuxt.options.vite.optimizeDeps.exclude.push("@ffmpeg/ffmpeg", "@ffmpeg/util")

    // Include Node.js polyfills required by Azure SDK (used by Azure DataLake storage plugin)
    // The `events` package uses CommonJS exports that need pre-bundling for browser ESM
    nuxt.options.vite.optimizeDeps.include = nuxt.options.vite.optimizeDeps.include ?? []
    nuxt.options.vite.optimizeDeps.include.push("events")

    if (options.autoImport) {
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

    // Client alias
    nuxt.options.alias["#upload-kit"] = resolver.resolve("./runtime")

    // Server alias — resolves in Nitro for `import { defineUploadServerConfig } from "#upload-kit/server"`
    nuxt.options.nitro = nuxt.options.nitro ?? {}
    nuxt.options.nitro.alias = nuxt.options.nitro.alias ?? {}
    nuxt.options.nitro.alias["#upload-kit/server"] = resolver.resolve("./runtime/server")

    // Detect convention file
    const conventionFile = join(nuxt.options.serverDir, "upload.server.config.ts")
    if (!existsSync(conventionFile)) {
      logger.warn(
        "No server config found at `server/upload.server.config.ts`. Server-side uploads are disabled. " +
          "Create the file and export `defineUploadServerConfig({ storage, ... })` to enable them.",
      )
      return
    }

    // Bind the user's convention file so handlers + useServerUpload can import it
    nuxt.options.nitro.alias["#upload-kit-user-config"] = conventionFile

    if (options.autoImport) {
      addServerImports([
        {
          name: "useServerUpload",
          from: resolver.resolve("./runtime/server/use-server-upload"),
        },
      ])
    }

    const handlerRoute = options.handlerRoute ?? "/api/_upload"
    if (!handlerRoute.startsWith("/") || handlerRoute.endsWith("/") || handlerRoute.includes(":") || handlerRoute.includes("*")) {
      throw new Error(
        `[nuxt-upload-kit] Invalid \`handlerRoute\`: "${handlerRoute}". Must start with "/", not end with "/", and contain no ":" or "*" segments.`,
      )
    }

    // Expose shared config to both runtimes via runtimeConfig.public. The Nitro bootstrap
    // plugin (below) augments this at server startup with the resolved upload mode +
    // adapter capabilities, derived from the user's storage adapter.
    nuxt.options.runtimeConfig.public.uploadKit = {
      ...(nuxt.options.runtimeConfig.public.uploadKit as Record<string, unknown> | undefined),
      handlerRoute,
      restrictions: options.restrictions ?? {},
    }

    addServerPlugin(resolver.resolve("./runtime/server/plugins/bootstrap"))

    addServerHandler({
      route: `${handlerRoute}/presign`,
      method: "post",
      handler: resolver.resolve("./runtime/server/handlers/presign"),
    })

    addServerHandler({
      route: `${handlerRoute}/direct`,
      method: "post",
      handler: resolver.resolve("./runtime/server/handlers/direct"),
    })

    addServerHandler({
      route: `${handlerRoute}/download/:fileId`,
      method: "get",
      handler: resolver.resolve("./runtime/server/handlers/download"),
    })

    addServerHandler({
      route: `${handlerRoute}/:fileId`,
      method: "delete",
      handler: resolver.resolve("./runtime/server/handlers/delete"),
    })
  },
})
