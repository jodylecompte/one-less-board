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
import { STOCK_PROFILES, formatStockLength, shortNominalName } from "./lib/stock-profiles"
import {
  mergeScrapBoards,
  type OptimizedBoard,
  type ScrapBoard,
} from "./lib/optimizer"
import {
  createBoardGroup,
  createDefaultGroup,
  type MaterialGroup,
} from "./lib/material-groups"
import { generateProjectResult, type ProjectResult } from "./lib/project-result"

function App() {
  const [groups, setGroups] = useState<MaterialGroup[]>(() => [createDefaultGroup()])
  const [projectResult, setProjectResult] = useState<ProjectResult | null>(null)

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
        g.draftScrap &&
        isValidLength(parseLength(g.draftScrap.length)) &&
        isValidQuantity(parseQuantity(g.draftScrap.quantity))
    )
    if (!toCommit?.draftScrap) return
    const len = parseLength(toCommit.draftScrap.length)
    const qty = parseQuantity(toCommit.draftScrap.quantity)
    setGroups((prev) =>
      prev.map((g) =>
        g.id === toCommit.id
          ? {
              ...g,
              scrap: mergeScrapBoards([...g.scrap, { stockLength: len, quantity: qty }]),
              draftScrap: null,
            }
          : g
      )
    )
  }, [groups])

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 py-8 px-4 sm:p-6 md:px-8 print:bg-white print:py-0 print:px-0">
      <div className="w-full max-w-3xl mx-auto space-y-8 transition-all duration-200 print:max-w-none">
        <header className="text-center space-y-2 print:hidden">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-100">
            Cut List Optimizer
          </h1>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400">
            Cross-cut optimization for lumber
          </p>
        </header>

        <div className="space-y-8 print:hidden">
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
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900 print:hidden"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3v10M3 8h10" />
          </svg>
          Add material group
        </button>

        <div className="pt-4 print:hidden">
          <button
            type="button"
            onClick={() => setProjectResult(generateProjectResult(groups))}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
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

        {projectResult && (
          <UnifiedResultsView result={projectResult} />
        )}
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
  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-200 dark:border-slate-600 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 shrink-0">
            Board
          </span>
          <input
            type="text"
            value={group.label}
            onChange={(e) => onUpdateGroup((g) => ({ ...g, label: e.target.value }))}
            className="bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-slate-400 dark:focus:border-slate-500 focus:outline-none px-1 py-0.5 text-lg font-semibold text-slate-800 dark:text-slate-200 min-w-[8rem]"
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

      <div className="p-4 space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Board spec
          </label>
          <Select.Root
            value={group.boardSpecId || undefined}
            onValueChange={(id) => onUpdateGroup((g) => ({ ...g, boardSpecId: id }))}
          >
            <Select.Trigger className="inline-flex w-full max-w-xs items-center justify-between gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm">
              <Select.Value placeholder="Choose profile..." />
              <Select.Icon>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content position="popper" sideOffset={4} className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg">
                <Select.Viewport className="p-1 max-h-[200px]">
                  {STOCK_PROFILES.map((profile) => (
                    <Select.Item key={profile.id} value={profile.id} className="rounded-md px-3 py-2 text-sm outline-none hover:bg-slate-100 dark:hover:bg-slate-700 data-[highlighted]:bg-slate-100 dark:data-[highlighted]:bg-slate-700">
                      <Select.ItemText>{profile.name}</Select.ItemText>
                      <Select.ItemIndicator className="absolute right-3">✓</Select.ItemIndicator>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>

        <CutListTable group={group} onUpdateGroup={onUpdateGroup} />

        <ScrapPilePanel
          scrapBoards={group.scrap}
          draftScrap={group.draftScrap}
          onDraftChange={(d) => onUpdateGroup((g) => ({ ...g, draftScrap: d }))}
          onAddRow={() => onUpdateGroup((g) => ({ ...g, draftScrap: { length: "", quantity: "" } }))}
          onDelete={(stockLength) =>
            onUpdateGroup((g) => ({ ...g, scrap: g.scrap.filter((s) => s.stockLength !== stockLength) }))
          }
        />
      </div>
    </section>
  )
}

function UnifiedResultsView({ result }: { result: ProjectResult }) {
  const [insuranceBoard, setInsuranceBoard] = useState(false)

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 overflow-hidden shadow-sm space-y-0 print:border print:shadow-none print:rounded-none print:bg-white">
      {/* Print-only project title */}
      <h1 className="hidden print:block text-2xl font-bold text-slate-900 mb-4 pb-3 border-b-2 border-slate-300">
        Cut List Optimizer
      </h1>

      <div className="p-4 border-b border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/30 print:border-slate-300 print:bg-slate-100">
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
            className="print:hidden inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            </svg>
            Print
          </button>
        </div>
      </div>

      <div className="p-6 space-y-8 print:p-6 print:space-y-8">
        {result.shoppingList.length > 0 && (
          <section className="print:break-inside-avoid">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2 print:text-slate-900">
              1. Shopping list (what to buy)
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 print:text-slate-700">
              Quantities are optimized minimums. Add an insurance board per length if you want a spare.
            </p>
            <label className="print:hidden inline-flex items-center gap-2 mb-4 cursor-pointer">
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
            <ul className="space-y-4">
              {result.shoppingList.map((entry) => {
                const shortName = shortNominalName(entry.nominalSizeName)
                return (
                  <li
                    key={entry.nominalSizeId}
                    className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 overflow-hidden print:bg-white print:border-slate-300"
                  >
                    <h4 className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200 bg-slate-50/80 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600">
                      {entry.nominalSizeName}
                    </h4>
                    <ul className="p-4 space-y-2">
                      {entry.items.map(({ stockLength, count }) => {
                        const displayCount = count + (insuranceBoard ? 1 : 0)
                        return (
                          <li
                            key={stockLength}
                            className="text-slate-700 dark:text-slate-300 text-sm flex items-baseline gap-2"
                          >
                            <span className="text-slate-500 dark:text-slate-400">—</span>
                            <span>
                              {shortName} × {formatStockLength(stockLength)} — {displayCount} {displayCount === 1 ? "board" : "boards"}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        <section className="print:break-inside-avoid">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2 print:text-slate-900">
            2. Cut list recap (what you entered)
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 print:text-slate-700">
            Confirm the optimizer understood your input correctly. Read-only.
          </p>
          <ul className="space-y-4">
            {result.cutListRecap.map((recap) => (
              <li
                key={recap.groupId}
                className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 overflow-hidden print:break-inside-avoid print:bg-white print:border-slate-300"
              >
                <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 font-medium text-slate-800 dark:text-slate-200">
                  {recap.groupLabel}
                </div>
                <div className="overflow-hidden">
                  {recap.cuts.length === 0 ? (
                    <p className="p-4 text-sm text-slate-500 dark:text-slate-400">No cuts</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-700/30">
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
                            className="border-b border-slate-100 dark:border-slate-700 last:border-b-0"
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
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="print:break-inside-avoid">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2 print:text-slate-900">
            3. Cut diagrams
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 print:text-slate-700">
            One material per section. Scale is consistent within each group.
          </p>
          <ul className="space-y-8">
            {result.diagrams.map((dg) => {
              const maxStockInGroup =
                dg.boards.length > 0
                  ? Math.max(...dg.boards.map((b) => b.stockLength))
                  : 0
              return (
                <li
                  key={dg.groupId}
                  className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 overflow-hidden print:break-inside-avoid print:bg-white print:border-slate-300"
                >
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-700/50">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200">
                      {dg.groupLabel}
                    </h4>
                    <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                      {dg.boards.length === 0
                        ? "No boards used"
                        : `${dg.boards.length} ${dg.boards.length === 1 ? "board" : "boards"}`}
                    </p>
                  </div>
                  <div className="p-4">
                    {dg.boards.length === 0 ? null : (
                      <ul className="space-y-5">
                        {dg.boards.map((board, index) => (
                          <BoardResultCard
                            key={`${dg.groupId}-${index}`}
                            board={board}
                            kerfInches={dg.kerfInches}
                            maxStockLengthInGroup={maxStockInGroup}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
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
      <div className="rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50">
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
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
}: {
  board: OptimizedBoard
  kerfInches: number
  /** When set, diagram width is proportional to board length for consistent scale within group. */
  maxStockLengthInGroup?: number
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
  return (
    <li className="rounded-md border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/30 p-3 print:bg-white print:border-slate-300">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <span className="font-medium text-slate-800 dark:text-slate-200">
          {formatStockLength(board.stockLength)}
          <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">
            ({board.source === "scrap" ? "scrap" : "new"})
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
        className="flex h-10 w-full min-w-0 rounded overflow-hidden border border-slate-300 dark:border-slate-500"
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

function ScrapPilePanel({
  scrapBoards,
  draftScrap,
  onDraftChange,
  onAddRow,
  onDelete,
}: {
  scrapBoards: ScrapBoard[]
  draftScrap: { length: string; quantity: string } | null
  onDraftChange: (d: { length: string; quantity: string } | null) => void
  onAddRow: () => void
  onDelete: (stockLength: number) => void
}) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
          Scrap pile (boards)
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Boards you already have — used first before buying new stock.
        </p>
      </div>
      <div className="rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50">
              <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                Length (in)
              </th>
              <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                Qty
              </th>
              <th className="w-12" aria-hidden />
            </tr>
          </thead>
          <tbody>
            {scrapBoards.length === 0 && !draftScrap ? (
              <tr>
                <td colSpan={3} className="py-6 px-4 text-center text-sm text-slate-500 dark:text-slate-400">
                  No scrap. Add lengths you have on hand.
                </td>
              </tr>
            ) : (
              <>
                {scrapBoards.map((s) => (
                  <tr
                    key={s.stockLength}
                    className="border-b border-slate-100 dark:border-slate-700 last:border-b-0"
                  >
                    <td className="py-2 px-4 text-slate-900 dark:text-slate-100">
                      {formatStockLength(s.stockLength)}
                    </td>
                    <td className="py-2 px-4 text-slate-700 dark:text-slate-300">
                      {s.quantity}
                    </td>
                    <td className="py-2 px-2">
                      <button
                        type="button"
                        onClick={() => onDelete(s.stockLength)}
                        className="p-1.5 rounded text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        aria-label={`Remove scrap ${s.quantity} × ${formatStockLength(s.stockLength)}`}
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
                {draftScrap && (
                  <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/20">
                    <td className="py-2 px-4">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="e.g. 96"
                        value={draftScrap.length}
                        onChange={(e) => onDraftChange({ ...draftScrap, length: e.target.value })}
                        className="w-full max-w-[6rem] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
                        aria-label="Scrap length"
                        autoFocus
                      />
                    </td>
                    <td className="py-2 px-4">
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="1"
                        value={draftScrap.quantity}
                        onChange={(e) =>
                          onDraftChange({ ...draftScrap, quantity: e.target.value.replace(/\D/g, "") })
                        }
                        className="w-full max-w-[4rem] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-sm"
                        aria-label="Scrap quantity"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <button
                        type="button"
                        onClick={() => onDraftChange(null)}
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
        onClick={onAddRow}
        disabled={!!draftScrap}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 3v10M3 8h10" />
        </svg>
        Add scrap
      </button>
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
    <tr className="border-b border-slate-100 dark:border-slate-700 last:border-b-0">
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
    <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/20">
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
