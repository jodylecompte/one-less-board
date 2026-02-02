export interface StockProfile {
  id: string
  name: string
  allowedLengths: number[]
  kerf: number
}

/** Stock profiles define what boards the optimizer may use (constraint, not quantities) */
export const STOCK_PROFILES: StockProfile[] = [
  {
    id: "2x4",
    name: "2×4 dimensional",
    allowedLengths: [96, 120, 144, 192],
    kerf: 0.125,
  },
  {
    id: "2x6",
    name: "2×6 dimensional",
    allowedLengths: [96, 120, 144, 192],
    kerf: 0.125,
  },
  {
    id: "2x8",
    name: "2×8 dimensional",
    allowedLengths: [96, 120, 144],
    kerf: 0.125,
  },
  {
    id: "1x6",
    name: "1×6 dimensional",
    allowedLengths: [96, 120, 144],
    kerf: 0.125,
  },
  {
    id: "4-4-hardwood",
    name: "4/4 hardwood",
    allowedLengths: [96, 120, 144],
    kerf: 0.125,
  },
  {
    id: "6-4-hardwood",
    name: "6/4 hardwood",
    allowedLengths: [96, 120],
    kerf: 0.125,
  },
]

/** Format length in inches as feet (e.g. 96 → "8 ft") */
export function formatStockLength(inches: number): string {
  const feet = inches / 12
  return feet % 1 === 0 ? `${feet} ft` : `${inches}"`
}
