export interface Restrictions {
  maxFileSize?: number
  minFileSize?: number
  maxFiles?: number
  maxTotalSize?: number
  allowedMimeTypes?: string[]
  disallowedMimeTypes?: string[]
}
