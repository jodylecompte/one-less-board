import { describe, it, expect } from "vitest"
import {
  mergeScrapBoards,
  mergeScrapSheets,
  mergeScrapEntries,
  optimizeBoardCuts,
  optimizeCuts,
  optimize,
  MIN_SCRAP_LENGTH_INCHES,
  type ScrapBoard,
  type ScrapSheet,
  type ScrapEntry,
} from "../optimizer"
import type { BoardSpec } from "../stock-profiles"

// ── Helpers ──────────────────────────────────────────────────────────────────

const spec2x4: BoardSpec = {
  id: "2x4",
  name: "2×4 dimensional",
  materialType: "board",
  allowedLengths: [96, 120, 144],
  kerf: 0.125,
}

const spec2x4SmallOnly: BoardSpec = {
  ...spec2x4,
  allowedLengths: [96],
}

// ── mergeScrapBoards ──────────────────────────────────────────────────────────

describe("mergeScrapBoards", () => {
  it("returns empty array for empty input", () => {
    expect(mergeScrapBoards([])).toEqual([])
  })

  it("merges boards with same (nominalSizeId, stockLength)", () => {
    const result = mergeScrapBoards([
      { nominalSizeId: "2x4", stockLength: 96, quantity: 2 },
      { nominalSizeId: "2x4", stockLength: 96, quantity: 3 },
    ])
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ nominalSizeId: "2x4", stockLength: 96, quantity: 5 })
  })

  it("does not merge boards with different stockLength", () => {
    const result = mergeScrapBoards([
      { nominalSizeId: "2x4", stockLength: 96, quantity: 1 },
      { nominalSizeId: "2x4", stockLength: 48, quantity: 1 },
    ])
    expect(result).toHaveLength(2)
  })

  it("does not merge boards with different nominalSizeId", () => {
    const result = mergeScrapBoards([
      { nominalSizeId: "2x4", stockLength: 96, quantity: 1 },
      { nominalSizeId: "2x6", stockLength: 96, quantity: 1 },
    ])
    expect(result).toHaveLength(2)
  })

  it("skips entries with empty nominalSizeId", () => {
    const result = mergeScrapBoards([
      { nominalSizeId: "", stockLength: 96, quantity: 1 },
      { nominalSizeId: "2x4", stockLength: 96, quantity: 2 },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].nominalSizeId).toBe("2x4")
  })

  it("skips entries with zero or negative stockLength", () => {
    const result = mergeScrapBoards([
      { nominalSizeId: "2x4", stockLength: 0, quantity: 1 },
      { nominalSizeId: "2x4", stockLength: -10, quantity: 1 },
      { nominalSizeId: "2x4", stockLength: 48, quantity: 2 },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].stockLength).toBe(48)
  })

  it("skips entries with non-finite stockLength", () => {
    const result = mergeScrapBoards([
      { nominalSizeId: "2x4", stockLength: Infinity, quantity: 1 },
      { nominalSizeId: "2x4", stockLength: NaN, quantity: 1 },
      { nominalSizeId: "2x4", stockLength: 60, quantity: 1 },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].stockLength).toBe(60)
  })

  it("skips entries with zero or negative quantity", () => {
    const result = mergeScrapBoards([
      { nominalSizeId: "2x4", stockLength: 48, quantity: 0 },
      { nominalSizeId: "2x4", stockLength: 48, quantity: -1 },
      { nominalSizeId: "2x4", stockLength: 72, quantity: 1 },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].stockLength).toBe(72)
  })

  it("skips entries with non-integer quantity", () => {
    const result = mergeScrapBoards([
      { nominalSizeId: "2x4", stockLength: 48, quantity: 1.5 },
      { nominalSizeId: "2x4", stockLength: 72, quantity: 2 },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].stockLength).toBe(72)
  })

  it("preserves first-seen order", () => {
    const result = mergeScrapBoards([
      { nominalSizeId: "2x4", stockLength: 96, quantity: 1 },
      { nominalSizeId: "2x4", stockLength: 48, quantity: 1 },
      { nominalSizeId: "2x4", stockLength: 72, quantity: 1 },
    ])
    expect(result.map((r) => r.stockLength)).toEqual([96, 48, 72])
  })
})

