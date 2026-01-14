import { defineConfig } from "vitest/config"
import vue from "@vitejs/plugin-vue"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [vue()],
  define: {
    "import.meta.dev": false,
  },
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/runtime/**/*.ts"],
      exclude: ["src/runtime/types/**", "**/*.d.ts"],
    },
    server: {
      deps: {
        inline: [/vue/],
      },
    },
  },
  resolve: {
    alias: {
      "#upload-kit": resolve(__dirname, "./src/runtime/types"),
    },
  },
})
