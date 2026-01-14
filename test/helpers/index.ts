import type {
  LocalUploadFile,
  RemoteUploadFile,
  UploadFile,
  PluginContext,
  UploadOptions,
} from "../../src/runtime/composables/useUploadKit/types"

/**
 * Create a mock File object for testing
 */
export function createMockFile(
  name: string = "test-file.jpg",
  size: number = 1024,
  type: string = "image/jpeg",
  lastModified: number = Date.now(),
): File {
  const content = new Uint8Array(size).fill(65) // Fill with 'A' characters
  const blob = new Blob([content], { type })
  return new File([blob], name, { type, lastModified })
}

/**
 * Create a mock Blob object for testing
 */
export function createMockBlob(size: number = 1024, type: string = "image/jpeg"): Blob {
  const content = new Uint8Array(size).fill(65)
  return new Blob([content], { type })
}

/**
 * Create a mock LocalUploadFile for testing
 */
export function createMockLocalUploadFile(overrides: Partial<LocalUploadFile> = {}): LocalUploadFile {
  const file = createMockFile(overrides.name || "test-file.jpg", overrides.size || 1024, overrides.mimeType || "image/jpeg")

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`,
    name: "test-file.jpg",
    size: 1024,
    mimeType: "image/jpeg",
    status: "waiting",
    progress: { percentage: 0 },
    source: "local",
    data: file,
    meta: {},
    ...overrides,
  }
}

/**
 * Create a mock RemoteUploadFile for testing
 */
export function createMockRemoteUploadFile(overrides: Partial<RemoteUploadFile> = {}): RemoteUploadFile {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`,
    name: "remote-file.jpg",
    size: 2048,
    mimeType: "image/jpeg",
    status: "complete",
    progress: { percentage: 100 },
    source: "storage",
    data: null,
    remoteUrl: "https://storage.example.com/remote-file.jpg",
    meta: {},
    ...overrides,
  }
}

/**
 * Create a mock PluginContext for testing
 */
export function createMockPluginContext(files: UploadFile[] = [], options: UploadOptions = {}): PluginContext {
  return {
    files,
    options,
    emit: vi.fn(),
  }
}

/**
 * Wait for a specified number of milliseconds
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Create a mock URL.createObjectURL implementation
 */
export function mockCreateObjectURL(): { mock: ReturnType<typeof vi.fn>; cleanup: () => void } {
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL

  const createMock = vi.fn((_blob: Blob) => `blob:mock-${Math.random().toString(36).slice(2)}`)
  const revokeMock = vi.fn()

  URL.createObjectURL = createMock
  URL.revokeObjectURL = revokeMock

  return {
    mock: createMock,
    cleanup: () => {
      URL.createObjectURL = originalCreateObjectURL
      URL.revokeObjectURL = originalRevokeObjectURL
    },
  }
}

/**
 * Mock HTMLImageElement for canvas operations
 */
export function mockImage(options: { width?: number; height?: number; shouldFail?: boolean } = {}) {
  const { width = 800, height = 600, shouldFail = false } = options

  return class MockImage {
    width = width
    height = height
    src = ""
    onload: (() => void) | null = null
    onerror: (() => void) | null = null

    constructor() {
      setTimeout(() => {
        if (shouldFail && this.onerror) {
          this.onerror()
        } else if (this.onload) {
          this.onload()
        }
      }, 0)
    }
  }
}

/**
 * Mock canvas context for testing
 */
export function mockCanvasContext() {
  const mockContext = {
    drawImage: vi.fn(),
    imageSmoothingEnabled: true,
    imageSmoothingQuality: "high" as ImageSmoothingQuality,
  }

  const mockCanvas = {
    getContext: vi.fn(() => mockContext),
    toDataURL: vi.fn(() => "data:image/jpeg;base64,mockdata"),
    toBlob: vi.fn((callback: BlobCallback, type?: string, _quality?: number) => {
      const blob = new Blob(["mock"], { type: type || "image/jpeg" })
      callback(blob)
    }),
    width: 0,
    height: 0,
  }

  const originalCreateElement = document.createElement.bind(document)
  vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
    if (tagName === "canvas") {
      return mockCanvas as unknown as HTMLCanvasElement
    }
    return originalCreateElement(tagName)
  })

  return { mockCanvas, mockContext }
}

/**
 * Create multiple mock files with different properties
 */
export function createMockFiles(count: number, _baseOptions: Partial<File> = {}): File[] {
  return Array.from({ length: count }, (_, i) =>
    createMockFile(`test-file-${i + 1}.jpg`, 1024 * (i + 1), "image/jpeg", Date.now() - i * 1000),
  )
}
