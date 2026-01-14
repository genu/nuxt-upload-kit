import { FFmpeg } from "@ffmpeg/ffmpeg"
import { fetchFile, toBlobURL } from "@ffmpeg/util"
import { ref } from "vue"

interface FFMPegOptions {
  inputUrl: string
  convertOptions?: string[]
}

const defaultOptions: Partial<FFMPegOptions> = {
  convertOptions: [],
}

const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm"

export const useFFMpeg = (options: FFMPegOptions) => {
  options = { ...defaultOptions, ...options }
  const ffmpeg = new FFmpeg()
  const status = ref<"paused" | "converting" | "success" | "error">("paused")
  const progress = ref(0)
  const originalFile = ref<Uint8Array>()
  const convertedFile = ref<File>()

  let _onConvertSuccess: ((file: File) => void) | undefined

  ffmpeg.on("progress", ({ time }) => {
    progress.value = time / 1000000
  })

  const load = async () => {
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    })
  }

  const unload = () => ffmpeg.terminate()

  const convert = async (convertOptions: string[]) => {
    status.value = "converting"

    const command = ["-i", "input.avi", ...options.convertOptions!, ...convertOptions, "-c", "copy", "output.mp4"]

    try {
      originalFile.value = await fetchFile(options.inputUrl)
      await ffmpeg.writeFile("input.avi", originalFile.value)

      await ffmpeg.exec(command)
      convertedFile.value = await getModifiedVideo()
      await ffmpeg.deleteFile("input.avi")

      status.value = "success"
      if (_onConvertSuccess) _onConvertSuccess(convertedFile.value!)

      return convertedFile.value
    } catch (error: unknown) {
      if (import.meta.env.DEV) console.error(error)
      status.value = "error"
    }
  }

  const getModifiedVideo = async () => {
    const data = await ffmpeg.readFile("output.mp4")

    // FFmpeg WASM's FileData can be either a string or Uint8Array.
    // For binary files like MP4, it returns Uint8Array.
    // The issue: ffmpeg.wasm may return a Uint8Array backed by SharedArrayBuffer,
    // but the File constructor's BlobPart type only accepts ArrayBuffer (not SharedArrayBuffer).
    // Solution: Create a fresh ArrayBuffer copy and populate it with the data,
    // then explicitly type it as Uint8Array<ArrayBuffer> to satisfy TypeScript's strict checks.
    let bytes: Uint8Array<ArrayBuffer>
    if (typeof data === "string") {
      bytes = new TextEncoder().encode(data) as Uint8Array<ArrayBuffer>
    } else {
      // Create a new ArrayBuffer (regular, not Shared) and copy data into it
      const buffer = new ArrayBuffer(data.byteLength)
      new Uint8Array(buffer).set(data)
      bytes = new Uint8Array(buffer) as Uint8Array<ArrayBuffer>
    }

    const updatedFile = new File([bytes], "output.mp4", { type: "video/mp4" })

    return updatedFile
  }

  const onConvertSuccess = (callback: (updatedVideo: File) => void) => (_onConvertSuccess = callback)

  return {
    status,
    progress,
    convertedFile,
    load,
    unload,
    convert,
    onConvertSuccess,
  }
}
