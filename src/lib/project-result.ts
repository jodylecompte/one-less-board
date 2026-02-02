import type { CutRequirement } from "./cuts"
import type { MaterialGroup, SheetPiece } from "./material-groups"
import { optimizeCuts, type OptimizedBoard, type ScrapBoard } from "./optimizer"
import { STOCK_PROFILES, NOMINAL_SIZE_ORDER } from "./stock-profiles"

/** Shopping list entry for one nominal size (board spec): what to buy. */
export interface ShoppingListEntry {
  /** Board spec id (e.g. "2x4"). */
  nominalSizeId: string
  /** Display name (e.g. "2×4 dimensional"). */
  nominalSizeName: string
  /** Count per stock length. */
  items: { stockLength: number; count: number }[]
}

/** Cut list recap for one material group: what the user entered. */
export interface CutListRecapGroup {
  groupId: string
  groupLabel: string
  /** Board groups: length-based cuts. */
  cuts: CutRequirement[]
  /** Sheet groups: width × height pieces. Empty for board groups. */
  sheetPieces: SheetPiece[]
}

/** Cut diagrams for one material group: visuals. */
export interface DiagramGroup {
  groupId: string
  groupLabel: string
  boards: OptimizedBoard[]
  kerfInches: number
  /** Preferred max length (inches) for board groups; used to show "exceeds preference" in UI. */
  preferredMaxLengthInches?: number
  /** When "sheet", show "Optimization coming soon" instead of board count. */
  materialType?: "board" | "sheet"
}

/** Sheet/shopping entry: plywood group, sheet count only (no optimization yet). */
export interface ShoppingListSheetEntry {
  groupId: string
  groupLabel: string
  sheetCount: number
  sheetWidth: number
  sheetHeight: number
  thickness: string
}

/** Aggregated project-level result. */
export interface ProjectResult {
  /** What to buy (boards), grouped by nominal size. */
  shoppingList: ShoppingListEntry[]
  /** What to buy (sheets), one entry per plywood group. Sheet count only; optimization coming soon. */
  shoppingListSheets: ShoppingListSheetEntry[]
  /** What the user entered, grouped by material group. */
  cutListRecap: CutListRecapGroup[]
  /** Cut diagrams, grouped by material group. */
  diagrams: DiagramGroup[]
}

export interface GenerateProjectResultOptions {
  /** Global scrap inventory (boards). Used when "Use scrap inventory" is on. Default []. */
  scrap?: ScrapBoard[]
}

/**
 * Run optimization per group and aggregate into a single project result.
 * Each group is optimized independently; output is unified.
 * Pass options.scrap when the user has "Use scrap inventory" enabled.
 */
export function generateProjectResult(
  groups: MaterialGroup[],
  options?: GenerateProjectResultOptions
): ProjectResult {
  const scrap = options?.scrap ?? []
  const shoppingByNominal = new Map<
    string,
    { name: string; byLength: Map<number, number> }
  >()
  const shoppingListSheets: ShoppingListSheetEntry[] = []
  const cutListRecap: CutListRecapGroup[] = []
  const diagrams: DiagramGroup[] = []

  for (const group of groups) {
    cutListRecap.push({
      groupId: group.id,
      groupLabel: group.label,
      cuts: group.materialType === "board" ? [...group.cuts] : [],
      sheetPieces: group.materialType === "sheet" ? [...group.sheetPieces] : [],
    })

    if (group.materialType === "sheet") {
      diagrams.push({
        groupId: group.id,
        groupLabel: group.label,
        boards: [],
        kerfInches: 0,
        materialType: "sheet",
      })
      if (group.sheetPieces.length > 0) {
        shoppingListSheets.push({
          groupId: group.id,
          groupLabel: group.label,
          sheetCount: 0,
          sheetWidth: group.sheetStockWidth,
          sheetHeight: group.sheetStockHeight,
          thickness: group.sheetThickness,
        })
      }
      continue
    }

    const boardSpec = STOCK_PROFILES.find((p) => p.id === group.boardSpecId)
    const boardCuts = group.cuts.filter((c) => (c.materialType ?? "board") === "board")

    if (!boardSpec || boardCuts.length === 0) {
      diagrams.push({
        groupId: group.id,
        groupLabel: group.label,
        boards: [],
        kerfInches: boardSpec?.kerf ?? 0,
        preferredMaxLengthInches: group.maxLengthPreferenceInches,
        materialType: "board",
      })
      continue
    }

    const boards = optimizeCuts(boardCuts, boardSpec, {
      scrap,
      preferredMaxLengthInches: group.maxLengthPreferenceInches,
    })
    diagrams.push({
      groupId: group.id,
      groupLabel: group.label,
      boards,
      kerfInches: boardSpec.kerf,
      preferredMaxLengthInches: group.maxLengthPreferenceInches,
      materialType: "board",
    })

    const toPurchase = boards.filter((b) => b.source === "new")
    if (toPurchase.length === 0) continue

    let entry = shoppingByNominal.get(boardSpec.id)
    if (!entry) {
      entry = { name: boardSpec.name, byLength: new Map() }
      shoppingByNominal.set(boardSpec.id, entry)
    }
    for (const b of toPurchase) {
      entry.byLength.set(b.stockLength, (entry.byLength.get(b.stockLength) ?? 0) + 1)
    }
  }

  const shoppingList: ShoppingListEntry[] = []
  for (const [nominalSizeId, { name, byLength }] of shoppingByNominal) {
    const items = [...byLength.entries()]
      .map(([stockLength, count]) => ({ stockLength, count }))
      .sort((a, b) => a.stockLength - b.stockLength)
    shoppingList.push({ nominalSizeId, nominalSizeName: name, items })
  }
  shoppingList.sort((a, b) => {
    const i = NOMINAL_SIZE_ORDER.indexOf(a.nominalSizeId)
    const j = NOMINAL_SIZE_ORDER.indexOf(b.nominalSizeId)
    const orderA = i === -1 ? NOMINAL_SIZE_ORDER.length : i
    const orderB = j === -1 ? NOMINAL_SIZE_ORDER.length : j
    return orderA - orderB
  })

  return {
    shoppingList,
    shoppingListSheets,
    cutListRecap,
    diagrams,
  }
}
