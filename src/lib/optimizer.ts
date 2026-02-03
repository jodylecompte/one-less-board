import type { BoardSpec, MaterialSpec } from "./stock-profiles"

export interface RequiredCut {
  length: number
  quantity: number
}

/** A board in the scrap pile (length and quantity on hand). */
export interface ScrapBoard {
  nominalSizeId: string
  stockLength: number
  quantity: number
}

export interface ScrapSheet {
  width: number
  height: number
  thickness: string
  quantity: number
}

export type ScrapEntry =
  | ({ materialType: "board" } & ScrapBoard)
  | ({ materialType: "sheet" } & ScrapSheet)

/** Merge board scrap by (nominalSizeId, stockLength), sum quantities, preserve first-seen order. */
export function mergeScrapBoards(scrap: ScrapBoard[]): ScrapBoard[] {
  const byKey = new Map<string, ScrapBoard>()
  for (const { nominalSizeId, stockLength, quantity } of scrap) {
    if (
      !nominalSizeId ||
      stockLength <= 0 ||
      quantity <= 0 ||
      !Number.isFinite(stockLength) ||
      !Number.isInteger(quantity)
    ) {
      continue
    }
    const key = `${nominalSizeId}:${stockLength}`
    const existing = byKey.get(key)
    if (existing) {
      existing.quantity += quantity
    } else {
      byKey.set(key, { nominalSizeId, stockLength, quantity })
    }
  }
  return [...byKey.values()]
}

/** Merge sheet scrap by (width, height, thickness), sum quantities, preserve first-seen order. */
export function mergeScrapSheets(scrap: ScrapSheet[]): ScrapSheet[] {
  const byKey = new Map<string, ScrapSheet>()
  for (const { width, height, thickness, quantity } of scrap) {
    if (
      width <= 0 ||
      height <= 0 ||
      !thickness.trim() ||
      quantity <= 0 ||
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      !Number.isInteger(quantity)
    ) {
      continue
    }
    const normalizedThickness = thickness.trim()
    const key = `${width}:${height}:${normalizedThickness}`
    const existing = byKey.get(key)
    if (existing) {
      existing.quantity += quantity
    } else {
      byKey.set(key, { width, height, thickness: normalizedThickness, quantity })
    }
  }
  return [...byKey.values()]
}

/** Merge all scrap entries by their material-specific identity. */
export function mergeScrapEntries(scrap: ScrapEntry[]): ScrapEntry[] {
  const board = mergeScrapBoards(
    scrap
      .filter((s): s is Extract<ScrapEntry, { materialType: "board" }> => s.materialType === "board")
      .map(({ nominalSizeId, stockLength, quantity }) => ({ nominalSizeId, stockLength, quantity }))
  ).map((s) => ({ ...s, materialType: "board" as const }))
  const sheet = mergeScrapSheets(
    scrap
      .filter((s): s is Extract<ScrapEntry, { materialType: "sheet" }> => s.materialType === "sheet")
      .map(({ width, height, thickness, quantity }) => ({ width, height, thickness, quantity }))
  ).map((s) => ({ ...s, materialType: "sheet" as const }))
  return [...board, ...sheet]
}

/** Minimum leftover length (inches) to count as reusable scrap; below this is waste. */
export const MIN_SCRAP_LENGTH_INCHES = 12

export interface OptimizedBoard {
  stockLength: number
  cuts: number[]
  remainingWaste: number
  /** Reusable leftover (≥ MIN_SCRAP_LENGTH_INCHES). Material-aware. */
  scrapRemaining: number
  /** Unusable leftover (below MIN_SCRAP_LENGTH_INCHES). Material-aware. */
  wasteRemaining: number
  /** Whether this board came from scrap or is new (to purchase). */
  source: "scrap" | "new"
}

export interface OptimizerInput {
  requiredCuts: RequiredCut[]
  allowedStockLengths: number[]
  kerfInches: number
}

export interface OptimizeCutsOptions {
  /** Board scrap pile (already filtered/matched by board spec). Used first before new boards. */
  scrap?: ScrapBoard[]
  /** Preferred max board length (inches). Prefer boards ≤ this; if a cut exceeds it, use smallest that fits. */
  preferredMaxLengthInches?: number
}

/**
 * Generic dispatcher: routes to the material-specific solver based on profile.materialType.
 * Extension point: add a case for "sheet" and implement optimizeSheetCuts() when needed.
 */