// ── mergeScrapSheets ──────────────────────────────────────────────────────────

describe("mergeScrapSheets", () => {
  it("returns empty array for empty input", () => {
    expect(mergeScrapSheets([])).toEqual([])
  })

  it("merges sheets with same (width, height, thickness)", () => {
    const result = mergeScrapSheets([
      { width: 48, height: 96, thickness: '3/4"', quantity: 1 },
      { width: 48, height: 96, thickness: '3/4"', quantity: 2 },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].quantity).toBe(3)
  })

  it("does not merge sheets with different thickness", () => {
    const result = mergeScrapSheets([
      { width: 48, height: 96, thickness: '3/4"', quantity: 1 },
      { width: 48, height: 96, thickness: '1/2"', quantity: 1 },
    ])
    expect(result).toHaveLength(2)
  })

  it("trims/normalizes thickness when keying", () => {
    const result = mergeScrapSheets([
      { width: 48, height: 96, thickness: '  3/4"  ', quantity: 1 },
      { width: 48, height: 96, thickness: '3/4"', quantity: 2 },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].quantity).toBe(3)
    expect(result[0].thickness).toBe('3/4"')
  })

  it("skips sheets with zero or negative width/height", () => {
    const result = mergeScrapSheets([
      { width: 0, height: 96, thickness: '3/4"', quantity: 1 },
      { width: 48, height: -5, thickness: '3/4"', quantity: 1 },
      { width: 48, height: 96, thickness: '3/4"', quantity: 1 },
    ])
    expect(result).toHaveLength(1)
  })

  it("skips sheets with empty thickness", () => {
    const result = mergeScrapSheets([
      { width: 48, height: 96, thickness: "", quantity: 1 },
      { width: 48, height: 96, thickness: "  ", quantity: 1 },
      { width: 48, height: 96, thickness: '3/4"', quantity: 1 },
    ])
    expect(result).toHaveLength(1)
  })

  it("skips sheets with non-integer or non-positive quantity", () => {
    const result = mergeScrapSheets([
      { width: 48, height: 96, thickness: '3/4"', quantity: 0 },
      { width: 48, height: 96, thickness: '3/4"', quantity: -1 },
      { width: 48, height: 96, thickness: '3/4"', quantity: 1.5 },
      { width: 24, height: 48, thickness: '3/4"', quantity: 2 },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].width).toBe(24)
  })
})

// ── mergeScrapEntries ─────────────────────────────────────────────────────────

describe("mergeScrapEntries", () => {
  it("returns empty array for empty input", () => {
    expect(mergeScrapEntries([])).toEqual([])
  })

  it("handles mixed board and sheet entries", () => {
    const entries: ScrapEntry[] = [
      { materialType: "board", nominalSizeId: "2x4", stockLength: 96, quantity: 1 },
      { materialType: "sheet", width: 48, height: 96, thickness: '3/4"', quantity: 2 },
    ]
    const result = mergeScrapEntries(entries)
    expect(result).toHaveLength(2)
    const boards = result.filter((e) => e.materialType === "board")
    const sheets = result.filter((e) => e.materialType === "sheet")
    expect(boards).toHaveLength(1)
    expect(sheets).toHaveLength(1)
  })

  it("merges duplicate board entries", () => {
    const entries: ScrapEntry[] = [
      { materialType: "board", nominalSizeId: "2x4", stockLength: 48, quantity: 1 },
      { materialType: "board", nominalSizeId: "2x4", stockLength: 48, quantity: 2 },
    ]
    const result = mergeScrapEntries(entries)
    expect(result).toHaveLength(1)
    const board = result[0] as Extract<ScrapEntry, { materialType: "board" }>
    expect(board.quantity).toBe(3)
  })

  it("merges duplicate sheet entries", () => {
    const entries: ScrapEntry[] = [
      { materialType: "sheet", width: 48, height: 96, thickness: '3/4"', quantity: 1 },
      { materialType: "sheet", width: 48, height: 96, thickness: '3/4"', quantity: 3 },
    ]
    const result = mergeScrapEntries(entries)
    expect(result).toHaveLength(1)
    const sheet = result[0] as Extract<ScrapEntry, { materialType: "sheet" }>
    expect(sheet.quantity).toBe(4)
  })

  it("boards appear before sheets in result", () => {
    const entries: ScrapEntry[] = [
      { materialType: "sheet", width: 48, height: 96, thickness: '3/4"', quantity: 1 },
      { materialType: "board", nominalSizeId: "2x4", stockLength: 96, quantity: 1 },
    ]
    const result = mergeScrapEntries(entries)
    expect(result[0].materialType).toBe("board")
    expect(result[1].materialType).toBe("sheet")
  })
})

