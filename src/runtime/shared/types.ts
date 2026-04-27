export interface FileDescriptor {
  name: string
  size: number
  type: string
}

export type RestrictionCode =
  | "max-file-size"
  | "min-file-size"
  | "max-files"
  | "max-total-size"
  | "allowed-mime-types"
  | "disallowed-mime-types"

export interface RuleViolation {
  code: RestrictionCode
  message: string
  meta: Record<string, unknown>
}

export interface RuleContext {
  existingCount: number
  existingTotalSize: number
}

export type Rule = (file: FileDescriptor, ctx: RuleContext) => RuleViolation | null