export function optimizeCuts(
  requiredCuts: RequiredCut[],
  profile: MaterialSpec,
  options?: OptimizeCutsOptions
): OptimizedBoard[] {
  switch (profile.materialType) {
    case "board":
      return optimizeBoardCuts(requiredCuts, profile as BoardSpec, {
        scrap: options?.scrap,
        preferredMaxLengthInches: options?.preferredMaxLengthInches,
      })
    case "sheet":
      // Extension point: implement optimizeSheetCuts(requiredCuts, profile as SheetSpec, options)
      return []
    default:
      return []
  }
}

/** Classify remaining length into scrap (reusable) vs waste. Material-aware. */
function classifyRemaining(remainingWaste: number): {
  scrapRemaining: number
  wasteRemaining: number
} {
  const r = Math.max(0, Math.round(remainingWaste * 1e6) / 1e6)
  if (r >= MIN_SCRAP_LENGTH_INCHES) {
    return { scrapRemaining: r, wasteRemaining: 0 }
  }
  return { scrapRemaining: 0, wasteRemaining: r }
}

function toOptimizedBoard(
  board: { stockLength: number; cuts: number[] },
  source: "scrap" | "new",
  kerfInches: number
): OptimizedBoard {
  const used =
    board.cuts.length === 0
      ? 0
      : board.cuts.reduce((s, c) => s + c, 0) + (board.cuts.length - 1) * kerfInches
  const remainingWaste = Math.max(0, board.stockLength - used)
  const { scrapRemaining, wasteRemaining } = classifyRemaining(remainingWaste)
  return {
    stockLength: board.stockLength,
    cuts: [...board.cuts],
    remainingWaste,
    scrapRemaining,
    wasteRemaining,
    source,
  }
}

/**
 * Place cuts onto a fixed pool of boards (e.g. scrap). Does not create new boards.
 * Returns placed boards and list of cut lengths that did not fit.
 */
function placeCutsOntoBoards(
  sortedCuts: number[],
  boardPool: { stockLength: number; cuts: number[] }[],
  kerfInches: number
): { boards: { stockLength: number; cuts: number[] }[]; unassigned: number[] } {
  const boards = boardPool.map((b) => ({ stockLength: b.stockLength, cuts: [...b.cuts] }))
  const unassigned: number[] = []

  function usedLength(cuts: number[]): number {
    if (cuts.length === 0) return 0
    return cuts.reduce((s, c) => s + c, 0) + (cuts.length - 1) * kerfInches
  }
  function remaining(board: { stockLength: number; cuts: number[] }): number {
    return board.stockLength - usedLength(board.cuts)
  }
  function canFit(board: { stockLength: number; cuts: number[] }, cut: number): boolean {
    const needKerf = board.cuts.length > 0 ? kerfInches : 0
    return remaining(board) >= cut + needKerf
  }

  for (const cut of sortedCuts) {
    let bestBoard: { stockLength: number; cuts: number[] } | null = null
    let bestRemainingAfter = Infinity
    for (const board of boards) {
      if (!canFit(board, cut)) continue
      const remAfter = remaining(board) - cut
      if (remAfter < bestRemainingAfter) {
        bestRemainingAfter = remAfter
        bestBoard = board
      }
    }
    if (bestBoard !== null) {
      bestBoard.cuts.push(cut)
    } else {
      unassigned.push(cut)
    }
  }

  const placed = boards.filter((b) => b.cuts.length > 0)
  return { boards: placed, unassigned }
}

/**
 * Place unassigned cuts onto new boards from allowedLengths. Same greedy algorithm.
 * Prefers boards ≤ preferredMaxLengthInches when multiple lengths fit; if cut exceeds preferred max, uses smallest that fits.
 */
