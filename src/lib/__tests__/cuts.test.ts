import { describe, it, expect } from "vitest"
import {
  isValidLength,
  isValidQuantity,
  parseLength,
  parseQuantity,
  normalizeMaterialType,
  mergeCuts,
  getCutsForMaterial,
} from "../cuts"

describe("isValidLength", () => {
  it("accepts positive finite numbers", () => {
    expect(isValidLength(1)).toBe(true)
    expect(isValidLength(96)).toBe(true)
    expect(isValidLength(0.5)).toBe(true)
  })

  it("rejects zero", () => {
    expect(isValidLength(0)).toBe(false)
  })

  it("rejects negative numbers", () => {
    expect(isValidLength(-1)).toBe(false)
    expect(isValidLength(-0.001)).toBe(false)
  })

  it("rejects Infinity", () => {
    expect(isValidLength(Infinity)).toBe(false)
    expect(isValidLength(-Infinity)).toBe(false)
  })

  it("rejects NaN", () => {
    expect(isValidLength(NaN)).toBe(false)
  })

  it("rejects non-numbers", () => {
    expect(isValidLength("96")).toBe(false)
    expect(isValidLength(null)).toBe(false)
    expect(isValidLength(undefined)).toBe(false)
    expect(isValidLength({})).toBe(false)
  })
})

describe("isValidQuantity", () => {
  it("accepts positive integers", () => {
    expect(isValidQuantity(1)).toBe(true)
    expect(isValidQuantity(10)).toBe(true)
    expect(isValidQuantity(100)).toBe(true)
  })

  it("rejects floats", () => {
    expect(isValidQuantity(1.5)).toBe(false)
    expect(isValidQuantity(0.9)).toBe(false)
  })

  it("rejects zero", () => {
    expect(isValidQuantity(0)).toBe(false)
  })

  it("rejects negative numbers", () => {
    expect(isValidQuantity(-1)).toBe(false)
    expect(isValidQuantity(-3)).toBe(false)
  })

  it("rejects NaN", () => {
    expect(isValidQuantity(NaN)).toBe(false)
  })

  it("rejects Infinity", () => {
    expect(isValidQuantity(Infinity)).toBe(false)
  })

  it("rejects non-numbers", () => {
    expect(isValidQuantity("2")).toBe(false)
    expect(isValidQuantity(null)).toBe(false)
    expect(isValidQuantity(undefined)).toBe(false)
  })
})

describe("parseLength", () => {
  it("parses valid float strings", () => {
    expect(parseLength("96")).toBe(96)
    expect(parseLength("48.5")).toBe(48.5)
    expect(parseLength("0.125")).toBe(0.125)
  })

  it("trims whitespace", () => {
    expect(parseLength("  96  ")).toBe(96)
    expect(parseLength(" 48.5 ")).toBe(48.5)
  })

  it("returns NaN for non-numeric strings", () => {
    expect(parseLength("abc")).toBeNaN()
    expect(parseLength("")).toBeNaN()
  })

  // Fraction support
  it("parses simple fractions", () => {
    expect(parseLength("1/2")).toBeCloseTo(0.5)
    expect(parseLength("3/4")).toBeCloseTo(0.75)
    expect(parseLength("1/4")).toBeCloseTo(0.25)
    expect(parseLength("3/8")).toBeCloseTo(0.375)
  })

  it("parses mixed numbers with space separator", () => {
    expect(parseLength("3 1/2")).toBeCloseTo(3.5)
    expect(parseLength("47 3/4")).toBeCloseTo(47.75)
    expect(parseLength("12 1/4")).toBeCloseTo(12.25)
  })

  it("parses mixed numbers with hyphen separator", () => {
    expect(parseLength("3-1/2")).toBeCloseTo(3.5)
    expect(parseLength("47-3/4")).toBeCloseTo(47.75)
  })

  it("trims whitespace around fraction expressions", () => {
    expect(parseLength("  3 1/2  ")).toBeCloseTo(3.5)
    expect(parseLength("  1/2  ")).toBeCloseTo(0.5)
  })

  it("returns NaN for division by zero", () => {
    expect(parseLength("1/0")).toBeNaN()
    expect(parseLength("3 1/0")).toBeNaN()
  })

  it("returns NaN for empty string", () => {
    expect(parseLength("")).toBeNaN()
  })
})

describe("parseQuantity", () => {
  it("parses valid integer strings", () => {
    expect(parseQuantity("1")).toBe(1)
    expect(parseQuantity("10")).toBe(10)
    expect(parseQuantity("100")).toBe(100)
  })

  it("trims whitespace", () => {
    expect(parseQuantity("  5  ")).toBe(5)
  })

  it("returns NaN for non-numeric strings", () => {
    expect(parseQuantity("abc")).toBeNaN()
    expect(parseQuantity("")).toBeNaN()
  })

  it("truncates floats (parseInt behavior)", () => {
    expect(parseQuantity("3.9")).toBe(3)
  })
})

