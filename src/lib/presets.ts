export interface StockBoard {
  id: string
  name: string
  length: number
  width: number
  thickness: number
}

export const STOCK_BOARD_PRESETS: StockBoard[] = [
  // Softwoods - dimensional lumber (actual dimensions)
  { id: "2x4x8", name: "2×4×8 SPF", length: 96, width: 3.5, thickness: 1.5 },
  { id: "2x4x10", name: "2×4×10 SPF", length: 120, width: 3.5, thickness: 1.5 },
  { id: "2x4x12", name: "2×4×12 SPF", length: 144, width: 3.5, thickness: 1.5 },
  { id: "2x6x8", name: "2×6×8 SPF", length: 96, width: 5.5, thickness: 1.5 },
  { id: "2x6x10", name: "2×6×10 SPF", length: 120, width: 5.5, thickness: 1.5 },
  { id: "2x8x8", name: "2×8×8 SPF", length: 96, width: 7.25, thickness: 1.5 },
  { id: "2x8x10", name: "2×8×10 SPF", length: 120, width: 7.25, thickness: 1.5 },
  { id: "1x6x8", name: "1×6×8 Cedar", length: 96, width: 5.5, thickness: 0.75 },
  { id: "1x8x8", name: "1×8×8 Cedar", length: 96, width: 7.25, thickness: 0.75 },
  // Hardwoods - surfaced 4/4, 6/4, 8/4
  { id: "oak-4x96", name: "4/4 Oak 4\" × 8'", length: 96, width: 4, thickness: 0.75 },
  { id: "oak-6x96", name: "4/4 Oak 6\" × 8'", length: 96, width: 6, thickness: 0.75 },
  { id: "maple-6x96", name: "4/4 Maple 6\" × 8'", length: 96, width: 6, thickness: 0.75 },
  { id: "maple-8x96", name: "4/4 Maple 8\" × 8'", length: 96, width: 8, thickness: 0.75 },
  { id: "walnut-6x96", name: "6/4 Walnut 6\" × 8'", length: 96, width: 6, thickness: 1.25 },
  { id: "walnut-8x96", name: "6/4 Walnut 8\" × 8'", length: 96, width: 8, thickness: 1.25 },
  { id: "cherry-6x120", name: "4/4 Cherry 6\" × 10'", length: 120, width: 6, thickness: 0.75 },
  { id: "oak-8x120", name: "8/4 Oak 8\" × 10'", length: 120, width: 8, thickness: 1.5 },
]