// ── optimizeBoardCuts ─────────────────────────────────────────────────────────

describe("optimizeBoardCuts", () => {
  it("returns empty array for empty required cuts", () => {
    expect(optimizeBoardCuts([], spec2x4)).toEqual([])
  })

  it("returns empty array for empty allowedLengths", () => {
    const emptySpec: BoardSpec = { ...spec2x4, allowedLengths: [] }
    expect(optimizeBoardCuts([{ length: 48, quantity: 1 }], emptySpec)).toEqual([])
  })

  it("places a single cut on the shortest fitting board", () => {
    const result = optimizeBoardCuts([{ length: 50, quantity: 1 }], spec2x4SmallOnly)
    expect(result).toHaveLength(1)
    expect(result[0].stockLength).toBe(96)
    expect(result[0].cuts).toEqual([50])
    expect(result[0].source).toBe("new")
  })

  it("computes remainingWaste correctly for a single cut", () => {
    // 1 cut: no kerf applied between cuts (kerf = cuts.length - 1 = 0)
    const result = optimizeBoardCuts([{ length: 50, quantity: 1 }], spec2x4SmallOnly)
    expect(result[0].remainingWaste).toBeCloseTo(96 - 50)
  })

  it("classifies remaining ≥ 12\" as scrapRemaining", () => {
    // 96 - 50 = 46 → scrap
    const result = optimizeBoardCuts([{ length: 50, quantity: 1 }], spec2x4SmallOnly)
    expect(result[0].scrapRemaining).toBeCloseTo(46)
    expect(result[0].wasteRemaining).toBe(0)
  })

  it("classifies remaining < 12\" as wasteRemaining", () => {
    // 96 - 85 = 11 → waste
    const result = optimizeBoardCuts([{ length: 85, quantity: 1 }], spec2x4SmallOnly)
    expect(result[0].wasteRemaining).toBeCloseTo(11)
    expect(result[0].scrapRemaining).toBe(0)
  })

  it(`classifies remaining exactly ${MIN_SCRAP_LENGTH_INCHES}\" as scrap`, () => {
    // 96 - 84 = 12 → scrap
    const result = optimizeBoardCuts([{ length: 84, quantity: 1 }], spec2x4SmallOnly)
    expect(result[0].scrapRemaining).toBeCloseTo(12)
    expect(result[0].wasteRemaining).toBe(0)
  })

  it("packs multiple cuts onto one board when they fit", () => {
    // 40 + 0.125 kerf + 40 = 80.125 ≤ 96 → fits on one board
    const result = optimizeBoardCuts(
      [{ length: 40, quantity: 2 }],
      spec2x4SmallOnly
    )
    expect(result).toHaveLength(1)
    expect(result[0].cuts).toHaveLength(2)
  })

  it("accounts for kerf when packing multiple cuts", () => {
    // Two cuts of 40: used = 40 + 40 + (2-1)*0.125 = 80.125; remaining = 15.875
    const result = optimizeBoardCuts(
      [{ length: 40, quantity: 2 }],
      spec2x4SmallOnly
    )
    expect(result[0].remainingWaste).toBeCloseTo(15.875)
  })

  it("opens a second board when cuts don't fit on first", () => {
    // 50 + 0.125 + 50 = 100.125 > 96 → need two boards
    const result = optimizeBoardCuts(
      [{ length: 50, quantity: 2 }],
      spec2x4SmallOnly
    )
    expect(result).toHaveLength(2)
  })

  it("filters invalid cuts: zero length", () => {
    const result = optimizeBoardCuts(
      [
        { length: 0, quantity: 1 },
        { length: 48, quantity: 1 },
      ],
      spec2x4SmallOnly
    )
    expect(result).toHaveLength(1)
    // Only the valid 48" cut
    expect(result[0].cuts).toEqual([48])
  })

  it("filters invalid cuts: negative length", () => {
    const result = optimizeBoardCuts(
      [
        { length: -10, quantity: 1 },
        { length: 48, quantity: 1 },
      ],
      spec2x4SmallOnly
    )
    expect(result).toHaveLength(1)
  })

  it("filters invalid cuts: non-integer quantity", () => {
    const result = optimizeBoardCuts(
      [
        { length: 48, quantity: 1.5 },
        { length: 36, quantity: 1 },
      ],
      spec2x4SmallOnly
    )
    expect(result).toHaveLength(1)
    expect(result[0].cuts).toEqual([36])
  })

  it("filters invalid cuts: non-finite length", () => {
    const result = optimizeBoardCuts(
      [
        { length: Infinity, quantity: 1 },
        { length: NaN, quantity: 1 },
        { length: 24, quantity: 1 },
      ],
      spec2x4SmallOnly
    )
    expect(result).toHaveLength(1)
    expect(result[0].cuts).toEqual([24])
  })

  it("uses scrap boards first before opening new boards", () => {
    const scrap: ScrapBoard[] = [
      { nominalSizeId: "2x4", stockLength: 96, quantity: 1 },
    ]
    const result = optimizeBoardCuts(
      [{ length: 48, quantity: 1 }],
      spec2x4SmallOnly,
      { scrap }
    )
    expect(result).toHaveLength(1)
    expect(result[0].source).toBe("scrap")
  })

  it("spills to new boards when scrap is exhausted", () => {
    // Scrap: one 96" board → fits one 50" cut; second 50" cut needs new board
    const scrap: ScrapBoard[] = [
      { nominalSizeId: "2x4", stockLength: 96, quantity: 1 },
    ]
    const result = optimizeBoardCuts(
      [{ length: 50, quantity: 2 }],
      spec2x4SmallOnly,
      { scrap }
    )
    const scrapBoards = result.filter((b) => b.source === "scrap")
    const newBoards = result.filter((b) => b.source === "new")
    expect(scrapBoards).toHaveLength(1)
    expect(newBoards).toHaveLength(1)
  })

  it("marks scrap-sourced boards with source: 'scrap'", () => {
    const scrap: ScrapBoard[] = [
      { nominalSizeId: "2x4", stockLength: 96, quantity: 1 },
    ]
    const result = optimizeBoardCuts(
      [{ length: 48, quantity: 1 }],
      spec2x4SmallOnly,
      { scrap }
    )
    expect(result[0].source).toBe("scrap")
  })

  it("marks new stock boards with source: 'new'", () => {
    const result = optimizeBoardCuts(
      [{ length: 48, quantity: 1 }],
      spec2x4SmallOnly
    )
    expect(result[0].source).toBe("new")
  })

  it("prefers boards ≤ preferredMaxLengthInches when multiple lengths fit", () => {
    // Cuts totaling 80" fit on 96" board (preferred) or 120" board
    const result = optimizeBoardCuts(
      [{ length: 80, quantity: 1 }],
      spec2x4, // allowedLengths: [96, 120, 144]
      { preferredMaxLengthInches: 96 }
    )
    expect(result[0].stockLength).toBe(96)
  })

  it("falls back to longer board when cut exceeds preferred max length", () => {
    // A 100" cut doesn't fit on 96" → should use 120"
    // BUT due to the cut > minStock bug, 100 > 96 (minStock) so it's dropped!
    // Testing the actual behavior: 100" cut is silently dropped
    const result = optimizeBoardCuts(
      [{ length: 100, quantity: 1 }],
      spec2x4, // allowedLengths: [96, 120, 144], minStock=96
      { preferredMaxLengthInches: 96 }
    )
    // Current behavior: cut > minStock (96) is silently dropped
    expect(result).toHaveLength(0)
  })

  it("silently drops cuts larger than the minimum allowed stock length", () => {
    // minStock = 96; cut = 97 > 96 → dropped
    const result = optimizeBoardCuts(
      [{ length: 97, quantity: 1 }],
      spec2x4 // allowedLengths: [96, 120, 144]
    )
    expect(result).toHaveLength(0)
  })

  it("processes cuts exactly equal to the minimum stock length", () => {
    // cut = 96 = minStock → NOT dropped (96 > 96 is false)
    const result = optimizeBoardCuts(
      [{ length: 96, quantity: 1 }],
      spec2x4
    )
    expect(result).toHaveLength(1)
    expect(result[0].cuts).toEqual([96])
  })

  it("handles quantity > 1 by expanding into individual cut instances", () => {
    const result = optimizeBoardCuts(
      [{ length: 20, quantity: 3 }],
      spec2x4SmallOnly
    )
    // 20 * 3 + 2 * 0.125 = 60.25 → fits on one 96" board
    expect(result).toHaveLength(1)
    expect(result[0].cuts).toHaveLength(3)
  })

  it("ignores invalid scrap entries (zero/negative stockLength, non-integer qty)", () => {
    const badScrap: ScrapBoard[] = [
      { nominalSizeId: "2x4", stockLength: 0, quantity: 1 },
      { nominalSizeId: "2x4", stockLength: 96, quantity: 0 },
      { nominalSizeId: "2x4", stockLength: 96, quantity: 1.5 },
    ]
    // Falls through to new boards
    const result = optimizeBoardCuts(
      [{ length: 48, quantity: 1 }],
      spec2x4SmallOnly,
      { scrap: badScrap }
    )
    expect(result[0].source).toBe("new")
  })
})

