import type { CutRequirement } from "./cuts"
import { DEFAULT_MAX_BOARD_LENGTH_INCHES, STOCK_PROFILES } from "./stock-profiles"

/** Discriminator for material kinds. */
export type MaterialType = "board" | "sheet"

/** One plywood/sheet piece: width × height, quantity. Dimensions in inches. */
export interface SheetPiece {
  width: number
  height: number
  quantity: number
}

/**
 * A material group: either board (length-based cuts + spec) or sheet (width × height pieces).
 * Scrap is managed globally via Scrap inventory, not per group.
 */
export interface MaterialGroup {
  id: string
  /** User-editable label (e.g. "2x4 framing", "Plywood shelves"). */
  label: string
  materialType: MaterialType
  /** Board spec id (STOCK_PROFILES). Used only when materialType === "board". */
  boardSpecId: string
  /** Preferred max board length (inches). Used only when materialType === "board". Default 96 (8 ft). */
  maxLengthPreferenceInches: number
  /** Length-based cuts. Used only when materialType === "board". */
  cuts: CutRequirement[]
  /** In-progress cut row. Used only when materialType === "board". */
  draftCut: { length: string; quantity: string } | null
  /** Width × height pieces. Used only when materialType === "sheet". */
  sheetPieces: SheetPiece[]
  /** In-progress sheet piece row. Used only when materialType === "sheet". */
  draftSheetPiece: { width: string; height: string; quantity: string } | null
  /** Sheet stock size (inches). Used only when materialType === "sheet". */
  sheetStockWidth: number
  sheetStockHeight: number
  /** Thickness (informational, e.g. "3/4\""). Used only when materialType === "sheet". */
  sheetThickness: string
}

let groupCounter = 0

function nextId(): string {
  groupCounter += 1
  return `group-${groupCounter}-${Date.now()}`
}

/** First board spec id for defaults (e.g. "2x4"). */
const DEFAULT_BOARD_SPEC_ID = STOCK_PROFILES[0]?.id ?? "2x4"

/**
 * Create a new board material group with default label and spec.
 */
export function createBoardGroup(overrides?: Partial<Pick<MaterialGroup, "label" | "boardSpecId" | "maxLengthPreferenceInches">>): MaterialGroup {
  return {
    id: nextId(),
    label: overrides?.label ?? "2x4 framing",
    materialType: "board",
    boardSpecId: overrides?.boardSpecId ?? DEFAULT_BOARD_SPEC_ID,
    maxLengthPreferenceInches: overrides?.maxLengthPreferenceInches ?? DEFAULT_MAX_BOARD_LENGTH_INCHES,
    cuts: [],
    draftCut: null,
    sheetPieces: [],
    draftSheetPiece: null,
    sheetStockWidth: 48,
    sheetStockHeight: 96,
    sheetThickness: '3/4"',
  }
}

/**
 * Create a new sheet (plywood) material group. No solver yet; collects width × height pieces.
 */
export function createSheetGroup(overrides?: Partial<Pick<MaterialGroup, "label" | "sheetStockWidth" | "sheetStockHeight" | "sheetThickness">>): MaterialGroup {
  return {
    id: nextId(),
    label: overrides?.label ?? "Plywood",
    materialType: "sheet",
    boardSpecId: DEFAULT_BOARD_SPEC_ID,
    maxLengthPreferenceInches: DEFAULT_MAX_BOARD_LENGTH_INCHES,
    cuts: [],
    draftCut: null,
    sheetPieces: [],
    draftSheetPiece: null,
    sheetStockWidth: overrides?.sheetStockWidth ?? 48,
    sheetStockHeight: overrides?.sheetStockHeight ?? 96,
    sheetThickness: overrides?.sheetThickness ?? '3/4"',
  }
}

/** Merge sheet pieces by (width, height): sum quantities, sort by area descending. */
export function mergeSheetPieces(pieces: SheetPiece[]): SheetPiece[] {
  const byKey = new Map<string, SheetPiece>()
  for (const p of pieces) {
    if (p.width <= 0 || p.height <= 0 || p.quantity <= 0 || !Number.isInteger(p.quantity)) continue
    const k = `${p.width}:${p.height}`
    const existing = byKey.get(k)
    if (existing) {
      existing.quantity += p.quantity
    } else {
      byKey.set(k, { width: p.width, height: p.height, quantity: p.quantity })
    }
  }
  return [...byKey.values()].sort((a, b) => b.width * b.height - a.width * a.height)
}

/** Default first group for initial app state. */
export function createDefaultGroup(): MaterialGroup {
  return createBoardGroup({ label: "2x4 framing" })
}
