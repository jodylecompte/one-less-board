/** Discriminator for material kinds (board = linear stock, sheet = panel) */
export type MaterialType = "board" | "sheet"

/** Base spec for any material the optimizer can use */
export interface MaterialSpec {
  id: string
  name: string
  materialType: MaterialType
}

/** Board material: allowed lengths and kerf for 1D cross-cut optimization */
export interface BoardSpec extends MaterialSpec {
  materialType: "board"
  allowedLengths: number[]
  kerf: number
}

/** @deprecated Use BoardSpec. Kept for compatibility. */
export type StockProfile = BoardSpec

/** Stock profiles define what boards the optimizer may use (constraint, not quantities) */
export const STOCK_PROFILES: BoardSpec[] = [
  {
    id: "2x4",
    name: "2×4 dimensional",
    materialType: "board",
    allowedLengths: [96, 120, 144, 192],
    kerf: 0.125,
  },
  {
    id: "2x6",
    name: "2×6 dimensional",
    materialType: "board",
    allowedLengths: [96, 120, 144, 192],
    kerf: 0.125,
  },
  {
    id: "2x8",
    name: "2×8 dimensional",
    materialType: "board",
    allowedLengths: [96, 120, 144],
    kerf: 0.125,
  },
  {
    id: "1x6",
    name: "1×6 dimensional",
    materialType: "board",
    allowedLengths: [96, 120, 144],
    kerf: 0.125,
  },
  {
    id: "4-4-hardwood",
    name: "4/4 hardwood",
    materialType: "board",
    allowedLengths: [96, 120, 144],
    kerf: 0.125,
  },
  {
    id: "6-4-hardwood",
    name: "6/4 hardwood",
    materialType: "board",
    allowedLengths: [96, 120],
    kerf: 0.125,
  },
]

/** Format length in inches as feet (e.g. 96 → "8 ft") */
export function formatStockLength(inches: number): string {
  const feet = inches / 12
  return feet % 1 === 0 ? `${feet} ft` : `${inches}"`
}

/** Short label for shopping list (e.g. "2×4 dimensional" → "2×4", "4/4 hardwood" → "4/4") */
export function shortNominalName(fullName: string): string {
  return fullName
    .replace(/\s*dimensional\s*$/i, "")
    .replace(/\s*hardwood\s*$/i, "")
    .trim() || fullName
}

/** Order for sorting nominal sizes small → large (material size). */
export const NOMINAL_SIZE_ORDER: string[] = [
  "1x6",
  "2x4",
  "2x6",
  "2x8",
  "4-4-hardwood",
  "6-4-hardwood",
]
