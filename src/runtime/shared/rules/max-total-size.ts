import type { Rule } from "../types"

export const maxTotalSizeRule =
  (maxTotal: number | undefined): Rule =>
  (file, ctx) => {
    if (maxTotal === undefined || !Number.isFinite(maxTotal)) return null
    const projected = ctx.existingTotalSize + file.size
    if (projected <= maxTotal) return null
    return {
      code: "max-total-size",
      message: `Total upload size (${projected} bytes) would exceed the ${maxTotal}-byte limit.`,
      meta: { maxTotal, projected, existingTotalSize: ctx.existingTotalSize, fileSize: file.size },
    }
  }
