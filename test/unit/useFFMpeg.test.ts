import { describe, it, expect, vi, beforeEach } from "vitest"
import { useFFMpeg } from "../../src/runtime/composables/useFFMpeg"

const mockFFmpegInstance = {
  on: vi.fn(),
  load: vi.fn(),
  terminate: vi.fn(),
  writeFile: vi.fn(),
  exec: vi.fn(),
  readFile: vi.fn(() => new Uint8Array([0, 1, 2, 3])),
  deleteFile: vi.fn(),
}

const ffmpegConstructorSpy = vi.fn(() => mockFFmpegInstance)

vi.mock("@ffmpeg/ffmpeg", () => {
  return {
    FFmpeg: new Proxy(function () {}, {
      construct: (_target, args) => ffmpegConstructorSpy(...args),
    }),
  }
})

const mockFetchFile = vi.fn(() => new Uint8Array([0, 1, 2, 3]))
const mockToBlobURL = vi.fn((url: string) => `blob:${url}`)

vi.mock("@ffmpeg/util", () => ({
  fetchFile: (...args: unknown[]) => mockFetchFile(...args),
  toBlobURL: (...args: unknown[]) => mockToBlobURL(...args),
}))

describe("useFFMpeg", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("dynamic imports", () => {
    it("should not instantiate FFmpeg when composable is called", () => {
      ffmpegConstructorSpy.mockClear()

      useFFMpeg({ inputUrl: "test.avi" })

      expect(ffmpegConstructorSpy).not.toHaveBeenCalled()
    })

    it("should dynamically import and instantiate FFmpeg when load() is called", async () => {
      ffmpegConstructorSpy.mockClear()

      const { load } = useFFMpeg({ inputUrl: "test.avi" })

      expect(ffmpegConstructorSpy).not.toHaveBeenCalled()

      await load()

      expect(ffmpegConstructorSpy).toHaveBeenCalledOnce()
      expect(mockFFmpegInstance.load).toHaveBeenCalledOnce()
    })

    it("should dynamically import fetchFile from @ffmpeg/util when convert() is called", async () => {
      const { load, convert } = useFFMpeg({ inputUrl: "test.avi" })

      await load()
      mockFetchFile.mockClear()

      await convert([])

      expect(mockFetchFile).toHaveBeenCalledWith("test.avi")
    })
  })

  describe("load", () => {
    it("should load FFmpeg with correct core and wasm URLs", async () => {
      const { load } = useFFMpeg({ inputUrl: "test.avi" })

      await load()

      expect(mockToBlobURL).toHaveBeenCalledWith(expect.stringContaining("ffmpeg-core.js"), "text/javascript")
      expect(mockToBlobURL).toHaveBeenCalledWith(expect.stringContaining("ffmpeg-core.wasm"), "application/wasm")
    })
  })

  describe("convert", () => {
    it("should set status to converting during conversion", async () => {
      const { load, convert, status } = useFFMpeg({ inputUrl: "test.avi" })

      await load()

      expect(status.value).toBe("paused")

      const convertPromise = convert([])
      expect(status.value).toBe("converting")

      await convertPromise
    })

    it("should set status to success after conversion", async () => {
      const { load, convert, status } = useFFMpeg({ inputUrl: "test.avi" })

      await load()
      await convert([])

      expect(status.value).toBe("success")
    })

    it("should return converted file", async () => {
      const { load, convert } = useFFMpeg({ inputUrl: "test.avi" })

      await load()
      const result = await convert([])

      expect(result).toBeInstanceOf(File)
      expect(result?.name).toBe("output.mp4")
    })

    it("should call onConvertSuccess callback", async () => {
      const callback = vi.fn()
      const { load, convert, onConvertSuccess } = useFFMpeg({ inputUrl: "test.avi" })

      onConvertSuccess(callback)
      await load()
      await convert([])

      expect(callback).toHaveBeenCalledWith(expect.any(File))
    })

    it("should set status to error on failure", async () => {
      mockFFmpegInstance.exec.mockRejectedValueOnce(new Error("conversion failed"))

      const { load, convert, status } = useFFMpeg({ inputUrl: "test.avi" })

      await load()
      await convert([])

      expect(status.value).toBe("error")
    })
  })

  describe("unload", () => {
    it("should terminate FFmpeg", async () => {
      const { load, unload } = useFFMpeg({ inputUrl: "test.avi" })

      await load()
      unload()

      expect(mockFFmpegInstance.terminate).toHaveBeenCalledOnce()
    })
  })

  describe("progress tracking", () => {
    it("should register a progress handler on FFmpeg after load", async () => {
      const { load } = useFFMpeg({ inputUrl: "test.avi" })

      await load()

      expect(mockFFmpegInstance.on).toHaveBeenCalledWith("progress", expect.any(Function))
    })

    it("should update progress ref when progress event fires", async () => {
      const { load, progress } = useFFMpeg({ inputUrl: "test.avi" })

      await load()

      const progressHandler = mockFFmpegInstance.on.mock.calls.find((call) => call[0] === "progress")![1]
      progressHandler({ time: 5000000 })

      expect(progress.value).toBe(5)
    })
  })

  describe("convert command construction", () => {
    it("should merge composable convertOptions with per-call convertOptions", async () => {
      const { load, convert } = useFFMpeg({
        inputUrl: "test.avi",
        convertOptions: ["-preset", "fast"],
      })

      await load()
      await convert(["-crf", "28"])

      expect(mockFFmpegInstance.exec).toHaveBeenCalledWith([
        "-i",
        "input.avi",
        "-preset",
        "fast",
        "-crf",
        "28",
        "-c",
        "copy",
        "output.mp4",
      ])
    })

    it("should clean up input file after conversion", async () => {
      const { load, convert } = useFFMpeg({ inputUrl: "test.avi" })

      await load()
      await convert([])

      expect(mockFFmpegInstance.deleteFile).toHaveBeenCalledWith("input.avi")
    })
  })

  describe("getModifiedVideo string data handling", () => {
    it("should handle string data from readFile", async () => {
      mockFFmpegInstance.readFile.mockResolvedValueOnce("string-file-data")

      const { load, convert } = useFFMpeg({ inputUrl: "test.avi" })

      await load()
      const result = await convert([])

      expect(result).toBeInstanceOf(File)
      expect(result?.type).toBe("video/mp4")
    })
  })
})