describe("normalizeMaterialType", () => {
  it("fills in default 'board' when materialType is missing", () => {
    const result = normalizeMaterialType({ length: 48, quantity: 2 })
    expect(result.materialType).toBe("board")
  })

  it("preserves explicit 'board'", () => {
    const result = normalizeMaterialType({ length: 48, quantity: 2, materialType: "board" })
    expect(result.materialType).toBe("board")
  })

  it("preserves explicit 'sheet'", () => {
    const result = normalizeMaterialType({ length: 48, quantity: 2, materialType: "sheet" })
    expect(result.materialType).toBe("sheet")
  })

  it("preserves other cut fields", () => {
    const result = normalizeMaterialType({ length: 36, quantity: 3 })
    expect(result.length).toBe(36)
    expect(result.quantity).toBe(3)
  })
})

describe("mergeCuts", () => {
  it("returns empty array for empty input", () => {
    expect(mergeCuts([])).toEqual([])
  })

  it("deduplicates cuts with same length and materialType, summing quantities", () => {
    const result = mergeCuts([
      { length: 48, quantity: 2, materialType: "board" },
      { length: 48, quantity: 3, materialType: "board" },
    ])
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ length: 48, quantity: 5, materialType: "board" })
  })

  it("does not merge cuts with different lengths", () => {
    const result = mergeCuts([
      { length: 48, quantity: 2, materialType: "board" },
      { length: 36, quantity: 1, materialType: "board" },
    ])
    expect(result).toHaveLength(2)
  })

  it("does not merge cuts with different materialTypes", () => {
    const result = mergeCuts([
      { length: 48, quantity: 2, materialType: "board" },
      { length: 48, quantity: 1, materialType: "sheet" },
    ])
    expect(result).toHaveLength(2)
  })

  it("sorts by length descending", () => {
    const result = mergeCuts([
      { length: 24, quantity: 1 },
      { length: 72, quantity: 1 },
      { length: 48, quantity: 1 },
    ])
    expect(result.map((c) => c.length)).toEqual([72, 48, 24])
  })

  it("skips cuts with invalid length", () => {
    const result = mergeCuts([
      { length: -1, quantity: 1 },
      { length: 0, quantity: 1 },
      { length: NaN, quantity: 1 },
      { length: Infinity, quantity: 1 },
      { length: 48, quantity: 1 },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].length).toBe(48)
  })

  it("skips cuts with invalid quantity", () => {
    const result = mergeCuts([
      { length: 48, quantity: 0 },
      { length: 48, quantity: -1 },
      { length: 48, quantity: 1.5 },
      { length: 36, quantity: 2 },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].length).toBe(36)
  })

  it("defaults missing materialType to 'board'", () => {
    const result = mergeCuts([
      { length: 48, quantity: 2 },
      { length: 48, quantity: 3 },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].quantity).toBe(5)
    expect(result[0].materialType).toBe("board")
  })
})

describe("getCutsForMaterial", () => {
  it("filters cuts by materialType 'board'", () => {
    const cuts = [
      { length: 48, quantity: 2, materialType: "board" as const },
      { length: 24, quantity: 1, materialType: "sheet" as const },
    ]
    const result = getCutsForMaterial(cuts, "board")
    expect(result).toHaveLength(1)
    expect(result[0].length).toBe(48)
  })

  it("filters cuts by materialType 'sheet'", () => {
    const cuts = [
      { length: 48, quantity: 2, materialType: "board" as const },
      { length: 24, quantity: 1, materialType: "sheet" as const },
    ]
    const result = getCutsForMaterial(cuts, "sheet")
    expect(result).toHaveLength(1)
    expect(result[0].length).toBe(24)
  })

  it("defaults missing materialType to 'board'", () => {
    const cuts = [
      { length: 48, quantity: 2 },
      { length: 24, quantity: 1, materialType: "sheet" as const },
    ]
    const result = getCutsForMaterial(cuts, "board")
    expect(result).toHaveLength(1)
    expect(result[0].length).toBe(48)
  })

  it("returns empty array if no cuts match", () => {
    const cuts = [{ length: 48, quantity: 2, materialType: "board" as const }]
    const result = getCutsForMaterial(cuts, "sheet")
    expect(result).toHaveLength(0)
  })

  it("returns empty array for empty input", () => {
    expect(getCutsForMaterial([], "board")).toEqual([])
  })
})
