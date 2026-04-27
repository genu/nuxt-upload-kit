import { createError } from "h3"
import { applyFileRestrictions, applyRestrictions, type Restrictions, type RestrictionCode } from "../shared"
import type { ExistingUploadState, UploadFileDescriptor } from "./types"

const STATUS_BY_CODE: Record<RestrictionCode, { code: number; statusMessage: string }> = {
  "max-file-size": { code: 413, statusMessage: "Payload Too Large" },
  "max-total-size": { code: 413, statusMessage: "Payload Too Large" },
  "min-file-size": { code: 422, statusMessage: "Unprocessable Entity" },
  "max-files": { code: 409, statusMessage: "Conflict" },
  "allowed-mime-types": { code: 415, statusMessage: "Unsupported Media Type" },
  "disallowed-mime-types": { code: 415, statusMessage: "Unsupported Media Type" },
}

/**
 * Enforce shared restrictions against an incoming file descriptor.
 * Throws an h3 error with a status code derived from the violation type.
 *
 * When `state` is provided (resolved from `getExistingState`), aggregate rules
 * (`maxFiles`, `maxTotalSize`) are enforced too. Without it, only per-file rules
 * are checked, since the server is otherwise stateless per request.
 */
export function enforceRestrictions(
  file: UploadFileDescriptor,
  restrictions: Restrictions | undefined,
  state?: ExistingUploadState,
): void {
  if (!restrictions) return
  const descriptor = { name: file.name, size: file.size, type: file.mimeType }
  const violation = state
    ? applyRestrictions(descriptor, { existingCount: state.count, existingTotalSize: state.totalSize }, restrictions)
    : applyFileRestrictions(descriptor, restrictions)
  if (!violation) return
  const { code, statusMessage } = STATUS_BY_CODE[violation.code]
  throw createError({
    statusCode: code,
    statusMessage,
    message: violation.message,
    data: { code: violation.code, ...violation.meta },
  })
}
