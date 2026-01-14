export default defineNuxtConfig({
  modules: ["../src/module"],

  uploadKit: {
    autoImport: true,
  },

  devtools: { enabled: true },

  compatibilityDate: "2025-01-14",
})
