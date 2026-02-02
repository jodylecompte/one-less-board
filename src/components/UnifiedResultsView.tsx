import { useState } from "react"
import type { OptimizedBoard } from "../lib/optimizer"
import type { ProjectResult } from "../lib/project-result"
import { formatStockLength, shortNominalName } from "../lib/stock-profiles"

export function UnifiedResultsView({
  result,
  scrapNote,
}: {
  result: ProjectResult
  scrapNote: string | null
}) {
  const [insuranceBoard, setInsuranceBoard] = useState(false)

  return (
    <div className="print-results rounded-xl bg-white dark:bg-slate-800/80 overflow-hidden shadow-sm space-y-0 print:shadow-none print:rounded-none print:bg-white">
      <h1 className="hidden print:block text-2xl font-bold text-slate-900 mb-4 pb-3 print:border-b-0">
        Cut List Optimizer
      </h1>

      <div className="p-4 bg-slate-50/80 dark:bg-slate-700/30 print:bg-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">Your plan</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 print:text-slate-600">
              One shopping list, cut recap, and board diagrams.
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
        {scrapNote && (
          <p className="print:hidden text-sm rounded-lg bg-emerald-50/80 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-3 py-2">
            {scrapNote}
          </p>
        )}

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 print:text-slate-900 border-b border-slate-200 dark:border-slate-600 pb-2 print:border-slate-300">
            1. Shopping list
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 print:text-slate-700">
            What to buy. Quantities are optimized minimums by board size and stock length.
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
                      className="rounded-lg bg-slate-50 dark:bg-slate-800/50 print:bg-white py-3 px-4 print:break-inside-avoid"
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
          {(result.shoppingList?.length ?? 0) === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">No board purchases required for this run.</p>
          )}
        </section>

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
                className="rounded-lg bg-slate-50 dark:bg-slate-800/60 overflow-hidden print:bg-white print:break-inside-avoid"
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
                  ) : (
                    <p className="p-4 text-sm text-slate-500 dark:text-slate-400">No cuts in this group</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 print:text-slate-900 border-b border-slate-200 dark:border-slate-600 pb-2 print:border-slate-300">
            3. Cut diagrams
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 print:text-slate-700">
            Board layout per group. Scale is consistent within each group.
          </p>
          <ul className="space-y-6">
            {result.diagrams.map((dg) => {
              const maxStockInGroup =
                dg.boards.length > 0
                  ? Math.max(...dg.boards.map((b) => b.stockLength))
                  : 0
              return (
                <li
                  key={dg.groupId}
                  className="rounded-lg bg-slate-50 dark:bg-slate-800/50 print:bg-white py-4 px-4 print:break-inside-avoid"
                >
                  <div className="mb-3">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-200">{dg.groupLabel}</h4>
                    <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                      {dg.boards.length === 0
                        ? "No boards used"
                        : `${dg.boards.length} ${dg.boards.length === 1 ? "board" : "boards"}`}
                    </p>
                  </div>
                  {dg.boards.length > 0 && (
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

function BoardResultCard({
  board,
  kerfInches,
  maxStockLengthInGroup = 0,
  preferredMaxLengthInches,
  formatStockLength: fmt,
}: {
  board: OptimizedBoard
  kerfInches: number
  maxStockLengthInGroup?: number
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
    <li className="rounded-lg bg-slate-50 dark:bg-slate-700/30 p-3 print:bg-white print:break-inside-avoid">
      <div className="flex items-baseline justify-between gap-2 mb-2 flex-wrap">
        <span className="font-medium text-slate-800 dark:text-slate-200 print:text-slate-900">
          {fmt(board.stockLength)}
          <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400 print:text-slate-700">
            ({board.source === "scrap" ? "scrap" : "new"})
            {exceedsPreference && (
              <span className="ml-1 text-amber-600 dark:text-amber-400 print:text-slate-700">
                (exceeds {fmt(preferredMaxLengthInches!)} preference)
              </span>
            )}
          </span>
        </span>
        {leftoverLabel && (
          <span className="text-sm text-slate-600 dark:text-slate-400 print:text-slate-700">
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
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 print:text-slate-700">
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
    segments.push({
      length: remainingWaste,
      type: "waste",
      label: remainingWaste >= 0.5 ? `${remainingWaste.toFixed(1)}"` : undefined,
    })
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
                ? "bg-amber-300 dark:bg-amber-500"
                : "bg-slate-200 dark:bg-slate-500/90 [background-image:repeating-linear-gradient(135deg,transparent,transparent_4px,rgba(15,23,42,.2)_4px,rgba(15,23,42,.2)_7px)]"
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
                <span className="text-[10px] font-semibold text-slate-700/80 dark:text-slate-100/80">K</span>
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
          Cut (solid)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2 bg-amber-300 dark:bg-amber-500" aria-hidden />
          Kerf (K)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-3 rounded-sm bg-slate-300 dark:bg-slate-500 [background-image:repeating-linear-gradient(135deg,transparent,transparent_3px,rgba(15,23,42,.2)_3px,rgba(15,23,42,.2)_5px)]" aria-hidden />
          Offcut / waste (hatched)
        </span>
      </div>
    </div>
  )
}
