import { useState, useEffect, useRef } from "react"
import * as Select from "@radix-ui/react-select"
import {
  mergeCuts,
  isValidLength,
  isValidQuantity,
  parseLength,
  parseQuantity,
  type CutRequirement,
} from "./lib/cuts"
import {
  STOCK_PROFILES,
  formatStockLength,
  shortNominalName,
  DEFAULT_KERF_INCHES,
  DEFAULT_MAX_BOARD_LENGTH_INCHES,
  BOARD_LENGTH_PREFERENCE_OPTIONS,
} from "./lib/stock-profiles"
import {
  mergeScrapBoards,
  type OptimizedBoard,
  type ScrapBoard,
} from "./lib/optimizer"

const SCRAP_STORAGE_KEY = "cut-optimizer-scrap"

function loadScrapFromStorage(): ScrapBoard[] {
  try {
    const raw = localStorage.getItem(SCRAP_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (x): x is ScrapBoard =>
        typeof x === "object" &&
        x !== null &&
        typeof (x as ScrapBoard).stockLength === "number" &&
        typeof (x as ScrapBoard).quantity === "number"
    )
  } catch {
    return []
  }
}

function saveScrapToStorage(scrap: ScrapBoard[]) {
  try {
    localStorage.setItem(SCRAP_STORAGE_KEY, JSON.stringify(scrap))
  } catch {
    // ignore
  }
}
import {
  createBoardGroup,
  createSheetGroup,
  createDefaultGroup,
  mergeSheetPieces,
  type MaterialGroup,
} from "./lib/material-groups"
import { generateProjectResult, type ProjectResult } from "./lib/project-result"

