import type { CutRequirement } from "./cuts"
import type { ScrapBoard } from "./optimizer"
import { STOCK_PROFILES } from "./stock-profiles"

/** Discriminator for material kinds; boards only for now. */
export type MaterialType = "board" | "sheet"

/**
 * A material group: one cut list + optional scrap + board spec (nominal size, max length, kerf).
 * Boards only for now.
 */
export interface MaterialGroup {
  id: string
  /** User-editable label (e.g. "2x4 framing", "2x6 legs"). */
  label: string
  materialType: MaterialType
  /** Id of the board spec (from STOCK_PROFILES) — nominal size, allowed lengths, kerf. */
  boardSpecId: string
  cuts: CutRequirement[]
  scrap: ScrapBoard[]
  /** In-progress cut row; null when not adding. */
  draftCut: { length: string; quantity: string } | null
  /** In-progress scrap row; null when not adding. */
  draftScrap: { length: string; quantity: string } | null
}

let groupCounter = 0

function nextId(): string {
  groupCounter += 1
  return `group-${groupCounter}-${Date.now()}`
}

/** First board spec id for defaults (e.g. "2x4"). */
const DEFAULT_BOARD_SPEC_ID = STOCK_PROFILES[0]?.id ?? "2x4"

/**
 * Create a new board material group with default label and spec.
 */
export function createBoardGroup(overrides?: Partial<Pick<MaterialGroup, "label" | "boardSpecId">>): MaterialGroup {
  return {
    id: nextId(),
    label: overrides?.label ?? "2x4 framing",
    materialType: "board",
    boardSpecId: overrides?.boardSpecId ?? DEFAULT_BOARD_SPEC_ID,
    cuts: [],
    scrap: [],
    draftCut: null,
    draftScrap: null,
  }
}

/** Default first group for initial app state. */
export function createDefaultGroup(): MaterialGroup {
  return createBoardGroup({ label: "2x4 framing" })
}
