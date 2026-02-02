export interface RequiredCut {
  length: number
  quantity: number
}

export interface OptimizedBoard {
  stockLength: number
  cuts: number[]
  remainingWaste: number
}

export interface OptimizerInput {
  requiredCuts: RequiredCut[]
  allowedStockLengths: number[]
  kerfInches: number
}

/**
 * 1D cutting stock optimizer.
 * Minimizes number of boards; prefers shorter stock when tie-breaking.
 * Deterministic: same input always yields same output.
 */
export function optimize(input: OptimizerInput): OptimizedBoard[] {
  const { requiredCuts, allowedStockLengths, kerfInches } = input

  if (allowedStockLengths.length === 0 || kerfInches < 0) {
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
  const sortedStock = [...allowedStockLengths].sort((a, b) => a - b)
  const minStock = Math.min(...sortedStock)

  const boards: { stockLength: number; cuts: number[] }[] = []

  function usedLength(cuts: number[]): number {
    if (cuts.length === 0) return 0
    return cuts.reduce((s, c) => s + c, 0) + (cuts.length - 1) * kerfInches
  }

  function remaining(board: { stockLength: number; cuts: number[] }): number {
    return board.stockLength - usedLength(board.cuts)
  }

  /** First cut needs only cut length; each additional cut needs kerf + cut length */
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

  return boards.map((board) => {
    const used = usedLength(board.cuts)
    const remainingWaste = board.stockLength - used
    return {
      stockLength: board.stockLength,
      cuts: [...board.cuts],
      remainingWaste: Math.max(0, Math.round(remainingWaste * 1e6) / 1e6),
    }
  })
}
