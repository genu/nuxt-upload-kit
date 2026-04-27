import type { RestrictionCode, RuleViolation } from "./types"

export class RestrictionError extends Error {
  readonly code: RestrictionCode
  readonly meta: Record<string, unknown>

  constructor(violation: RuleViolation) {
    super(violation.message)
    this.name = "RestrictionError"
    this.code = violation.code
    this.meta = violation.meta
  }
}
