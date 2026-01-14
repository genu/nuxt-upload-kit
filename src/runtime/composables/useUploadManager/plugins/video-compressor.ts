import { defineProcessingPlugin } from "../types"
import { useFFMpeg } from "../../useFFMpeg"
import { watch } from "vue"

interface VideoCompressorOptions {
  /**
   * Target video codec
   * @default 'libx264'
   */
  codec?: string

  /**
   * Constant Rate Factor (0-51, lower = better quality, larger file)
   * @default 28
   */
  crf?: number

  /**
   * Target bitrate (e.g., '1M' = 1 megabit/sec)
   * If specified, overrides CRF
   */
  bitrate?: string

  /**
   * Maximum width (maintains aspect ratio)
   */
  maxWidth?: number

  /**
   * Maximum height (maintains aspect ratio)
   */
  maxHeight?: number

  /**
   * Output format
   * @default 'mp4'
   */
  format?: "mp4" | "webm" | "mov"

  /**
   * Minimum file size to compress (in bytes)
   * Files smaller than this will be skipped
   * @default 10MB
   */
  minSizeToCompress?: number

  /**
   * Audio codec
   * @default 'aac'
   */
  audioCodec?: string

  /**
   * Audio bitrate
   * @default '128k'
   */
  audioBitrate?: string
}

type VideoCompressorEvents = {
  start: { file: any; originalSize: number }
  progress: { file: any; percentage: number }
  complete: { file: any; originalSize: number; compressedSize: number; savedBytes: number }
  skip: { file: any; reason: string }
  error: { file: any; error: Error }
}

export const PluginVideoCompressor = defineProcessingPlugin<VideoCompressorOptions, VideoCompressorEvents>((pluginOptions = {}) => {
  return {
    id: "video-compressor",
    hooks: {
      process: async (file, context) => {
        const {
          codec = "libx264",
          crf = 28,
          bitrate,
          maxWidth,
          maxHeight,
          format = "mp4",
          minSizeToCompress = 10 * 1024 * 1024, // 10MB
          audioCodec = "aac",
          audioBitrate = "128k",
        } = pluginOptions

        // Skip non-video files
        if (!file.mimeType.startsWith("video/")) {
          return file
        }

        // Skip remote files (no local data to compress)
        if (file.source !== "local") {
          context.emit("skip", { file, reason: "Remote file, no local data to compress" })
          return file
        }

        // Skip small files
        if (file.size < minSizeToCompress) {
          context.emit("skip", {
            file,
            reason: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) is below minimum (${(minSizeToCompress / 1024 / 1024).toFixed(2)}MB)`,
          })
          return file
        }

        // Declare variables outside try block for cleanup in finally
        let inputUrl: string | undefined
        let stopProgressWatch: (() => void) | undefined

        try {
          // Emit start event
          context.emit("start", { file, originalSize: file.size })

          inputUrl = URL.createObjectURL(file.data)
          const ffmpeg = useFFMpeg({ inputUrl })

          // Load FFmpeg core
          await ffmpeg.load()

          // Listen to progress updates using watch with manual cleanup
          stopProgressWatch = watch(
            () => ffmpeg.progress.value,
            (progress) => {
              context.emit("progress", { file, percentage: Math.round(progress * 100) })
            },
          )

          // Build FFmpeg command options
          const convertOptions = ["-c:v", codec]

          // Add quality settings
          if (bitrate) {
            convertOptions.push("-b:v", bitrate)
          } else {
            convertOptions.push("-crf", crf.toString())
          }

          // Add resolution scaling if specified
          if (maxWidth || maxHeight) {
            let scaleFilter = ""
            if (maxWidth && maxHeight) {
              scaleFilter = `scale='min(${maxWidth},iw)':'min(${maxHeight},ih)':force_original_aspect_ratio=decrease`
            } else if (maxWidth) {
              scaleFilter = `scale=${maxWidth}:-2`
            } else if (maxHeight) {
              scaleFilter = `scale=-2:${maxHeight}`
            }
            convertOptions.push("-vf", scaleFilter)
          }

          // Add audio settings
          convertOptions.push("-c:a", audioCodec, "-b:a", audioBitrate)

          // Execute compression via useFFMpeg
          const compressedFile = await ffmpeg.convert(convertOptions)

          // Unload FFmpeg to free resources
          ffmpeg.unload()

          // Check if conversion was successful
          if (!compressedFile) {
            context.emit("error", { file, error: new Error("Compression failed: no output file") })
            return file
          }

          // Calculate compression ratio
          const originalSize = file.size
          const compressedSize = compressedFile.size
          const savedBytes = originalSize - compressedSize

          // Only use compressed version if it's actually smaller
          if (compressedSize < originalSize) {
            context.emit("complete", {
              file,
              originalSize,
              compressedSize,
              savedBytes,
            })

            return {
              ...file,
              data: compressedFile,
              size: compressedFile.size,
              name: file.name.replace(/\.[^.]+$/, `.${format}`),
              mimeType: `video/${format}`,
            }
          } else {
            context.emit("skip", {
              file: file,
              reason: `Compressed size (${(compressedSize / 1024 / 1024).toFixed(2)}MB) is larger than original`,
            })
            return file
          }
        } catch (error) {
          context.emit("error", { file, error: error as Error })
          console.error(`Video compression error for ${file.name}:`, error)

          // Return original file on error
          return file
        } finally {
          // Clean up progress watcher to prevent memory leaks
          stopProgressWatch?.()

          // Clean up object URL
          if (inputUrl) {
            URL.revokeObjectURL(inputUrl)
          }
        }
      },
    },
  }
})
