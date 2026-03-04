import { describe, it, expect } from "vitest"
import {
  getBoardGroupLabel,
  createBoardGroup,
  createSheetGroup,
  mergeSheetPieces,
} from "../material-groups"

describe("getBoardGroupLabel", () => {
  it("returns framing label for dimensional lumber", () => {
    expect(getBoardGroupLabel("2x4")).toBe("2x4 framing")
    expect(getBoardGroupLabel("2x6")).toBe("2x6 framing")
    expect(getBoardGroupLabel("2x8")).toBe("2x8 framing")
    expect(getBoardGroupLabel("1x6")).toBe("1x6 framing")
  })

  it("returns boards label for hardwood profiles", () => {
    expect(getBoardGroupLabel("4-4-hardwood")).toBe("4/4 boards")
    expect(getBoardGroupLabel("6-4-hardwood")).toBe("6/4 boards")
  })

  it("returns 'Board group' for unknown id", () => {
    expect(getBoardGroupLabel("unknown-id")).toBe("Board group")
    expect(getBoardGroupLabel("")).toBe("Board group")
  })
})

describe("createBoardGroup", () => {
  it("creates a group with correct materialType", () => {
    const group = createBoardGroup()
    expect(group.materialType).toBe("board")
  })

  it("uses default board spec id (first in STOCK_PROFILES)", () => {
    const group = createBoardGroup()
    expect(group.boardSpecId).toBe("2x4")
  })

  it("applies boardSpecId override", () => {
    const group = createBoardGroup({ boardSpecId: "2x6" })
    expect(group.boardSpecId).toBe("2x6")
  })

  it("auto-generates label from boardSpecId when not user-defined", () => {
    const group = createBoardGroup({ boardSpecId: "2x6" })
    expect(group.label).toBe("2x6 framing")
  })

  it("applies explicit label override", () => {
    const group = createBoardGroup({ label: "My custom label" })
    expect(group.label).toBe("My custom label")
  })

  it("sets isLabelUserDefined to false by default", () => {
    const group = createBoardGroup()
    expect(group.isLabelUserDefined).toBe(false)
  })

  it("applies isLabelUserDefined override", () => {
    const group = createBoardGroup({ isLabelUserDefined: true })
    expect(group.isLabelUserDefined).toBe(true)
  })

  it("uses default maxLengthPreferenceInches of 96", () => {
    const group = createBoardGroup()
    expect(group.maxLengthPreferenceInches).toBe(96)
  })

  it("applies maxLengthPreferenceInches override", () => {
    const group = createBoardGroup({ maxLengthPreferenceInches: 120 })
    expect(group.maxLengthPreferenceInches).toBe(120)
  })

  it("starts with empty cuts and no draftCut", () => {
    const group = createBoardGroup()
    expect(group.cuts).toEqual([])
    expect(group.draftCut).toBeNull()
  })

  it("starts with empty sheetPieces and no draftSheetPiece", () => {
    const group = createBoardGroup()
    expect(group.sheetPieces).toEqual([])
    expect(group.draftSheetPiece).toBeNull()
  })

  it("has default sheet stock dimensions", () => {
    const group = createBoardGroup()
    expect(group.sheetStockWidth).toBe(48)
    expect(group.sheetStockHeight).toBe(96)
    expect(group.sheetThickness).toBe('3/4"')
  })

  it("generates a unique id for each group", () => {
    const g1 = createBoardGroup()
    const g2 = createBoardGroup()
    expect(g1.id).not.toBe(g2.id)
    expect(g1.id).toMatch(/^group-/)
  })
})

