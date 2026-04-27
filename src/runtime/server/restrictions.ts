import { createError } from "h3"
import { applyFileRestrictions, type Restrictions, type RestrictionCode } from "../shared"
import type { UploadFileDescriptor } from "./types"

const STATUS_BY_CODE: Record<RestrictionCode, { code: number; statusMessage: string }> = {
  "max-file-size": { code: 413, statusMessage: "Payload Too Large" },
  "max-total-size": { code: 413, statusMessage: "Payload Too Large" },
  "min-file-size": { code: 422, statusMessage: "Unprocessable Entity" },
  "max-files": { code: 409, statusMessage: "Conflict" },
  "allowed-mime-types": { code: 415, statusMessage: "Unsupported Media Type" },
  "disallowed-mime-types": { code: 415, statusMessage: "Unsupported Media Type" },
}

/**
 * Enforce the shared per-file restrictions against an incoming file descriptor.
 * Throws an h3 error with a status code derived from the violation type.
 * The caller passes the restrictions resolved from `runtimeConfig.public.uploadKit.restrictions`.
 */
export function enforceRestrictions(file: UploadFileDescriptor, restrictions: Restrictions | undefined): void {
  if (!restrictions) return
  const violation = applyFileRestrictions({ name: file.name, size: file.size, type: file.mimeType }, restrictions)
  if (!violation) return
  const { code, statusMessage } = STATUS_BY_CODE[violation.code]
  throw createError({
    statusCode: code,
    statusMessage,
    message: violation.message,
    data: { code: violation.code, ...violation.meta },
  })
}
