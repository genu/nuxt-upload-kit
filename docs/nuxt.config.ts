export default defineNuxtConfig({
  site: {
    name: "Nuxt Upload Kit",
  },

  css: ["~/assets/css/main.css"],

  nitro: {
    preset: "vercel",
  },

  compatibilityDate: "2025-01-14",
})
