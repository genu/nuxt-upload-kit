import { defineProcessingPlugin } from "../types"
import { calculateThumbnailDimensions, dataUrlToBlob, deriveThumbnailKey } from "../utils"

interface ThumbnailGeneratorOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  videoCaptureTime?: number
  upload?: boolean
}

export const PluginThumbnailGenerator = defineProcessingPlugin<ThumbnailGeneratorOptions>((pluginOptions) => {
  return {
    id: "thumbnail-generator",
    hooks: {
      preprocess: async (file, _context) => {
        const { maxWidth = 200, maxHeight = 200, quality = 0.7, videoCaptureTime = 1 } = pluginOptions

        // Skip non-image and non-video files
        if (!file.mimeType.startsWith("image/") && !file.mimeType.startsWith("video/")) {
          return file
        }

        // Skip GIFs (animated, would only show first frame)
        if (file.mimeType === "image/gif") {
          return file
        }

        // Skip SVGs (vector graphics, don't need thumbnails)
        if (file.mimeType === "image/svg+xml") {
          return file
        }

        // Skip remote files without local data
        if (file.source !== "local" || !file.data) {
          return file
        }

        // Create object URL for local file
        const sourceUrl = URL.createObjectURL(file.data)

        try {
          let thumbnailUrl: string | undefined
          if (file.mimeType.startsWith("image/")) {
            thumbnailUrl = await generateImageThumbnail(sourceUrl, maxWidth, maxHeight, quality)
          } else if (file.mimeType.startsWith("video/")) {
            thumbnailUrl = await generateVideoThumbnail(sourceUrl, maxWidth, maxHeight, quality, videoCaptureTime)
          }

          if (thumbnailUrl) {
            file.preview = thumbnailUrl
          }
        } catch (error) {
          console.warn(`[ThumbnailGenerator] Failed for ${file.name}:`, error)
        } finally {
          // Always clean up the object URL
          URL.revokeObjectURL(sourceUrl)
        }

        return file
      },

      process: async (file, context) => {
        const { upload = false } = pluginOptions

        // Upload thumbnail if enabled and storage is available
        if (upload && context.storage && file.preview?.startsWith("data:")) {
          try {
            const thumbnailBlob = dataUrlToBlob(file.preview)
            const thumbnailKey = deriveThumbnailKey(file.id)
            const thumbnailResult = await context.storage.upload(thumbnailBlob, thumbnailKey, {
              contentType: thumbnailBlob.type,
            })
            file.thumbnail = { url: thumbnailResult.url, storageKey: thumbnailResult.storageKey }
          } catch (err) {
            // Thumbnail upload failure is non-fatal — log and continue
            if (import.meta.dev) {
              console.warn(`[thumbnail-generator] Thumbnail upload failed for "${file.name}":`, err)
            }
          }
        }

        return file
      },
    },
  }
})

async function generateImageThumbnail(sourceUrl: string, maxWidth: number, maxHeight: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => {
      try {
        const { width, height } = calculateThumbnailDimensions(image.width, image.height, maxWidth, maxHeight)

        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext("2d")
        if (!ctx) {
          throw new Error("Failed to get canvas context")
        }

        ctx.drawImage(image, 0, 0, width, height)
        const thumbnailUrl = canvas.toDataURL("image/jpeg", quality)
        resolve(thumbnailUrl)
      } catch (error) {
        reject(error)
      }
    }

    image.onerror = () => {
      reject(new Error("Failed to load image"))
    }

    image.src = sourceUrl
  })
}

async function generateVideoThumbnail(
  sourceUrl: string,
  maxWidth: number,
  maxHeight: number,
  quality: number,
  captureTime: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video")
    video.preload = "metadata"
    video.muted = true

    video.onloadedmetadata = () => {
      // Use captureTime or 10% of duration, whichever is smaller
      const seekTime = Math.min(captureTime, video.duration * 0.1)
      video.currentTime = seekTime
    }

    video.onseeked = () => {
      try {
        const { width, height } = calculateThumbnailDimensions(video.videoWidth, video.videoHeight, maxWidth, maxHeight)

        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext("2d")
        if (!ctx) {
          throw new Error("Failed to get canvas context")
        }

        ctx.drawImage(video, 0, 0, width, height)
        const thumbnailUrl = canvas.toDataURL("image/jpeg", quality)
        resolve(thumbnailUrl)
      } catch (error) {
        reject(error)
      }
    }

    video.onerror = () => {
      reject(new Error("Failed to load video"))
    }

    video.src = sourceUrl
  })
}
