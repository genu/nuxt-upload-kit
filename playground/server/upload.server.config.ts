import { defineUploadServerConfig } from "#upload-kit/server"

export default defineUploadServerConfig({
  authorize: async () => {
    return { userId: "playground" }
  },
})
