import { describe, it, expect } from "vitest"
import { generateProjectResult } from "../project-result"
import { createBoardGroup, createSheetGroup } from "../material-groups"
import type { MaterialGroup } from "../material-groups"
import type { ScrapEntry } from "../optimizer"

// ── Helpers ──────────────────────────────────────────────────────────────────

function boardGroup(overrides?: Partial<MaterialGroup>): MaterialGroup {
  return { ...createBoardGroup(), ...overrides }
}

function sheetGroup(overrides?: Partial<MaterialGroup>): MaterialGroup {
  return { ...createSheetGroup(), ...overrides }
}

// ── generateProjectResult ─────────────────────────────────────────────────────

describe("generateProjectResult", () => {
  it("returns empty results for empty groups", () => {
    const result = generateProjectResult([])
    expect(result.shoppingList).toEqual([])
    expect(result.shoppingListSheets).toEqual([])
    expect(result.cutListRecap).toEqual([])
    expect(result.diagrams).toEqual([])
  })

  describe("board group with cuts", () => {
    it("creates a shopping list entry for new boards", () => {
      const group = boardGroup({
        boardSpecId: "2x4",
        cuts: [{ length: 48, quantity: 2 }],
      })
      const result = generateProjectResult([group])
      expect(result.shoppingList).toHaveLength(1)
      expect(result.shoppingList[0].nominalSizeId).toBe("2x4")
      expect(result.shoppingList[0].nominalSizeName).toBe("2×4 dimensional")
    })

    it("shopping list entry items contain correct stock lengths and counts", () => {
      // 48 + 0.125 + 48 = 96.125 > 96, so 2 boards of 96"
      const group = boardGroup({
        boardSpecId: "2x4",
        cuts: [{ length: 48, quantity: 2 }],
      })
      const result = generateProjectResult([group])
      const items = result.shoppingList[0].items
      expect(items.some((i) => i.stockLength === 96 && i.count === 2)).toBe(true)
    })

    it("creates a diagram entry for the group", () => {
      const group = boardGroup({
        boardSpecId: "2x4",
        cuts: [{ length: 48, quantity: 1 }],
      })
      const result = generateProjectResult([group])
      expect(result.diagrams).toHaveLength(1)
      expect(result.diagrams[0].groupId).toBe(group.id)
      expect(result.diagrams[0].groupLabel).toBe(group.label)
      expect(result.diagrams[0].boardSpecId).toBe("2x4")
      expect(result.diagrams[0].kerfInches).toBe(0.125)
    })

    it("diagram includes preferredMaxLengthInches from the group", () => {
      const group = boardGroup({
        boardSpecId: "2x4",
        maxLengthPreferenceInches: 120,
        cuts: [{ length: 48, quantity: 1 }],
      })
      const result = generateProjectResult([group])
      expect(result.diagrams[0].preferredMaxLengthInches).toBe(120)
    })

    it("diagram has materialType 'board'", () => {
      const group = boardGroup({
        boardSpecId: "2x4",
        cuts: [{ length: 48, quantity: 1 }],
      })
      const result = generateProjectResult([group])
      expect(result.diagrams[0].materialType).toBe("board")
    })
  })

  describe("board group with no cuts", () => {
    it("does not create a shopping list entry", () => {
      const group = boardGroup({ boardSpecId: "2x4", cuts: [] })
      const result = generateProjectResult([group])
      expect(result.shoppingList).toHaveLength(0)
    })

    it("creates a diagram entry with empty boards array", () => {
      const group = boardGroup({ boardSpecId: "2x4", cuts: [] })
      const result = generateProjectResult([group])
      expect(result.diagrams).toHaveLength(1)
      expect(result.diagrams[0].boards).toEqual([])
    })

    it("still populates cutListRecap", () => {
      const group = boardGroup({ boardSpecId: "2x4", cuts: [] })
      const result = generateProjectResult([group])
      expect(result.cutListRecap).toHaveLength(1)
      expect(result.cutListRecap[0].groupId).toBe(group.id)
    })
  })

  describe("board group with unknown boardSpecId", () => {
    it("does not create a shopping list entry", () => {
      const group = boardGroup({
        boardSpecId: "unknown-spec",
        cuts: [{ length: 48, quantity: 1 }],
      })
      const result = generateProjectResult([group])
      expect(result.shoppingList).toHaveLength(0)
    })

    it("creates a diagram entry with empty boards array", () => {
      const group = boardGroup({
        boardSpecId: "unknown-spec",
        cuts: [{ length: 48, quantity: 1 }],
      })
      const result = generateProjectResult([group])
      expect(result.diagrams[0].boards).toEqual([])
    })
  })

  describe("cutListRecap", () => {
    it("populates cuts for board groups", () => {
      const cuts = [{ length: 36, quantity: 3, materialType: "board" as const }]
      const group = boardGroup({ cuts })
      const result = generateProjectResult([group])
      expect(result.cutListRecap[0].cuts).toEqual(cuts)
      expect(result.cutListRecap[0].sheetPieces).toEqual([])
    })

    it("populates sheetPieces for sheet groups", () => {
      const pieces = [{ width: 24, height: 48, quantity: 2 }]
      const group = sheetGroup({ sheetPieces: pieces })
      const result = generateProjectResult([group])
      expect(result.cutListRecap[0].sheetPieces).toEqual(pieces)
      expect(result.cutListRecap[0].cuts).toEqual([])
    })
  })

  describe("sheet group", () => {
    it("does not create a board shopping list entry", () => {
      const group = sheetGroup({
        sheetPieces: [{ width: 24, height: 48, quantity: 1 }],
      })
      const result = generateProjectResult([group])
      expect(result.shoppingList).toHaveLength(0)
    })

    it("creates a shoppingListSheets entry when sheetPieces exist", () => {
      const group = sheetGroup({
        sheetPieces: [{ width: 24, height: 48, quantity: 1 }],
        sheetStockWidth: 48,
        sheetStockHeight: 96,
        sheetThickness: '3/4"',
      })
      const result = generateProjectResult([group])
      expect(result.shoppingListSheets).toHaveLength(1)
      expect(result.shoppingListSheets[0].groupId).toBe(group.id)
      expect(result.shoppingListSheets[0].sheetWidth).toBe(48)
      expect(result.shoppingListSheets[0].sheetHeight).toBe(96)
      expect(result.shoppingListSheets[0].thickness).toBe('3/4"')
    })

    it("does not create a shoppingListSheets entry when no sheetPieces", () => {
      const group = sheetGroup({ sheetPieces: [] })
      const result = generateProjectResult([group])
      expect(result.shoppingListSheets).toHaveLength(0)
    })

    it("creates a diagram entry with materialType 'sheet'", () => {
      const group = sheetGroup({
        sheetPieces: [{ width: 24, height: 48, quantity: 1 }],
      })
      const result = generateProjectResult([group])
      expect(result.diagrams[0].materialType).toBe("sheet")
      expect(result.diagrams[0].boards).toEqual([])
      expect(result.diagrams[0].kerfInches).toBe(0)
    })
  })

  describe("kerf override", () => {
    it("uses spec's default kerf when no override", () => {
      const group = boardGroup({
        boardSpecId: "2x4",
        cuts: [{ length: 48, quantity: 1 }],
      })
      const result = generateProjectResult([group])
      expect(result.diagrams[0].kerfInches).toBe(0.125)
    })

    it("uses kerfOverrideInches when set", () => {
      const group = boardGroup({
        boardSpecId: "2x4",
        kerfOverrideInches: 0.09,
        cuts: [{ length: 48, quantity: 1 }],
      })
      const result = generateProjectResult([group])
      expect(result.diagrams[0].kerfInches).toBe(0.09)
    })

    it("applies kerf override to the optimization (remainingWaste reflects overridden kerf)", () => {
      // Two 40" cuts with kerf=0: used = 80, remaining = 16
      // Two 40" cuts with kerf=0.125: used = 80.125, remaining = 15.875
      const group = boardGroup({
        boardSpecId: "2x4",
        kerfOverrideInches: 0,
        cuts: [{ length: 40, quantity: 2 }],
      })
      const result = generateProjectResult([group])
      const board = result.diagrams[0].boards[0]
      expect(board.remainingWaste).toBeCloseTo(16)
    })
  })

  describe("custom allowed lengths", () => {
    it("extends allowed lengths so cuts use custom stock when beneficial", () => {
      // A group with only 96" spec but custom 60" length added
      // A 55" cut should fit on the custom 60" board (shorter than opening a 96" board)
      const group = boardGroup({
        boardSpecId: "2x4",
        customAllowedLengths: [60],
        cuts: [{ length: 55, quantity: 1 }],
      })
      const result = generateProjectResult([group])
      // The optimizer should prefer the 60" board (shortest that fits)
      expect(result.diagrams[0].boards[0].stockLength).toBe(60)
    })

    it("deduplicates custom lengths that overlap with spec lengths", () => {
      // 96 is already in spec; adding it again shouldn't duplicate
      const group = boardGroup({
        boardSpecId: "2x4",
        customAllowedLengths: [96, 168],
        cuts: [{ length: 48, quantity: 1 }],
      })
      // Should not crash or produce weird results
      const result = generateProjectResult([group])
      expect(result.diagrams[0].boards.length).toBeGreaterThan(0)
    })
  })

  describe("scrap handling", () => {
    it("boards with source 'scrap' are excluded from shopping list count", () => {
      const group = boardGroup({
        boardSpecId: "2x4",
        cuts: [{ length: 48, quantity: 1 }],
      })
      const scrap: ScrapEntry[] = [
        { materialType: "board", nominalSizeId: "2x4", stockLength: 96, quantity: 1 },
      ]
      const result = generateProjectResult([group], { scrap })
      // The cut fits on the scrap board → no new boards to purchase
      expect(result.shoppingList).toHaveLength(0)
    })

    it("new boards still appear in shopping list when scrap is insufficient", () => {
      // Two 50" cuts; one scrap 96" board fits one; the other needs a new board
      const group = boardGroup({
        boardSpecId: "2x4",
        cuts: [{ length: 50, quantity: 2 }],
      })
      const scrap: ScrapEntry[] = [
        { materialType: "board", nominalSizeId: "2x4", stockLength: 96, quantity: 1 },
      ]
      const result = generateProjectResult([group], { scrap })
      expect(result.shoppingList).toHaveLength(1)
      // 1 new board needed
      const totalCount = result.shoppingList[0].items.reduce((s, i) => s + i.count, 0)
      expect(totalCount).toBe(1)
    })
  })

  describe("multiple groups", () => {
    it("aggregates counts for multiple groups with the same nominal size", () => {
      const group1 = boardGroup({
        boardSpecId: "2x4",
        cuts: [{ length: 48, quantity: 2 }], // 2 boards
      })
      const group2 = boardGroup({
        boardSpecId: "2x4",
        cuts: [{ length: 48, quantity: 2 }], // 2 more boards
      })
      const result = generateProjectResult([group1, group2])
      // Should be one shopping list entry for "2x4" with total count = 4
      expect(result.shoppingList).toHaveLength(1)
      const total = result.shoppingList[0].items.reduce((s, i) => s + i.count, 0)
      expect(total).toBe(4)
    })

    it("creates separate shopping list entries for different nominal sizes", () => {
      const group1 = boardGroup({
        boardSpecId: "2x4",
        cuts: [{ length: 48, quantity: 1 }],
      })
      const group2 = boardGroup({
        boardSpecId: "2x6",
        cuts: [{ length: 48, quantity: 1 }],
      })
      const result = generateProjectResult([group1, group2])
      expect(result.shoppingList).toHaveLength(2)
    })

    it("produces a cutListRecap entry for each group", () => {
      const g1 = boardGroup({ cuts: [{ length: 36, quantity: 1 }] })
      const g2 = sheetGroup({ sheetPieces: [{ width: 24, height: 48, quantity: 1 }] })
      const result = generateProjectResult([g1, g2])
      expect(result.cutListRecap).toHaveLength(2)
    })

    it("produces a diagram entry for each group", () => {
      const g1 = boardGroup({ cuts: [{ length: 36, quantity: 1 }] })
      const g2 = sheetGroup()
      const result = generateProjectResult([g1, g2])
      expect(result.diagrams).toHaveLength(2)
    })
  })

  describe("shopping list sort order", () => {
    it("sorts shopping list by NOMINAL_SIZE_ORDER (1x6 before 2x4 before 2x6)", () => {
      const g1 = boardGroup({ boardSpecId: "2x6", cuts: [{ length: 48, quantity: 1 }] })
      const g2 = boardGroup({ boardSpecId: "1x6", cuts: [{ length: 48, quantity: 1 }] })
      const g3 = boardGroup({ boardSpecId: "2x4", cuts: [{ length: 48, quantity: 1 }] })
      const result = generateProjectResult([g1, g2, g3])
      const ids = result.shoppingList.map((e) => e.nominalSizeId)
      expect(ids.indexOf("1x6")).toBeLessThan(ids.indexOf("2x4"))
      expect(ids.indexOf("2x4")).toBeLessThan(ids.indexOf("2x6"))
    })
  })
})
