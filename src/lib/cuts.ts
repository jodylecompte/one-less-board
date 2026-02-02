import type { MaterialType } from "./stock-profiles"

const DEFAULT_MATERIAL_TYPE: MaterialType = "board"

export interface CutRequirement {
  length: number
  quantity: number
  /** Material kind; defaults to 'board' when omitted */
  materialType?: MaterialType
}

/** Normalize materialType to a concrete value (default 'board') */
export function normalizeMaterialType(
  cut: CutRequirement
): CutRequirement & { materialType: MaterialType } {
  return {
    ...cut,
    materialType: cut.materialType ?? DEFAULT_MATERIAL_TYPE,
  }
}

/** Merge cuts by (length, materialType): sum quantities, sort by length descending */
export function mergeCuts(cuts: CutRequirement[]): CutRequirement[] {
  const key = (length: number, materialType: MaterialType) =>
    `${length}:${materialType}`
  const byKey = new Map<string, { length: number; quantity: number; materialType: MaterialType }>()
  for (const c of cuts) {
    if (!isValidLength(c.length) || !isValidQuantity(c.quantity)) continue
    const mt = c.materialType ?? DEFAULT_MATERIAL_TYPE
    const k = key(c.length, mt)
    const existing = byKey.get(k)
    if (existing) {
      existing.quantity += c.quantity
    } else {
      byKey.set(k, { length: c.length, quantity: c.quantity, materialType: mt })
    }
  }
  return [...byKey.values()]
    .sort((a, b) => b.length - a.length)
    .map(({ length, quantity, materialType }) => ({ length, quantity, materialType }))
}

/** Return cuts for a single material type (e.g. for optimizer input). Defaults missing materialType to 'board'. */
export function getCutsForMaterial(
  cuts: CutRequirement[],
  materialType: MaterialType
): CutRequirement[] {
  return cuts.filter((c) => (c.materialType ?? DEFAULT_MATERIAL_TYPE) === materialType)
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