describe("createSheetGroup", () => {
  it("creates a group with correct materialType", () => {
    const group = createSheetGroup()
    expect(group.materialType).toBe("sheet")
  })

  it("uses default label 'Plywood'", () => {
    const group = createSheetGroup()
    expect(group.label).toBe("Plywood")
  })

  it("applies label override", () => {
    const group = createSheetGroup({ label: "Cabinet panels" })
    expect(group.label).toBe("Cabinet panels")
  })

  it("sets isLabelUserDefined to false by default", () => {
    const group = createSheetGroup()
    expect(group.isLabelUserDefined).toBe(false)
  })

  it("applies isLabelUserDefined override", () => {
    const group = createSheetGroup({ isLabelUserDefined: true })
    expect(group.isLabelUserDefined).toBe(true)
  })

  it("uses default sheet stock dimensions of 48×96", () => {
    const group = createSheetGroup()
    expect(group.sheetStockWidth).toBe(48)
    expect(group.sheetStockHeight).toBe(96)
  })

  it("applies sheetStockWidth/Height overrides", () => {
    const group = createSheetGroup({ sheetStockWidth: 60, sheetStockHeight: 120 })
    expect(group.sheetStockWidth).toBe(60)
    expect(group.sheetStockHeight).toBe(120)
  })

  it("uses default thickness '3/4\"'", () => {
    const group = createSheetGroup()
    expect(group.sheetThickness).toBe('3/4"')
  })

  it("applies sheetThickness override", () => {
    const group = createSheetGroup({ sheetThickness: '1/2"' })
    expect(group.sheetThickness).toBe('1/2"')
  })

  it("starts with empty sheetPieces", () => {
    const group = createSheetGroup()
    expect(group.sheetPieces).toEqual([])
    expect(group.draftSheetPiece).toBeNull()
  })

  it("generates a unique id", () => {
    const g1 = createSheetGroup()
    const g2 = createSheetGroup()
    expect(g1.id).not.toBe(g2.id)
    expect(g1.id).toMatch(/^group-/)
  })
})

describe("mergeSheetPieces", () => {
  it("returns empty array for empty input", () => {
    expect(mergeSheetPieces([])).toEqual([])
  })

  it("deduplicates pieces with same width and height, summing quantities", () => {
    const result = mergeSheetPieces([
      { width: 24, height: 48, quantity: 2 },
      { width: 24, height: 48, quantity: 3 },
    ])
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ width: 24, height: 48, quantity: 5 })
  })

  it("does not merge pieces with different dimensions", () => {
    const result = mergeSheetPieces([
      { width: 24, height: 48, quantity: 1 },
      { width: 24, height: 36, quantity: 1 },
    ])
    expect(result).toHaveLength(2)
  })

  it("sorts by area descending", () => {
    const result = mergeSheetPieces([
      { width: 12, height: 12, quantity: 1 }, // 144
      { width: 24, height: 48, quantity: 1 }, // 1152
      { width: 18, height: 24, quantity: 1 }, // 432
    ])
    const areas = result.map((p) => p.width * p.height)
    expect(areas).toEqual([1152, 432, 144])
  })

  it("skips pieces with zero or negative width", () => {
    const result = mergeSheetPieces([
      { width: 0, height: 48, quantity: 1 },
      { width: -1, height: 48, quantity: 1 },
      { width: 24, height: 48, quantity: 1 },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].width).toBe(24)
  })

  it("skips pieces with zero or negative height", () => {
    const result = mergeSheetPieces([
      { width: 24, height: 0, quantity: 1 },
      { width: 24, height: -5, quantity: 1 },
      { width: 24, height: 48, quantity: 2 },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].quantity).toBe(2)
  })

  it("skips pieces with zero or negative quantity", () => {
    const result = mergeSheetPieces([
      { width: 24, height: 48, quantity: 0 },
      { width: 24, height: 48, quantity: -1 },
      { width: 12, height: 12, quantity: 1 },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].width).toBe(12)
  })

  it("skips pieces with non-integer quantity", () => {
    const result = mergeSheetPieces([
      { width: 24, height: 48, quantity: 1.5 },
      { width: 12, height: 12, quantity: 2 },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].width).toBe(12)
  })
})
