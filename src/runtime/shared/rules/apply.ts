import type { FileDescriptor, Rule, RuleContext, RuleViolation } from "../types"
import type { Restrictions } from "../restrictions"
import { maxFileSizeRule } from "./max-file-size"
import { minFileSizeRule } from "./min-file-size"
import { maxFilesRule } from "./max-files"
import { maxTotalSizeRule } from "./max-total-size"
import { allowedMimeTypesRule } from "./allowed-mime-types"
import { disallowedMimeTypesRule } from "./disallowed-mime-types"

export function applyRestrictions(file: FileDescriptor, ctx: RuleContext, restrictions: Restrictions): RuleViolation | null {
  const rules: Rule[] = [
    maxFilesRule(restrictions.maxFiles),
    maxFileSizeRule(restrictions.maxFileSize),
    minFileSizeRule(restrictions.minFileSize),
    maxTotalSizeRule(restrictions.maxTotalSize),
    allowedMimeTypesRule(restrictions.allowedMimeTypes),
    disallowedMimeTypesRule(restrictions.disallowedMimeTypes),
  ]
  for (const rule of rules) {
    const violation = rule(file, ctx)
    if (violation) return violation
  }
  return null
}

/**
 * Apply only per-file restrictions (size, mime). Skips aggregate rules
 * (maxFiles, maxTotalSize) which depend on client-side state and cannot be
 * enforced statelessly on the server. Use this from server handlers; the
 * client uses `applyRestrictions` because it has the full context.
 */
export function applyFileRestrictions(file: FileDescriptor, restrictions: Restrictions): RuleViolation | null {
  const rules: Rule[] = [
    maxFileSizeRule(restrictions.maxFileSize),
    minFileSizeRule(restrictions.minFileSize),
    allowedMimeTypesRule(restrictions.allowedMimeTypes),
    disallowedMimeTypesRule(restrictions.disallowedMimeTypes),
  ]
  const ctx: RuleContext = { existingCount: 0, existingTotalSize: 0 }
  for (const rule of rules) {
    const violation = rule(file, ctx)
    if (violation) return violation
  }
  return null
}