function App() {
  const [groups, setGroups] = useState<MaterialGroup[]>(() => [createDefaultGroup()])
  const [projectResult, setProjectResult] = useState<ProjectResult | null>(null)
  const [scrapBoards, setScrapBoardsState] = useState<ScrapBoard[]>(() => loadScrapFromStorage())
  const [useScrapWhenGenerating, setUseScrapWhenGenerating] = useState(true)
  const [scrapModalOpen, setScrapModalOpen] = useState(false)

  const setScrapBoards = (next: ScrapBoard[] | ((prev: ScrapBoard[]) => ScrapBoard[])) => {
    setScrapBoardsState((prev) => {
      const value = typeof next === "function" ? next(prev) : next
      saveScrapToStorage(value)
      return value
    })
  }

  const updateGroup = (id: string, updater: (g: MaterialGroup) => MaterialGroup) => {
    setGroups((prev) => prev.map((g) => (g.id === id ? updater(g) : g)))
  }

  const addMaterialGroup = () => {
    setGroups((prev) => [...prev, createBoardGroup({ label: "New group" })])
  }

  const removeGroup = (id: string) => {
    setGroups((prev) => (prev.length <= 1 ? prev : prev.filter((g) => g.id !== id)))
  }

  useEffect(() => {
    const toCommit = groups.find(
      (g) =>
        g.draftCut &&
        isValidLength(parseLength(g.draftCut.length)) &&
        isValidQuantity(parseQuantity(g.draftCut.quantity))
    )
    if (!toCommit?.draftCut) return
    const len = parseLength(toCommit.draftCut.length)
    const qty = parseQuantity(toCommit.draftCut.quantity)
    setGroups((prev) =>
      prev.map((g) =>
        g.id === toCommit.id
          ? {
              ...g,
              cuts: mergeCuts([...g.cuts, { length: len, quantity: qty, materialType: "board" }]),
              draftCut: null,
            }
          : g
      )
    )
  }, [groups])

  useEffect(() => {
    const toCommit = groups.find(
      (g) =>
        g.materialType === "sheet" &&
        g.draftSheetPiece &&
        isValidLength(parseLength(g.draftSheetPiece.width)) &&
        isValidLength(parseLength(g.draftSheetPiece.height)) &&
        isValidQuantity(parseQuantity(g.draftSheetPiece.quantity))
    )
    if (!toCommit?.draftSheetPiece) return
    const w = parseLength(toCommit.draftSheetPiece.width)
    const h = parseLength(toCommit.draftSheetPiece.height)
    const qty = parseQuantity(toCommit.draftSheetPiece.quantity)
    setGroups((prev) =>
      prev.map((g) =>
        g.id === toCommit.id
          ? {
              ...g,
              sheetPieces: mergeSheetPieces([...g.sheetPieces, { width: w, height: h, quantity: qty }]),
              draftSheetPiece: null,
            }
          : g
      )
    )
  }, [groups])

  const hasBoardContent = groups.some(
    (g) => g.materialType === "board" && g.cuts.length > 0
  )
  const hasSheetContent = groups.some(
    (g) => g.materialType === "sheet" && g.sheetPieces.length > 0
  )
  const everyBoardGroupWithCutsHasSpec = groups
    .filter((g) => g.materialType === "board" && g.cuts.length > 0)
    .every(
      (g) =>
        g.boardSpecId && STOCK_PROFILES.some((p) => p.id === g.boardSpecId)
    )
  const canGenerate =
    (hasBoardContent || hasSheetContent) && everyBoardGroupWithCutsHasSpec

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 py-6 px-4 sm:p-6 lg:py-8 lg:px-8 print:bg-white print:py-0 print:px-0 overflow-x-hidden">
      <div className="w-full mx-auto transition-all duration-200 print:max-w-none print:safe-inset print:grid-cols-1 lg:max-w-[1920px] lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-x-10 lg:items-start">
        {/* Left: inputs (desktop-first: first in DOM for single-column stack on small) */}
        <div className="space-y-6 print:hidden lg:space-y-8">
          <header className="text-center lg:text-left lg:pt-1 space-y-3">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100">
                Cut List Optimizer
              </h1>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1">
                Cross-cut optimization for lumber
              </p>
            </div>
            <button
              type="button"
              onClick={() => setScrapModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-700/60 px-3 py-2.5 min-h-[44px] text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600/60 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <line x1="10" y1="9" x2="8" y2="9" />
              </svg>
              Scrap inventory
              {scrapBoards.length > 0 && (
                <span className="rounded-full bg-slate-300 dark:bg-slate-600 px-1.5 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-200">
                  {scrapBoards.reduce((s, b) => s + b.quantity, 0)}
                </span>
              )}
            </button>
          </header>

          <div className="space-y-6 lg:space-y-8">
            {groups.map((group) => (
              <MaterialGroupSection
                key={group.id}
                group={group}
                onUpdateGroup={(updater) => updateGroup(group.id, updater)}
                onRemove={() => removeGroup(group.id)}
                canRemove={groups.length > 1}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={addMaterialGroup}
            className="inline-flex w-full lg:w-auto items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-800/80 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900 print:hidden"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3v10M3 8h10" />
            </svg>
            Add material group
          </button>

          <div className="pt-2 space-y-3">
            <label className="print:hidden flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useScrapWhenGenerating}
                onChange={(e) => setUseScrapWhenGenerating(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Use scrap inventory when generating (optional)
              </span>
            </label>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {canGenerate
                ? `Boards: ${DEFAULT_KERF_INCHES}" kerf (1/8″) per cut. Max length from selected profile (e.g. ${DEFAULT_MAX_BOARD_LENGTH_INCHES / 12} ft). Plywood: list only (solver coming soon).`
                : "Add at least one cut (boards) or piece (plywood) and select a board spec for each board group to generate."}
            </p>
            <button
              type="button"
              onClick={() =>
                setProjectResult(
                  generateProjectResult(groups, {
                    scrap: useScrapWhenGenerating ? scrapBoards : [],
                  })
                )
              }
              disabled={!canGenerate}
              className="w-full lg:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-3.5 min-h-[48px] text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-600 touch-manipulation"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <line x1="10" y1="9" x2="8" y2="9" />
              </svg>
              Generate plan
            </button>
          </div>
        </div>

        {/* Right: results (or placeholder). On print, results flow in single column. */}
        <div className="mt-8 lg:mt-0 print:mt-0">
          {projectResult ? (
            <UnifiedResultsView result={projectResult} />
          ) : (
            <div className="print:hidden rounded-xl bg-slate-50 dark:bg-slate-800/40 py-12 px-6 lg:py-16 lg:px-8 text-center">
              <p className="text-slate-600 dark:text-slate-400 text-sm lg:text-base">
                Generate a plan to see your shopping list, cut recap, and diagrams here.
              </p>
            </div>
          )}
        </div>

        {scrapModalOpen && (
          <ScrapInventoryModal
            scrapBoards={scrapBoards}
            setScrapBoards={setScrapBoards}
            onClose={() => setScrapModalOpen(false)}
            formatStockLength={formatStockLength}
          />
        )}
      </div>
    </div>
  )
}

function ScrapInventoryModal({
  scrapBoards,
  setScrapBoards,
  onClose,
  formatStockLength,
}: {
  scrapBoards: ScrapBoard[]
  setScrapBoards: (next: ScrapBoard[] | ((prev: ScrapBoard[]) => ScrapBoard[])) => void
  onClose: () => void
  formatStockLength: (inches: number) => string
}) {
  const [draft, setDraft] = useState<{ length: string; quantity: string } | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  const addDraft = () => {
    if (!draft) return
    const len = parseLength(draft.length)
    const qty = parseQuantity(draft.quantity)
    if (!isValidLength(len) || !isValidQuantity(qty)) return
    setScrapBoards((prev) => mergeScrapBoards([...prev, { stockLength: len, quantity: qty }]))
    setDraft(null)
  }

  const removeScrap = (stockLength: number) => {
    setScrapBoards((prev) => prev.filter((s) => s.stockLength !== stockLength))
  }

  const updateQuantity = (stockLength: number, newQuantity: number) => {
    if (newQuantity < 1) {
      setScrapBoards((prev) => prev.filter((s) => s.stockLength !== stockLength))
      return
    }
    if (!Number.isInteger(newQuantity)) return
    setScrapBoards((prev) =>
      prev.map((s) =>
        s.stockLength === stockLength ? { ...s, quantity: newQuantity } : s
      )
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scrap-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-800 shadow-xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 p-5 border-b border-slate-200 dark:border-slate-600">
          <div>
            <h2 id="scrap-modal-title" className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Scrap inventory
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Optional. Boards you have on hand. Used when generating if &quot;Use scrap inventory&quot; is on. Saved in this browser.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <div>
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Boards (by length)</h3>
            <div className="rounded-lg overflow-hidden bg-slate-50/80 dark:bg-slate-700/30">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-100/80 dark:bg-slate-700/40">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-300">Length</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-300">Qty</th>
                    <th className="w-12" aria-hidden />
                  </tr>
                </thead>
                <tbody>
                  {scrapBoards.length === 0 && !draft ? (
                    <tr>
                      <td colSpan={3} className="py-8 px-4 text-center text-sm text-slate-500 dark:text-slate-400">
                        No scrap. Add lengths you have on hand.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {scrapBoards.map((s) => (
                        <tr
                          key={s.stockLength}
                          className="bg-white/50 dark:bg-slate-800/30 even:bg-transparent dark:even:bg-slate-800/20"
                        >
                          <td className="py-2 px-4 text-slate-900 dark:text-slate-100 font-medium">
                            {formatStockLength(s.stockLength)}
                          </td>
                          <td className="py-2 px-4">
                            <input
                              type="number"
                              min={1}
                              value={s.quantity}
                              onChange={(e) => updateQuantity(s.stockLength, parseInt(e.target.value, 10) || 0)}
                              className="w-16 rounded bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
                              aria-label={`Quantity for ${formatStockLength(s.stockLength)}`}
                            />
                          </td>
                          <td className="py-2 px-2">
                            <button
                              type="button"
                              onClick={() => removeScrap(s.stockLength)}
                              className="p-1.5 rounded text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                              aria-label={`Remove ${formatStockLength(s.stockLength)}`}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                      {draft && (
                        <tr className="bg-slate-50/80 dark:bg-slate-700/30">
                          <td className="py-2 px-4">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="e.g. 96"
                              value={draft.length}
                              onChange={(e) => setDraft((d) => (d ? { ...d, length: e.target.value } : null))}
                              className="w-full max-w-[6rem] rounded bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                              aria-label="Length (inches)"
                              autoFocus
                            />
                          </td>
                          <td className="py-2 px-4">
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="1"
                              value={draft.quantity}
                              onChange={(e) =>
                                setDraft((d) =>
                                  d ? { ...d, quantity: e.target.value.replace(/\D/g, "") } : null
                                )
                              }
                              className="w-full max-w-[4rem] rounded bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                              aria-label="Quantity"
                            />
                          </td>
                          <td className="py-2 px-2 flex gap-1">
                            <button
                              type="button"
                              onClick={addDraft}
                              disabled={
                                !isValidLength(parseLength(draft.length)) ||
                                !isValidQuantity(parseQuantity(draft.quantity))
                              }
                              className="p-1.5 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                              aria-label="Add"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 5v14M5 12h14" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDraft(null)}
                              className="p-1.5 rounded text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600"
                              aria-label="Cancel"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 6L6 18M6 6l12 12" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {!draft ? (
                <button
                  type="button"
                  onClick={() => setDraft({ length: "", quantity: "" })}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-700/60 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600/60"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3v10M3 8h10" />
                  </svg>
                  Add board
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-700/60 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600/60"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MaterialGroupSection({
  group,
  onUpdateGroup,
  onRemove,
  canRemove,
}: {
  group: MaterialGroup
  onUpdateGroup: (updater: (g: MaterialGroup) => MaterialGroup) => void
  onRemove: () => void
  canRemove: boolean
}) {
  const setMaterialType = (materialType: "board" | "sheet") => {
    if (group.materialType === materialType) return
    if (materialType === "sheet") {
      onUpdateGroup((g) => ({
        ...createSheetGroup({ label: g.label }),
        id: g.id,
      }))
    } else {
      onUpdateGroup((g) => ({
        ...createBoardGroup({ label: g.label }),
        id: g.id,
      }))
    }
  }

  return (
    <section
      className={`rounded-xl bg-white dark:bg-slate-800/70 overflow-hidden shadow-sm ${
        group.materialType === "board"
          ? "border-l-4 border-l-amber-400/60 dark:border-l-amber-500/50"
          : "border-l-4 border-l-sky-400/60 dark:border-l-sky-500/50"
      }`}
    >
      {/* Section header: material type + label + remove */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <div
              className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-700/50 p-0.5"
              role="tablist"
              aria-label="Material type"
            >
              <button
                type="button"
                role="tab"
                aria-selected={group.materialType === "board"}
                onClick={() => setMaterialType("board")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  group.materialType === "board"
                    ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                Board
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={group.materialType === "sheet"}
                onClick={() => setMaterialType("sheet")}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  group.materialType === "sheet"
                    ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                Plywood
              </button>
            </div>
            <input
              type="text"
              value={group.label}
              onChange={(e) => onUpdateGroup((g) => ({ ...g, label: e.target.value }))}
              className="bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-500 focus:border-slate-400 dark:focus:border-slate-400 focus:outline-none px-1 py-0.5 text-lg font-semibold text-slate-800 dark:text-slate-200 min-w-[8rem]"
              aria-label="Group label"
            />
          </div>
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="p-1.5 rounded text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              aria-label="Remove material group"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Subtle separator */}
      <div className="border-t border-slate-200/80 dark:border-slate-600/50" aria-hidden />

      {/* Section content */}
      <div className="p-5 space-y-6">
        {group.materialType === "board" ? (
          <>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-4">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Board spec (nominal size)
                </label>
                <Select.Root
                  value={group.boardSpecId || undefined}
                  onValueChange={(id) => onUpdateGroup((g) => ({ ...g, boardSpecId: id }))}
                >
                  <Select.Trigger className="inline-flex w-full max-w-xs items-center justify-between gap-2 rounded-lg bg-slate-100 dark:bg-slate-700/60 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500">
                    <Select.Value placeholder="Choose profile..." />
                    <Select.Icon>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content position="popper" sideOffset={4} className="rounded-lg bg-white dark:bg-slate-800 shadow-lg">
                      {STOCK_PROFILES.map((profile) => (
                        <Select.Item key={profile.id} value={profile.id} className="rounded-md px-3 py-2 text-sm outline-none hover:bg-slate-100 dark:hover:bg-slate-700 data-[highlighted]:bg-slate-100 dark:data-[highlighted]:bg-slate-700">
                          <Select.ItemText>{profile.name}</Select.ItemText>
                          <Select.ItemIndicator className="absolute right-3">✓</Select.ItemIndicator>
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Portal>
                </Select.Root>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sets allowed lengths and kerf (default 1/8″). Required to generate.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Max length preference
              </label>
              <Select.Root
                value={String(group.maxLengthPreferenceInches ?? DEFAULT_MAX_BOARD_LENGTH_INCHES)}
                onValueChange={(v) =>
                  onUpdateGroup((g) => ({ ...g, maxLengthPreferenceInches: parseInt(v, 10) }))
                }
              >
                <Select.Trigger className="inline-flex w-full max-w-xs items-center justify-between gap-2 rounded-lg bg-slate-100 dark:bg-slate-700/60 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500">
                  <Select.Value />
                  <Select.Icon>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content position="popper" sideOffset={4} className="rounded-lg bg-white dark:bg-slate-800 shadow-lg">
                    {BOARD_LENGTH_PREFERENCE_OPTIONS.map(({ feet, inches }) => (
                      <Select.Item
                        key={inches}
                        value={String(inches)}
                        className="rounded-md px-3 py-2 text-sm outline-none hover:bg-slate-100 dark:hover:bg-slate-700 data-[highlighted]:bg-slate-100 dark:data-[highlighted]:bg-slate-700"
                      >
                        <Select.ItemText>{feet} ft</Select.ItemText>
                        <Select.ItemIndicator className="absolute right-3">✓</Select.ItemIndicator>
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Max length is a preference, not a hard limit. Longer cuts use the smallest board that fits.
              </p>
            </div>

            <CutListTable group={group} onUpdateGroup={onUpdateGroup} />
          </>
        ) : (
          <SheetPiecesPanel
            group={group}
            onUpdateGroup={onUpdateGroup}
          />
        )}
      </div>
    </section>
  )
}

function SheetPiecesPanel({
  group,
  onUpdateGroup,
}: {
  group: MaterialGroup
  onUpdateGroup: (updater: (g: MaterialGroup) => MaterialGroup) => void
}) {
  const sheetPieces = group.sheetPieces
  const draftSheetPiece = group.draftSheetPiece
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Sheet stock (full sheet size)</h3>
        <div className="flex flex-wrap gap-4 items-end">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">Width (in)</span>
            <input
              type="number"
              min={1}
              value={group.sheetStockWidth || ""}
              onChange={(e) =>
                onUpdateGroup((g) => ({ ...g, sheetStockWidth: Math.max(1, parseInt(e.target.value, 10) || 0) }))
              }
              className="w-20 rounded-lg bg-slate-100 dark:bg-slate-700/60 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
              aria-label="Sheet width"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">Height (in)</span>
            <input
              type="number"
              min={1}
              value={group.sheetStockHeight || ""}
              onChange={(e) =>
                onUpdateGroup((g) => ({ ...g, sheetStockHeight: Math.max(1, parseInt(e.target.value, 10) || 0) }))
              }
              className="w-20 rounded-lg bg-slate-100 dark:bg-slate-700/60 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
              aria-label="Sheet height"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">Thickness (info)</span>
            <input
              type="text"
              value={group.sheetThickness || ""}
              onChange={(e) => onUpdateGroup((g) => ({ ...g, sheetThickness: e.target.value }))}
              placeholder='e.g. 3/4"'
              className="w-24 rounded-lg bg-slate-100 dark:bg-slate-700/60 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
              aria-label="Thickness"
            />
          </label>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Optimization from full sheets: <strong>Coming soon</strong>. List pieces to cut below.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Cut list (width × height pieces)</h3>
      <div className="rounded-lg overflow-hidden bg-slate-50/50 dark:bg-slate-700/20">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-100/80 dark:bg-slate-700/40">
              <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-300">Width (in)</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-300">Height (in)</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-300">Quantity</th>
              <th className="w-12" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {sheetPieces.length === 0 && !draftSheetPiece ? (
              <tr>
                <td colSpan={4} className="py-8 px-4 text-center text-sm text-slate-500 dark:text-slate-400">
                  No pieces. Click &quot;Add piece&quot; to add width × height × quantity.
                </td>
              </tr>
            ) : (
              <>
                {sheetPieces.map((p) => (
                  <tr
                    key={`${p.width}-${p.height}`}
                    className="bg-white/50 dark:bg-slate-800/30 even:bg-transparent dark:even:bg-slate-800/20"
                  >
                    <td className="py-2 px-4 text-slate-900 dark:text-slate-100">{p.width}"</td>
                    <td className="py-2 px-4 text-slate-900 dark:text-slate-100">{p.height}"</td>
                    <td className="py-2 px-4 text-slate-700 dark:text-slate-300">{p.quantity}</td>
                    <td className="py-2 px-2">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateGroup((g) => ({
                            ...g,
                            sheetPieces: g.sheetPieces.filter((sp) => sp.width !== p.width || sp.height !== p.height),
                          }))
                        }
                        className="p-1.5 rounded text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        aria-label={`Remove ${p.width}" × ${p.height}"`}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
                {draftSheetPiece && (
                  <tr className="bg-slate-50/80 dark:bg-slate-700/30">
                    <td className="py-2 px-4">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="e.g. 24"
                        value={draftSheetPiece.width}
                        onChange={(e) =>
                        onUpdateGroup((g) =>
                          g.draftSheetPiece
                            ? { ...g, draftSheetPiece: { ...g.draftSheetPiece, width: e.target.value } }
                            : g
                        )
                      }
                        className="w-full max-w-[5rem] rounded bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                        aria-label="Width (inches)"
                        autoFocus
                      />
                    </td>
                    <td className="py-2 px-4">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="e.g. 48"
                        value={draftSheetPiece.height}
                        onChange={(e) =>
                        onUpdateGroup((g) =>
                          g.draftSheetPiece
                            ? { ...g, draftSheetPiece: { ...g.draftSheetPiece, height: e.target.value } }
                            : g
                        )
                      }
                        className="w-full max-w-[5rem] rounded bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                        aria-label="Height (inches)"
                      />
                    </td>
                    <td className="py-2 px-4">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="1"
                        value={draftSheetPiece.quantity}
                        onChange={(e) =>
                          onUpdateGroup((g) =>
                            g.draftSheetPiece
                              ? {
                                  ...g,
                                  draftSheetPiece: {
                                    ...g.draftSheetPiece,
                                    quantity: e.target.value.replace(/\D/g, ""),
                                  },
                                }
                              : g
                          )
                        }
                        className="w-full max-w-[4rem] rounded bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                        aria-label="Quantity"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <button
                        type="button"
                        onClick={() => onUpdateGroup((g) => ({ ...g, draftSheetPiece: null }))}
                        className="p-1.5 rounded text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600"
                        aria-label="Cancel"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={() => onUpdateGroup((g) => ({ ...g, draftSheetPiece: { width: "", height: "", quantity: "" } }))}
        disabled={!!draftSheetPiece}
        className="inline-flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-700/60 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600/60 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 3v10M3 8h10" />
        </svg>
        Add piece
      </button>
      </div>
    </div>
  )
}

function UnifiedResultsView({ result }: { result: ProjectResult }) {
  const [insuranceBoard, setInsuranceBoard] = useState(false)

  return (
    <div className="print-results rounded-xl bg-white dark:bg-slate-800/80 overflow-hidden shadow-sm space-y-0 print:shadow-none print:rounded-none print:bg-white">
      {/* Print-only project title */}
      <h1 className="hidden print:block text-2xl font-bold text-slate-900 mb-4 pb-3 print:border-b-0">
        Cut List Optimizer
      </h1>

      <div className="p-4 bg-slate-50/80 dark:bg-slate-700/30 print:bg-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">
              Your plan
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 print:text-slate-600">
              One shopping list and cut recap by material group.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="print:hidden inline-flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-700/60 px-4 py-2.5 min-h-[44px] text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600/60 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            </svg>
            Print
          </button>
        </div>
      </div>

      <div className="p-6 print:p-6 space-y-10 print:space-y-10">
        {/* 1. Shopping list — primary; continuous narrative */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 print:text-slate-900 border-b border-slate-200 dark:border-slate-600 pb-2 print:border-slate-300">
            1. Shopping list
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 print:text-slate-700">
            What to buy. Board quantities are optimized minimums; plywood sheet count is listed (optimization coming soon).
          </p>
          {(result.shoppingList?.length ?? 0) > 0 && (
            <>
              <label className="print:hidden inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={insuranceBoard}
                  onChange={(e) => setInsuranceBoard(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Add insurance board (+1 per length)
                </span>
              </label>
              <ul className="space-y-3">
                {result.shoppingList.map((entry) => {
                  const shortName = shortNominalName(entry.nominalSizeName)
                  return (
                    <li
                      key={entry.nominalSizeId}
                      className="rounded-lg bg-slate-50 dark:bg-slate-800/50 print:bg-white py-3 px-4"
                    >
                      <span className="font-medium text-slate-800 dark:text-slate-200">{entry.nominalSizeName}</span>
                      <ul className="mt-2 space-y-1">
                        {entry.items.map(({ stockLength, count }) => {
                          const displayCount = count + (insuranceBoard ? 1 : 0)
                          return (
                            <li key={stockLength} className="text-sm text-slate-700 dark:text-slate-300">
                              {shortName} × {formatStockLength(stockLength)} — {displayCount} {displayCount === 1 ? "board" : "boards"}
                            </li>
                          )
                        })}
                      </ul>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
          {(result.shoppingListSheets?.length ?? 0) > 0 && (
            <ul className="space-y-3">
              {result.shoppingListSheets.map((entry) => (
                <li
                  key={entry.groupId}
                  className="rounded-lg bg-slate-50 dark:bg-slate-800/50 print:bg-white py-3 px-4"
                >
                  <span className="font-medium text-slate-800 dark:text-slate-200">{entry.groupLabel}</span>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                    {entry.sheetWidth}" × {entry.sheetHeight}" {entry.thickness ? `(${entry.thickness})` : ""} — sheet count: optimization coming soon
                  </p>
                </li>
              ))}
            </ul>
          )}
          {(result.shoppingList?.length ?? 0) === 0 && (result.shoppingListSheets?.length ?? 0) === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">No items (generate with at least one board or plywood group).</p>
          )}
        </section>

        {/* 2. Cut list recap */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 print:text-slate-900 border-b border-slate-200 dark:border-slate-600 pb-2 print:border-slate-300">
            2. Cut list recap
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 print:text-slate-700">
            What you entered. Read-only confirmation.
          </p>
          <ul className="space-y-4">
            {result.cutListRecap.map((recap) => (
              <li
                key={recap.groupId}
                className="rounded-lg bg-slate-50 dark:bg-slate-800/60 overflow-hidden print:bg-white"
              >
                <div className="px-4 py-2.5 bg-slate-100/80 dark:bg-slate-700/40 font-medium text-slate-800 dark:text-slate-200">
                  {recap.groupLabel}
                </div>
                <div className="overflow-hidden">
                  {recap.cuts.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-100/80 dark:bg-slate-700/30">
                          <th className="text-left py-2.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                            Cut length
                          </th>
                          <th className="text-left py-2.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                            Quantity
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {recap.cuts.map((c, i) => (
                          <tr
                            key={i}
                            className="bg-white/50 dark:bg-slate-800/30 even:bg-transparent dark:even:bg-slate-800/20"
                          >
                            <td className="py-2 px-4 text-slate-700 dark:text-slate-300">
                              {c.length}"
                            </td>
                            <td className="py-2 px-4 text-slate-700 dark:text-slate-300">
                              {c.quantity}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : recap.sheetPieces.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-100/80 dark:bg-slate-700/30">
                          <th className="text-left py-2.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                            Width × Height
                          </th>
                          <th className="text-left py-2.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                            Quantity
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {recap.sheetPieces.map((p, i) => (
                          <tr
                            key={i}
                            className="bg-white/50 dark:bg-slate-800/30 even:bg-transparent dark:even:bg-slate-800/20"
                          >
                            <td className="py-2 px-4 text-slate-700 dark:text-slate-300">
                              {p.width}" × {p.height}"
                            </td>
                            <td className="py-2 px-4 text-slate-700 dark:text-slate-300">
                              {p.quantity}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="p-4 text-sm text-slate-500 dark:text-slate-400">No cuts or pieces</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* 3. Cut diagrams */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 print:text-slate-900 border-b border-slate-200 dark:border-slate-600 pb-2 print:border-slate-300">
            3. Cut diagrams
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 print:text-slate-700">
            Board layout per group. Scale is consistent within each group. Plywood: optimization coming soon.
          </p>
          <ul className="space-y-6">
            {result.diagrams.map((dg) => {
              const maxStockInGroup =
                dg.boards.length > 0
                  ? Math.max(...dg.boards.map((b) => b.stockLength))
                  : 0
              const isSheet = dg.materialType === "sheet"
              return (
                <li
                  key={dg.groupId}
                  className="rounded-lg bg-slate-50 dark:bg-slate-800/50 print:bg-white py-4 px-4"
                >
                  <div className="mb-3">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200">
                      {dg.groupLabel}
                    </h4>
                    <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                      {isSheet
                        ? "Optimization coming soon"
                        : dg.boards.length === 0
                          ? "No boards used"
                          : `${dg.boards.length} ${dg.boards.length === 1 ? "board" : "boards"}`}
                    </p>
                  </div>
                  {!isSheet && dg.boards.length > 0 && (
                    <ul className="space-y-5">
                      {dg.boards.map((board, index) => (
                        <BoardResultCard
                          key={`${dg.groupId}-${index}`}
                          board={board}
                          kerfInches={dg.kerfInches}
                          maxStockLengthInGroup={maxStockInGroup}
                          preferredMaxLengthInches={dg.preferredMaxLengthInches}
                          formatStockLength={formatStockLength}
                        />
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </div>
  )
}

function CutListTable({
  group,
  onUpdateGroup,
}: {
  group: MaterialGroup
  onUpdateGroup: (updater: (g: MaterialGroup) => MaterialGroup) => void
}) {
  const updateCut = (
    oldLength: number,
    oldMaterialType: "board" | "sheet",
    updates: { length?: number; quantity?: number }
  ) => {
    onUpdateGroup((g) => {
      const current = g.cuts.find(
        (c) => c.length === oldLength && (c.materialType ?? "board") === oldMaterialType
      )
      if (!current) return g
      const newLength = updates.length ?? current.length
      const newQuantity = updates.quantity ?? current.quantity
      const materialType = current.materialType ?? "board"
      const rest = g.cuts.filter(
        (c) => !(c.length === oldLength && (c.materialType ?? "board") === oldMaterialType)
      )
      return { ...g, cuts: mergeCuts([...rest, { length: newLength, quantity: newQuantity, materialType }]) }
    })
  }
  const deleteCut = (length: number, materialType: "board" | "sheet" = "board") => {
    onUpdateGroup((g) => ({
      ...g,
      cuts: g.cuts.filter((c) => !(c.length === length && (c.materialType ?? "board") === materialType)),
    }))
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Cut list</h3>
      <div className="rounded-lg overflow-hidden bg-slate-50/50 dark:bg-slate-700/20">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-100/80 dark:bg-slate-700/40">
              <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-300">Length (in)</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-300">Quantity</th>
              <th className="w-12" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {group.cuts.length === 0 && !group.draftCut ? (
              <tr>
                <td colSpan={3} className="py-8 px-4 text-center text-sm text-slate-500 dark:text-slate-400">
                  No cuts. Click &quot;Add cut&quot; to add length and quantity.
                </td>
              </tr>
            ) : (
              <>
                {group.cuts.map((cut) => (
                  <CutRow
                    key={`${cut.length}-${cut.materialType ?? "board"}`}
                    cut={cut}
                    onUpdate={updateCut}
                    onDelete={deleteCut}
                  />
                ))}
                {group.draftCut && (
                  <DraftRow
                    draft={group.draftCut}
                    onChange={(d) => onUpdateGroup((g) => ({ ...g, draftCut: d }))}
                    onCancel={() => onUpdateGroup((g) => ({ ...g, draftCut: null }))}
                  />
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={() => onUpdateGroup((g) => ({ ...g, draftCut: { length: "", quantity: "" } }))}
        disabled={!!group.draftCut}
        className="inline-flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-700/60 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600/60 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 3v10M3 8h10" />
        </svg>
        Add cut
      </button>
    </div>
  )
}

function BoardResultCard({
  board,
  kerfInches,
  maxStockLengthInGroup = 0,
  preferredMaxLengthInches,
  formatStockLength: fmt,
}: {
  board: OptimizedBoard
  kerfInches: number
  /** When set, diagram width is proportional to board length for consistent scale within group. */
  maxStockLengthInGroup?: number
  /** When board exceeds this, show "exceeds X ft preference". */
  preferredMaxLengthInches?: number
  formatStockLength: (inches: number) => string
}) {
  const leftoverLabel =
    board.wasteRemaining > 0 && board.scrapRemaining > 0
      ? `Waste: ${board.wasteRemaining.toFixed(2)}" · Scrap: ${board.scrapRemaining.toFixed(2)}"`
      : board.wasteRemaining > 0
        ? `Waste: ${board.wasteRemaining.toFixed(2)}"`
        : board.scrapRemaining > 0
          ? `Scrap: ${board.scrapRemaining.toFixed(2)}"`
          : null
  const scaleWidth =
    maxStockLengthInGroup > 0 && board.stockLength > 0
      ? (board.stockLength / maxStockLengthInGroup) * 100
      : 100
  const exceedsPreference =
    preferredMaxLengthInches != null && board.stockLength > preferredMaxLengthInches
  return (
    <li className="rounded-lg bg-slate-50 dark:bg-slate-700/30 p-3 print:bg-white">
      <div className="flex items-baseline justify-between gap-2 mb-2 flex-wrap">
        <span className="font-medium text-slate-800 dark:text-slate-200">
          {fmt(board.stockLength)}
          <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
            ({board.source === "scrap" ? "scrap" : "new"})
            {exceedsPreference && (
              <span className="ml-1 text-amber-600 dark:text-amber-400">
                (exceeds {fmt(preferredMaxLengthInches!)} preference)
              </span>
            )}
          </span>
        </span>
        {leftoverLabel && (
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {leftoverLabel}
          </span>
        )}
      </div>
      <div
        className="w-full min-w-0"
        style={
          scaleWidth < 100
            ? { width: `${scaleWidth}%`, maxWidth: "100%" }
            : undefined
        }
      >
        <BoardCutDiagram board={board} kerfInches={kerfInches} />
      </div>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Cuts: {board.cuts.map((c) => `${c}"`).join(", ")}
      </p>
    </li>
  )
}

function BoardCutDiagram({
  board,
  kerfInches,
}: {
  board: OptimizedBoard
  kerfInches: number
}) {
  const { stockLength, cuts, remainingWaste } = board
  const total = stockLength

  const segments: { length: number; type: "cut" | "kerf" | "waste"; label?: string }[] = []
  cuts.forEach((cut, i) => {
    segments.push({ length: cut, type: "cut", label: `${cut}"` })
    if (i < cuts.length - 1) {
      segments.push({ length: kerfInches, type: "kerf" })
    }
  })
  if (remainingWaste > 0) {
    segments.push({ length: remainingWaste, type: "waste", label: remainingWaste >= 0.5 ? `${remainingWaste.toFixed(1)}"` : undefined })
  }

  return (
    <div className="w-full min-w-0">
      <div
        className="flex h-10 w-full min-w-0 rounded overflow-hidden ring-1 ring-slate-200 dark:ring-slate-600"
        role="img"
        aria-label={`Cut diagram: ${cuts.map((c) => `${c} inch`).join(", ")} with ${remainingWaste.toFixed(1)} inch waste`}
      >
        {segments.map((seg, i) => {
          const pct = total > 0 ? (seg.length / total) * 100 : 0
          const showLabel = seg.label && (seg.type === "cut" ? pct >= 6 : seg.type === "waste" ? pct >= 8 : false)
          const bgClass =
            seg.type === "cut"
              ? "bg-emerald-500 dark:bg-emerald-600"
              : seg.type === "kerf"
                ? "bg-amber-400 dark:bg-amber-500"
                : "bg-slate-300 dark:bg-slate-500"
          return (
            <div
              key={i}
              className={`flex shrink-0 items-center justify-center overflow-hidden border-r border-slate-300/80 dark:border-slate-500/80 last:border-r-0 ${bgClass}`}
              style={{
                width: `${pct}%`,
                minWidth: pct > 0 ? "2px" : undefined,
              }}
              title={seg.label ?? (seg.type === "kerf" ? "Kerf" : undefined)}
            >
              {seg.type === "cut" && (
                <span
                  className={`text-xs font-medium text-white drop-shadow-sm whitespace-nowrap ${
                    showLabel ? "opacity-100" : "opacity-0 sm:opacity-100"
                  }`}
                  style={{ fontSize: "clamp(0.65rem, 1.2vw, 0.75rem)" }}
                >
                  {seg.label}
                </span>
              )}
              {seg.type === "kerf" && (
                <span className="sr-only">Kerf</span>
              )}
              {seg.type === "waste" && showLabel && (
                <span
                  className="text-xs font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap drop-shadow-sm"
                  style={{ fontSize: "clamp(0.65rem, 1.2vw, 0.75rem)" }}
                >
                  {seg.label}
                </span>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-3 rounded-sm bg-emerald-500 dark:bg-emerald-600" aria-hidden />
          Cut
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2 bg-amber-400 dark:bg-amber-500" aria-hidden />
          Kerf
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-3 rounded-sm bg-slate-300 dark:bg-slate-500" aria-hidden />
          Waste
        </span>
      </div>
    </div>
  )
}

function CutRow({
  cut,
  onUpdate,
  onDelete,
}: {
  cut: CutRequirement
  onUpdate: (
    oldLength: number,
    oldMaterialType: "board" | "sheet",
    u: { length?: number; quantity?: number }
  ) => void
  onDelete: (length: number, materialType?: "board" | "sheet") => void
}) {
  const materialType = cut.materialType ?? "board"
  const [lengthInput, setLengthInput] = useState(String(cut.length))
  const [qtyInput, setQtyInput] = useState(String(cut.quantity))
  const [lengthError, setLengthError] = useState(false)
  const [qtyError, setQtyError] = useState(false)
  const prevCutRef = useRef(cut)

  useEffect(() => {
    if (prevCutRef.current !== cut) {
      prevCutRef.current = cut
      setLengthInput(String(cut.length))
      setQtyInput(String(cut.quantity))
      setLengthError(false)
      setQtyError(false)
    }
  }, [cut])

  const handleLengthBlur = () => {
    const n = parseLength(lengthInput)
    if (isValidLength(n) && n !== cut.length) {
      onUpdate(cut.length, materialType, { length: n })
      setLengthInput(String(n))
      setLengthError(false)
    } else if (!lengthInput.trim()) {
      setLengthError(true)
    } else if (!isValidLength(n)) {
      setLengthError(true)
    } else {
      setLengthInput(String(cut.length))
      setLengthError(false)
    }
  }

  const handleQtyBlur = () => {
    const n = parseQuantity(qtyInput)
    if (isValidQuantity(n) && n !== cut.quantity) {
      onUpdate(cut.length, materialType, { quantity: n })
      setQtyInput(String(n))
      setQtyError(false)
    } else if (!qtyInput.trim()) {
      setQtyError(true)
    } else if (!isValidQuantity(n)) {
      setQtyError(true)
    } else {
      setQtyInput(String(cut.quantity))
      setQtyError(false)
    }
  }

  return (
    <tr className="bg-white/50 dark:bg-slate-800/30 even:bg-transparent dark:even:bg-slate-800/20">
      <td className="py-2 px-4">
        <input
          type="text"
          inputMode="decimal"
          value={lengthInput}
          onChange={(e) => {
            setLengthInput(e.target.value)
            setLengthError(false)
          }}
          onBlur={handleLengthBlur}
          className={`w-full max-w-[6rem] rounded border px-2 py-1.5 text-sm bg-transparent text-slate-900 dark:text-slate-100 ${
            lengthError
              ? "border-red-500 focus:ring-red-500"
              : "border-slate-300 dark:border-slate-600 focus:ring-slate-400 focus:border-slate-400"
          } focus:outline-none focus:ring-2`}
          aria-label={`Length for ${cut.length} inches`}
        />
      </td>
      <td className="py-2 px-4">
        <input
          type="text"
          inputMode="numeric"
          value={qtyInput}
          onChange={(e) => {
            setQtyInput(e.target.value.replace(/\D/g, ""))
            setQtyError(false)
          }}
          onBlur={handleQtyBlur}
          className={`w-full max-w-[4rem] rounded border px-2 py-1.5 text-sm bg-transparent text-slate-900 dark:text-slate-100 ${
            qtyError
              ? "border-red-500 focus:ring-red-500"
              : "border-slate-300 dark:border-slate-600 focus:ring-slate-400 focus:border-slate-400"
          } focus:outline-none focus:ring-2`}
          aria-label={`Quantity for ${cut.length} inches`}
        />
      </td>
      <td className="py-2 px-2">
        <button
          type="button"
          onClick={() => onDelete(cut.length, materialType)}
          className="p-1.5 rounded text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-red-500/50"
          aria-label={`Delete ${cut.quantity} × ${cut.length}"`}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </button>
      </td>
    </tr>
  )
}

function DraftRow({
  draft,
  onChange,
  onCancel,
}: {
  draft: { length: string; quantity: string }
  onChange: (d: { length: string; quantity: string }) => void
  onCancel: () => void
}) {
  return (
    <tr className="bg-slate-50/80 dark:bg-slate-700/30">
      <td className="py-2 px-4">
        <input
          type="text"
          inputMode="decimal"
          placeholder="e.g. 24"
          value={draft.length}
          onChange={(e) => onChange({ ...draft, length: e.target.value })}
          className="w-full max-w-[6rem] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
          aria-label="New cut length"
          autoFocus
        />
      </td>
      <td className="py-2 px-4">
        <input
          type="text"
          inputMode="numeric"
          placeholder="e.g. 13"
          value={draft.quantity}
          onChange={(e) =>
            onChange({ ...draft, quantity: e.target.value.replace(/\D/g, "") })
          }
          className="w-full max-w-[4rem] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
          aria-label="New cut quantity"
        />
      </td>
      <td className="py-2 px-2">
        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 rounded text-slate-500 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-400/50"
          aria-label="Cancel add"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </td>
    </tr>
  )
}

export default App