function placeCutsOntoNewBoards(
  sortedCuts: number[],
  allowedLengths: number[],
  kerfInches: number,
  preferredMaxLengthInches?: number
): { stockLength: number; cuts: number[] }[] {
  if (allowedLengths.length === 0 || sortedCuts.length === 0) return []
  const preferred = preferredMaxLengthInches ?? Infinity
  const sortedStock = [...allowedLengths].sort((a, b) => {
    const aPrefer = a <= preferred ? 0 : 1
    const bPrefer = b <= preferred ? 0 : 1
    if (aPrefer !== bPrefer) return aPrefer - bPrefer
    return a - b
  })
  const minStock = Math.min(...allowedLengths)
  const boards: { stockLength: number; cuts: number[] }[] = []

  function usedLength(cuts: number[]): number {
    if (cuts.length === 0) return 0
    return cuts.reduce((s, c) => s + c, 0) + (cuts.length - 1) * kerfInches
  }
  function remaining(board: { stockLength: number; cuts: number[] }): number {
    return board.stockLength - usedLength(board.cuts)
  }
  function canFit(board: { stockLength: number; cuts: number[] }, cut: number): boolean {
    const needKerf = board.cuts.length > 0 ? kerfInches : 0
    return remaining(board) >= cut + needKerf
  }
  function shortestStockThatFits(cut: number): number | null {
    for (const stock of sortedStock) {
      if (stock >= cut) return stock
    }
    return null
  }

  for (const cut of sortedCuts) {
    if (cut > minStock) continue
    let bestBoard: { stockLength: number; cuts: number[] } | null = null
    let bestRemainingAfter = Infinity
    for (const board of boards) {
      if (!canFit(board, cut)) continue
      const remAfter = remaining(board) - cut
      if (remAfter < bestRemainingAfter) {
        bestRemainingAfter = remAfter
        bestBoard = board
      }
    }
    if (bestBoard !== null) {
      bestBoard.cuts.push(cut)
      continue
    }
    const stockLength = shortestStockThatFits(cut)
    if (stockLength === null) continue
    boards.push({ stockLength, cuts: [cut] })
  }
  return boards
}

/**
 * 1D cutting stock optimizer for board material.
 * Scrap-first: places cuts onto scrap boards first, then new boards from allowedLengths.
 * Minimizes number of boards; prefers shorter stock when tie-breaking.
 * Deterministic: same input always yields same output.
 */
export function optimizeBoardCuts(
  requiredCuts: RequiredCut[],
  spec: BoardSpec,
  options?: { scrap?: ScrapBoard[]; preferredMaxLengthInches?: number }
): OptimizedBoard[] {
  const { allowedLengths, kerf } = spec
  const kerfInches = kerf

  if (allowedLengths.length === 0 || kerf < 0) {
    return []
  }

  const cutsList: number[] = []
  for (const { length, quantity } of requiredCuts) {
    if (length <= 0 || quantity <= 0 || !Number.isFinite(length) || !Number.isInteger(quantity)) continue
    for (let i = 0; i < quantity; i++) {
      cutsList.push(length)
    }
  }
  if (cutsList.length === 0) return []

  const sortedCuts = [...cutsList].sort((a, b) => b - a)
  const result: OptimizedBoard[] = []

  // Phase 1: place onto scrap (boards only)
  const scrap = options?.scrap ?? []
  const scrapPool: { stockLength: number; cuts: number[] }[] = []
  for (const { stockLength, quantity } of scrap) {
    if (stockLength <= 0 || quantity <= 0 || !Number.isFinite(stockLength) || !Number.isInteger(quantity)) continue
    for (let i = 0; i < quantity; i++) {
      scrapPool.push({ stockLength, cuts: [] })
    }
  }
  const { boards: scrapBoardsUsed, unassigned } = placeCutsOntoBoards(
    sortedCuts,
    scrapPool,
    kerfInches
  )
  for (const board of scrapBoardsUsed) {
    result.push(toOptimizedBoard(board, "scrap", kerfInches))
  }

  // Phase 2: remaining cuts onto new boards (prefer lengths ≤ preferredMaxLengthInches)
  const newBoards = placeCutsOntoNewBoards(
    unassigned,
    allowedLengths,
    kerfInches,
    options?.preferredMaxLengthInches
  )
  for (const board of newBoards) {
    result.push(toOptimizedBoard(board, "new", kerfInches))
  }

  return result
}

/**
 * @deprecated Use optimizeCuts(requiredCuts, boardSpec, options) or optimizeBoardCuts() instead.
 */
export function optimize(input: OptimizerInput): OptimizedBoard[] {
  return optimizeBoardCuts(
    input.requiredCuts,
    {
      materialType: "board",
      id: "",
      name: "",
      allowedLengths: input.allowedStockLengths,
      kerf: input.kerfInches,
    },
    {}
  )
}
