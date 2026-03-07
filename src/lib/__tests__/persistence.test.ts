import { describe, it, expect } from "vitest"
import {
  serializeGroups,
  parseGroupFromUnknown,
  parseGroupsFromJSON,
} from "../persistence"
import { createBoardGroup, createSheetGroup } from "../material-groups"

// ── serializeGroups ───────────────────────────────────────────────────────────

describe("serializeGroups", () => {
  it("returns an array of plain objects", () => {
    const groups = [createBoardGroup()]
    const result = serializeGroups(groups)
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(1)
  })

  it("strips draftCut", () => {
    const group = { ...createBoardGroup(), draftCut: { length: "12", quantity: "1" } }
    const result = serializeGroups([group])
    expect((result[0] as Record<string, unknown>).draftCut).toBeNull()
  })

  it("strips draftSheetPiece", () => {
    const group = {
      ...createSheetGroup(),
      draftSheetPiece: { width: "24", height: "48", quantity: "1" },
    }
    const result = serializeGroups([group])
    expect((result[0] as Record<string, unknown>).draftSheetPiece).toBeNull()
  })

  it("preserves all other fields", () => {
    const group = createBoardGroup({
      boardSpecId: "2x6",
      maxLengthPreferenceInches: 120,
      kerfOverrideInches: 0.09,
      customAllowedLengths: [168],
    })
    const result = serializeGroups([group])[0] as Record<string, unknown>
    expect(result.boardSpecId).toBe("2x6")
    expect(result.maxLengthPreferenceInches).toBe(120)
    expect(result.kerfOverrideInches).toBe(0.09)
    expect(result.customAllowedLengths).toEqual([168])
  })
})

// ── parseGroupFromUnknown ─────────────────────────────────────────────────────

describe("parseGroupFromUnknown", () => {
  it("returns null for non-object inputs", () => {
    expect(parseGroupFromUnknown(null)).toBeNull()
    expect(parseGroupFromUnknown("string")).toBeNull()
    expect(parseGroupFromUnknown(42)).toBeNull()
    expect(parseGroupFromUnknown([])).toBeNull()
  })

  it("returns null when id is missing", () => {
    expect(parseGroupFromUnknown({ label: "test", materialType: "board" })).toBeNull()
  })

  it("returns null when label is missing", () => {
    expect(parseGroupFromUnknown({ id: "g1", materialType: "board" })).toBeNull()
  })

  it("returns null when materialType is invalid", () => {
    expect(parseGroupFromUnknown({ id: "g1", label: "test", materialType: "wood" })).toBeNull()
  })

  it("parses a minimal valid board group", () => {
    const result = parseGroupFromUnknown({
      id: "group-1",
      label: "Test group",
      materialType: "board",
      boardSpecId: "2x4",
    })
    expect(result).not.toBeNull()
    expect(result!.id).toBe("group-1")
    expect(result!.label).toBe("Test group")
    expect(result!.materialType).toBe("board")
    expect(result!.boardSpecId).toBe("2x4")
  })

  it("applies defaults for missing optional fields", () => {
    const result = parseGroupFromUnknown({
      id: "g1",
      label: "test",
      materialType: "board",
    })
    expect(result).not.toBeNull()
    expect(result!.isLabelUserDefined).toBe(false)
    expect(result!.maxLengthPreferenceInches).toBe(96)
    expect(result!.kerfOverrideInches).toBeNull()
    expect(result!.customAllowedLengths).toEqual([])
    expect(result!.cuts).toEqual([])
    expect(result!.sheetPieces).toEqual([])
    expect(result!.draftCut).toBeNull()
    expect(result!.draftSheetPiece).toBeNull()
    expect(result!.sheetStockWidth).toBe(48)
    expect(result!.sheetStockHeight).toBe(96)
    expect(result!.sheetThickness).toBe('3/4"')
  })

  it("preserves kerfOverrideInches when valid", () => {
    const result = parseGroupFromUnknown({
      id: "g1",
      label: "t",
      materialType: "board",
      kerfOverrideInches: 0.09,
    })
    expect(result!.kerfOverrideInches).toBe(0.09)
  })

  it("drops kerfOverrideInches when zero or negative", () => {
    const result = parseGroupFromUnknown({
      id: "g1",
      label: "t",
      materialType: "board",
      kerfOverrideInches: 0,
    })
    expect(result!.kerfOverrideInches).toBeNull()
  })

  it("preserves customAllowedLengths with valid entries", () => {
    const result = parseGroupFromUnknown({
      id: "g1",
      label: "t",
      materialType: "board",
      customAllowedLengths: [168, 204],
    })
    expect(result!.customAllowedLengths).toEqual([168, 204])
  })

  it("filters invalid entries from customAllowedLengths", () => {
    const result = parseGroupFromUnknown({
      id: "g1",
      label: "t",
      materialType: "board",
      customAllowedLengths: [168, -5, 0, "abc", Infinity, null],
    })
    expect(result!.customAllowedLengths).toEqual([168])
  })

  it("parses valid cuts", () => {
    const result = parseGroupFromUnknown({
      id: "g1",
      label: "t",
      materialType: "board",
      cuts: [
        { length: 48, quantity: 2, materialType: "board" },
        { length: 36, quantity: 1 },
      ],
    })
    expect(result!.cuts).toHaveLength(2)
    expect(result!.cuts[0].length).toBe(48)
  })

  it("skips invalid cuts", () => {
    const result = parseGroupFromUnknown({
      id: "g1",
      label: "t",
      materialType: "board",
      cuts: [
        { length: 0, quantity: 1 },
        { length: 48, quantity: 1.5 },
        { length: 36, quantity: 2 },
      ],
    })
    expect(result!.cuts).toHaveLength(1)
    expect(result!.cuts[0].length).toBe(36)
  })

  it("parses valid sheetPieces", () => {
    const result = parseGroupFromUnknown({
      id: "g1",
      label: "t",
      materialType: "sheet",
      sheetPieces: [{ width: 24, height: 48, quantity: 2 }],
    })
    expect(result!.sheetPieces).toHaveLength(1)
    expect(result!.sheetPieces[0].width).toBe(24)
  })

  it("always clears draftCut and draftSheetPiece regardless of stored value", () => {
    const result = parseGroupFromUnknown({
      id: "g1",
      label: "t",
      materialType: "board",
      draftCut: { length: "12", quantity: "1" },
      draftSheetPiece: { width: "24", height: "48", quantity: "1" },
    })
    expect(result!.draftCut).toBeNull()
    expect(result!.draftSheetPiece).toBeNull()
  })

  it("parses a sheet group", () => {
    const result = parseGroupFromUnknown({
      id: "g2",
      label: "Plywood",
      materialType: "sheet",
      sheetStockWidth: 60,
      sheetStockHeight: 120,
      sheetThickness: '1/2"',
    })
    expect(result).not.toBeNull()
    expect(result!.materialType).toBe("sheet")
    expect(result!.sheetStockWidth).toBe(60)
    expect(result!.sheetStockHeight).toBe(120)
    expect(result!.sheetThickness).toBe('1/2"')
  })
})