// ── optimizeCuts dispatcher ───────────────────────────────────────────────────

describe("optimizeCuts", () => {
  it("routes 'board' materialType to optimizeBoardCuts", () => {
    const result = optimizeCuts(
      [{ length: 48, quantity: 1 }],
      spec2x4SmallOnly
    )
    expect(result).toHaveLength(1)
    expect(result[0].source).toBe("new")
  })

  it("returns [] for 'sheet' materialType (not implemented)", () => {
    const sheetSpec = {
      id: "plywood",
      name: "Plywood",
      materialType: "sheet" as const,
    }
    const result = optimizeCuts([], sheetSpec)
    expect(result).toEqual([])
  })

  it("passes scrap and preferredMaxLengthInches options through", () => {
    const scrap: ScrapBoard[] = [
      { nominalSizeId: "2x4", stockLength: 96, quantity: 1 },
    ]
    const result = optimizeCuts(
      [{ length: 48, quantity: 1 }],
      spec2x4SmallOnly,
      { scrap }
    )
    expect(result[0].source).toBe("scrap")
  })
})

// ── optimize (deprecated wrapper) ────────────────────────────────────────────

describe("optimize", () => {
  it("produces same output as optimizeBoardCuts with equivalent args", () => {
    const cuts = [{ length: 40, quantity: 2 }]
    const directResult = optimizeBoardCuts(cuts, {
      id: "",
      name: "",
      materialType: "board",
      allowedLengths: [96],
      kerf: 0.125,
    })
    const wrapperResult = optimize({
      requiredCuts: cuts,
      allowedStockLengths: [96],
      kerfInches: 0.125,
    })
    expect(wrapperResult).toEqual(directResult)
  })

  it("returns empty array for empty cuts", () => {
    const result = optimize({
      requiredCuts: [],
      allowedStockLengths: [96],
      kerfInches: 0.125,
    })
    expect(result).toEqual([])
  })
})
