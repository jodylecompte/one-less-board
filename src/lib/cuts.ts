export interface CutRequirement {
  length: number
  quantity: number
}

/** Merge cuts by length (sum quantities) and sort by length descending */
export function mergeCuts(cuts: CutRequirement[]): CutRequirement[] {
  const byLength = new Map<number, number>()
  for (const { length, quantity } of cuts) {
    if (isValidLength(length) && isValidQuantity(quantity)) {
      byLength.set(length, (byLength.get(length) ?? 0) + quantity)
    }
  }
  return [...byLength.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([length, quantity]) => ({ length, quantity }))
}

export function isValidLength(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

export function isValidQuantity(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    Number.isInteger(value)
  )
}

/** Parse string to number; returns NaN if invalid */
export function parseLength(input: string): number {
  const n = parseFloat(input.trim())
  return n
}

export function parseQuantity(input: string): number {
  const n = parseInt(input.trim(), 10)
  return n
}