// ── parseGroupsFromJSON ───────────────────────────────────────────────────────

describe("parseGroupsFromJSON", () => {
  it("returns null for non-array input", () => {
    expect(parseGroupsFromJSON(null)).toBeNull()
    expect(parseGroupsFromJSON({})).toBeNull()
    expect(parseGroupsFromJSON("string")).toBeNull()
  })

  it("returns null for empty array", () => {
    expect(parseGroupsFromJSON([])).toBeNull()
  })

  it("returns null when all entries are invalid", () => {
    expect(parseGroupsFromJSON([null, "bad", 42])).toBeNull()
  })

  it("parses a valid array of groups", () => {
    const serialized = serializeGroups([createBoardGroup(), createSheetGroup()])
    const result = parseGroupsFromJSON(serialized)
    expect(result).not.toBeNull()
    expect(result!).toHaveLength(2)
  })

  it("skips invalid entries and returns valid ones", () => {
    const serialized = serializeGroups([createBoardGroup()])
    const result = parseGroupsFromJSON([...serialized, null, "garbage"])
    expect(result).not.toBeNull()
    expect(result!).toHaveLength(1)
  })

  it("round-trips a board group with all overrides", () => {
    const original = createBoardGroup({
      boardSpecId: "2x6",
      maxLengthPreferenceInches: 120,
      kerfOverrideInches: 0.09,
      customAllowedLengths: [168, 204],
    })
    const serialized = serializeGroups([original])
    const result = parseGroupsFromJSON(serialized)!
    expect(result[0].boardSpecId).toBe("2x6")
    expect(result[0].maxLengthPreferenceInches).toBe(120)
    expect(result[0].kerfOverrideInches).toBe(0.09)
    expect(result[0].customAllowedLengths).toEqual([168, 204])
  })
})
