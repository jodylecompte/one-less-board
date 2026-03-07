import { isValidLength, isValidQuantity, type CutRequirement } from "./cuts"
import {
  DEFAULT_MAX_BOARD_LENGTH_INCHES,
  STOCK_PROFILES,
} from "./stock-profiles"
import type { MaterialGroup, SheetPiece } from "./material-groups"

export const GROUPS_STORAGE_KEY = "cut-optimizer-groups"

/** Serialize groups for storage or export. Strips transient draft state. */
export function serializeGroups(groups: MaterialGroup[]): object[] {
  return groups.map((g) => ({ ...g, draftCut: null, draftSheetPiece: null }))
}

/**
 * Parse one unknown value as a MaterialGroup.
 * Applies defaults for any missing or invalid fields so that data saved before
 * new fields were added continues to load correctly.
 * Returns null if the value is not recoverable as a group.
 */
export function parseGroupFromUnknown(raw: unknown): MaterialGroup | null {
  if (typeof raw !== "object" || raw === null) return null
  const obj = raw as Record<string, unknown>

  const id = typeof obj.id === "string" && obj.id ? obj.id : null
  const label = typeof obj.label === "string" ? obj.label : null
  const materialType =
    obj.materialType === "board" || obj.materialType === "sheet"
      ? obj.materialType
      : null

  if (!id || label === null || !materialType) return null

  const boardSpecId =
    typeof obj.boardSpecId === "string" && obj.boardSpecId
      ? obj.boardSpecId
      : (STOCK_PROFILES[0]?.id ?? "2x4")

  const isLabelUserDefined =
    typeof obj.isLabelUserDefined === "boolean" ? obj.isLabelUserDefined : false

  const maxLengthPreferenceInches =
    typeof obj.maxLengthPreferenceInches === "number" &&
    obj.maxLengthPreferenceInches > 0
      ? obj.maxLengthPreferenceInches
      : DEFAULT_MAX_BOARD_LENGTH_INCHES

  const kerfOverrideInches =
    typeof obj.kerfOverrideInches === "number" && obj.kerfOverrideInches > 0
      ? obj.kerfOverrideInches
      : null

  const customAllowedLengths = Array.isArray(obj.customAllowedLengths)
    ? obj.customAllowedLengths.filter(
        (l): l is number =>
          typeof l === "number" && Number.isFinite(l) && l > 0
      )
    : []

  const cuts: CutRequirement[] = Array.isArray(obj.cuts)
    ? obj.cuts.flatMap((c): CutRequirement[] => {
        if (typeof c !== "object" || c === null) return []
        const cut = c as Record<string, unknown>
        if (
          !isValidLength(cut.length) ||
          !isValidQuantity(cut.quantity)
        )
          return []
        const mt =
          cut.materialType === "sheet" ? ("sheet" as const) : ("board" as const)
        return [
          {
            length: cut.length as number,
            quantity: cut.quantity as number,
            materialType: mt,
          },
        ]
      })
    : []

  const sheetPieces: SheetPiece[] = Array.isArray(obj.sheetPieces)
    ? obj.sheetPieces.flatMap((p): SheetPiece[] => {
        if (typeof p !== "object" || p === null) return []
        const piece = p as Record<string, unknown>
        if (typeof piece.width !== "number" || piece.width <= 0) return []
        if (typeof piece.height !== "number" || piece.height <= 0) return []
        if (
          typeof piece.quantity !== "number" ||
          !Number.isInteger(piece.quantity) ||
          piece.quantity <= 0
        )
          return []
        return [
          {
            width: piece.width,
            height: piece.height,
            quantity: piece.quantity,
          },
        ]
      })
    : []

  const sheetStockWidth =
    typeof obj.sheetStockWidth === "number" && obj.sheetStockWidth > 0
      ? obj.sheetStockWidth
      : 48
  const sheetStockHeight =
    typeof obj.sheetStockHeight === "number" && obj.sheetStockHeight > 0
      ? obj.sheetStockHeight
      : 96
  const sheetThickness =
    typeof obj.sheetThickness === "string" && obj.sheetThickness
      ? obj.sheetThickness
      : '3/4"'

  return {
    id,
    label,
    isLabelUserDefined,
    materialType,
    boardSpecId,
    maxLengthPreferenceInches,
    kerfOverrideInches,
    customAllowedLengths,
    cuts,
    draftCut: null,
    sheetPieces,
    draftSheetPiece: null,
    sheetStockWidth,
    sheetStockHeight,
    sheetThickness,
  }
}

/**
 * Parse a JSON-decoded value (from storage or file import) as an array of MaterialGroups.
 * Returns null if the value cannot be parsed into at least one valid group.
 */
export function parseGroupsFromJSON(data: unknown): MaterialGroup[] | null {
  if (!Array.isArray(data) || data.length === 0) return null
  const groups = data
    .map(parseGroupFromUnknown)
    .filter((g): g is MaterialGroup => g !== null)
  return groups.length > 0 ? groups : null
}

/** Persist groups to localStorage. Silently ignores storage errors. */
export function saveGroupsToStorage(groups: MaterialGroup[]): void {
  try {
    localStorage.setItem(
      GROUPS_STORAGE_KEY,
      JSON.stringify(serializeGroups(groups))
    )
  } catch {
    // ignore quota / security errors
  }
}

/** Load groups from localStorage. Returns null if nothing is stored or data is invalid. */
export function loadGroupsFromStorage(): MaterialGroup[] | null {
  try {
    const raw = localStorage.getItem(GROUPS_STORAGE_KEY)
    if (!raw) return null
    return parseGroupsFromJSON(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}
