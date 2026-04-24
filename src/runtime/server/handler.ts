import { defineEventHandler, createError } from "h3"

export default defineEventHandler(() => {
  throw createError({
    statusCode: 501,
    statusMessage: "Not Implemented",
    message: "nuxt-upload-kit server endpoints are not yet implemented (v0.2 scaffold).",
  })
})
