export default defineNuxtConfig({
  modules: ["../src/module"],

  uploadKit: {
    autoImport: true,
    restrictions: {
      maxFileSize: 10 * 1024 * 1024,
      allowedMimeTypes: ["image/*", "video/*"],
    },
  },

  devtools: { enabled: true },

  compatibilityDate: "2025-01-14",
})
