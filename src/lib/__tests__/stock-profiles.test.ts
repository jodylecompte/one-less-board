import { describe, it, expect } from "vitest"
import {
  formatStockLength,
  shortNominalName,
  STOCK_PROFILES,
} from "../stock-profiles"

describe("formatStockLength", () => {
  it("formats 96 inches as 8 ft", () => {
    expect(formatStockLength(96)).toBe("8 ft")
  })

  it("formats 120 inches as 10 ft", () => {
    expect(formatStockLength(120)).toBe("10 ft")
  })

  it("formats 144 inches as 12 ft", () => {
    expect(formatStockLength(144)).toBe("12 ft")
  })

  it("formats 192 inches as 16 ft", () => {
    expect(formatStockLength(192)).toBe("16 ft")
  })

  it("formats non-integer feet as inches string", () => {
    // 97 / 12 = 8.083... → not integer → "97\""
    expect(formatStockLength(97)).toBe('97"')
  })

  it("formats 60 inches as 5 ft", () => {
    expect(formatStockLength(60)).toBe("5 ft")
  })
})

describe("shortNominalName", () => {
  it("strips ' dimensional' suffix", () => {
    expect(shortNominalName("2×4 dimensional")).toBe("2×4")
  })

  it("strips ' hardwood' suffix", () => {
    expect(shortNominalName("4/4 hardwood")).toBe("4/4")
  })

  it("strips case-insensitively", () => {
    expect(shortNominalName("2×4 Dimensional")).toBe("2×4")
    expect(shortNominalName("4/4 Hardwood")).toBe("4/4")
  })

  it("returns unchanged string if no suffix", () => {
    expect(shortNominalName("2×4")).toBe("2×4")
    expect(shortNominalName("custom profile")).toBe("custom profile")
  })

  it("trims whitespace", () => {
    expect(shortNominalName("  2×4 dimensional  ")).toBe("2×4")
  })

  it("falls back to full name if result would be empty string", () => {
    // Replacing all content with suffix → falls back to original
    expect(shortNominalName("dimensional")).toBe("dimensional")
    expect(shortNominalName("hardwood")).toBe("hardwood")
  })
})

describe("STOCK_PROFILES shape", () => {
  it("every profile has an id string", () => {
    for (const p of STOCK_PROFILES) {
      expect(typeof p.id).toBe("string")
      expect(p.id.length).toBeGreaterThan(0)
    }
  })

  it("every profile has a name string", () => {
    for (const p of STOCK_PROFILES) {
      expect(typeof p.name).toBe("string")
      expect(p.name.length).toBeGreaterThan(0)
    }
  })

  it("every profile has a non-empty allowedLengths array", () => {
    for (const p of STOCK_PROFILES) {
      expect(Array.isArray(p.allowedLengths)).toBe(true)
      expect(p.allowedLengths.length).toBeGreaterThan(0)
    }
  })

  it("every profile has kerf > 0", () => {
    for (const p of STOCK_PROFILES) {
      expect(p.kerf).toBeGreaterThan(0)
    }
  })

  it("every profile has materialType === 'board'", () => {
    for (const p of STOCK_PROFILES) {
      expect(p.materialType).toBe("board")
    }
  })

  it("all allowedLengths are positive numbers", () => {
    for (const p of STOCK_PROFILES) {
      for (const len of p.allowedLengths) {
        expect(len).toBeGreaterThan(0)
        expect(Number.isFinite(len)).toBe(true)
      }
    }
  })

  it("contains all expected profiles", () => {
    const ids = STOCK_PROFILES.map((p) => p.id)
    // 1x series
    expect(ids).toContain("1x4")
    expect(ids).toContain("1x6")
    expect(ids).toContain("1x8")
    expect(ids).toContain("1x12")
    // 2x series
    expect(ids).toContain("2x4")
    expect(ids).toContain("2x6")
    expect(ids).toContain("2x8")
    expect(ids).toContain("2x10")
    expect(ids).toContain("2x12")
    // specialty
    expect(ids).toContain("5-4-decking")
    expect(ids).toContain("4-4-hardwood")
    expect(ids).toContain("6-4-hardwood")
  })

  it("all ids are unique", () => {
    const ids = STOCK_PROFILES.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
