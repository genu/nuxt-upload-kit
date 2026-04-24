import type { H3Event } from "h3"

export interface UploadFileDescriptor {
  name: string
  size: number
  mimeType: string
}

export type AuthorizeOp =
  | { type: "presign-upload"; file: UploadFileDescriptor }
  | { type: "presign-download"; key: string }
  | { type: "delete"; key: string }
  | { type: "direct-upload"; file: UploadFileDescriptor }
  | { type: "list"; prefix?: string }

export interface AuthorizeContext {
  userId?: string
  [key: string]: unknown
}

export interface ServerHookContext {
  event: H3Event
  auth: AuthorizeContext
}

export interface UploadServerConfig {
  storage?: unknown
  authorize?: (event: H3Event, op: AuthorizeOp) => AuthorizeContext | Promise<AuthorizeContext>
  validators?: unknown[]
  hooks?: {
    beforePresign?: (file: UploadFileDescriptor, ctx: ServerHookContext) => void | Promise<void>
    afterUpload?: (file: UploadFileDescriptor, ctx: ServerHookContext) => void | Promise<void>
    beforeDelete?: (key: string, ctx: ServerHookContext) => void | Promise<void>
  }
}

export interface ServerUpload {
  put: (input: { key: string; body: unknown; contentType?: string }) => Promise<unknown>
  presignUpload: (input: UploadFileDescriptor) => Promise<unknown>
  presignDownload: (key: string) => Promise<unknown>
  delete: (key: string) => Promise<unknown>
  list: (prefix?: string) => Promise<unknown>
}
