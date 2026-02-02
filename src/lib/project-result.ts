import type { CutRequirement } from "./cuts"
import type { MaterialGroup } from "./material-groups"
import { optimizeCuts, type OptimizedBoard } from "./optimizer"
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
  cuts: CutRequirement[]
}

/** Cut diagrams for one material group: visuals. */
export interface DiagramGroup {
  groupId: string
  groupLabel: string
  boards: OptimizedBoard[]
  kerfInches: number
}

/** Aggregated project-level result. */
export interface ProjectResult {
  /** What to buy, grouped by nominal size. */
  shoppingList: ShoppingListEntry[]
  /** What the user entered, grouped by material group. */
  cutListRecap: CutListRecapGroup[]
  /** Cut diagrams, grouped by material group. */
  diagrams: DiagramGroup[]
}

/**
 * Run optimization per group and aggregate into a single project result.
 * Each group is optimized independently; output is unified.
 */
export function generateProjectResult(groups: MaterialGroup[]): ProjectResult {
  const shoppingByNominal = new Map<
    string,
    { name: string; byLength: Map<number, number> }
  >()
  const cutListRecap: CutListRecapGroup[] = []
  const diagrams: DiagramGroup[] = []

  for (const group of groups) {
    const boardSpec = STOCK_PROFILES.find((p) => p.id === group.boardSpecId)
    const boardCuts = group.cuts.filter((c) => (c.materialType ?? "board") === "board")

    cutListRecap.push({
      groupId: group.id,
      groupLabel: group.label,
      cuts: [...group.cuts],
    })

    if (!boardSpec || boardCuts.length === 0) {
      diagrams.push({
        groupId: group.id,
        groupLabel: group.label,
        boards: [],
        kerfInches: boardSpec?.kerf ?? 0,
      })
      continue
    }

    const boards = optimizeCuts(boardCuts, boardSpec, { scrap: group.scrap })
    diagrams.push({
      groupId: group.id,
      groupLabel: group.label,
      boards,
      kerfInches: boardSpec.kerf,
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
    cutListRecap,
    diagrams,
  }
}
