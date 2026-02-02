import { useState, useEffect, useRef, useMemo } from "react"
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
  type StockProfile,
} from "./lib/stock-profiles"
import { optimize, type OptimizedBoard } from "./lib/optimizer"

function App() {
  const [cuts, setCuts] = useState<CutRequirement[]>([])
  const [draft, setDraft] = useState<{ length: string; quantity: string } | null>(
    null
  )
  const [stockProfileId, setStockProfileId] = useState<string>("")

  useEffect(() => {
    if (!draft) return
    const len = parseLength(draft.length)
    const qty = parseQuantity(draft.quantity)
    if (isValidLength(len) && isValidQuantity(qty)) {
      setCuts((prev) => mergeCuts([...prev, { length: len, quantity: qty }]))
      setDraft(null)
    }
  }, [draft])

  const addRow = () => setDraft({ length: "", quantity: "" })

  const updateCut = (
    oldLength: number,
    updates: { length?: number; quantity?: number }
  ) => {
    setCuts((prev) => {
      const current = prev.find((c) => c.length === oldLength)
      if (!current) return prev
      const newLength = updates.length ?? current.length
      const newQuantity = updates.quantity ?? current.quantity
      const rest = prev.filter((c) => c.length !== oldLength)
      return mergeCuts([...rest, { length: newLength, quantity: newQuantity }])
    })
  }

  const deleteCut = (length: number) => {
    setCuts((prev) => prev.filter((c) => c.length !== length))
  }

  const selectedProfile = STOCK_PROFILES.find((p) => p.id === stockProfileId)
  const results = useMemo(() => {
    if (!selectedProfile || cuts.length === 0) return null
    return optimize({
      requiredCuts: cuts,
      allowedStockLengths: selectedProfile.allowedLengths,
      kerfInches: selectedProfile.kerf,
    })
  }, [selectedProfile, cuts])

  const canOptimize = selectedProfile != null && cuts.length > 0

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 py-8 px-4 sm:p-6 md:px-8">
      <div className="w-full max-w-3xl mx-auto space-y-8 transition-all duration-200">
        <header className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-100">
            Cut List Optimizer
          </h1>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400">
            Cross-cut optimization for lumber
          </p>
        </header>

        <section className="space-y-4 transition-opacity duration-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
              What you need
            </h2>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
              The pieces you need to cut (length and quantity).
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 overflow-hidden shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Length (in)
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Quantity
                  </th>
                  <th className="w-12" aria-hidden />
                </tr>
              </thead>
              <tbody>
                {cuts.length === 0 && !draft ? (
                  <tr>
                    <td colSpan={3} className="py-10 px-4 text-center">
                      <p className="text-slate-500 dark:text-slate-400 text-sm">
                        No cuts yet.
                      </p>
                      <p className="mt-1 text-slate-400 dark:text-slate-500 text-sm">
                        Click &quot;Add cut&quot; to add each length and quantity you need.
                      </p>
                    </td>
                  </tr>
                ) : (
                  <>
                    {cuts.map((cut) => (
                      <CutRow
                        key={cut.length}
                        cut={cut}
                        onUpdate={updateCut}
                        onDelete={deleteCut}
                      />
                    ))}
                    {draft && (
                      <DraftRow
                        draft={draft}
                        onChange={setDraft}
                        onCancel={() => setDraft(null)}
                      />
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={addRow}
            disabled={!!draft}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-colors duration-150"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 3v10M3 8h10" />
            </svg>
            Add cut
          </button>
        </section>

        <StockConstraintsPanel
          selectedId={stockProfileId}
          onSelect={setStockProfileId}
        />

        {canOptimize && selectedProfile && results !== null ? (
          <div className="animate-fade-in">
            <OptimizationResults
              boards={results}
              kerfInches={selectedProfile.kerf}
            />
          </div>
        ) : (
          <BuyListEmptyState
            hasCuts={cuts.length > 0}
            hasProfile={selectedProfile != null}
          />
        )}
      </div>
    </div>
  )
}

function OptimizationResults({
  boards,
  kerfInches,
}: {
  boards: OptimizedBoard[]
  kerfInches: number
}) {
  if (boards.length === 0) return null

  const totalBoards = boards.length
  const byStockLength = boards.reduce(
    (acc, b) => {
      acc[b.stockLength] = (acc[b.stockLength] ?? 0) + 1
      return acc
    },
    {} as Record<number, number>
  )
  const summaryEntries = Object.entries(byStockLength)
    .map(([len, count]) => ({ stockLength: Number(len), count }))
    .sort((a, b) => a.stockLength - b.stockLength)

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 overflow-hidden shadow-sm">
      <div className="p-4 border-b border-slate-200 dark:border-slate-600">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
          What you can buy
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Your optimized lumber buy list — take this to the yard or shop.
        </p>
      </div>

      <div className="p-4 space-y-6">
        <section>
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Summary
          </h3>
          <p className="text-slate-900 dark:text-slate-100 font-semibold">
            {totalBoards} {totalBoards === 1 ? "board" : "boards"} total
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
            {summaryEntries.map(({ stockLength, count }) => (
              <li key={stockLength}>
                {count} × {formatStockLength(stockLength)}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
            Per board
          </h3>
          <ul className="space-y-4">
            {boards.map((board, index) => (
              <li
                key={index}
                className="rounded-md border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/30 p-3 transition-colors duration-150"
              >
                <div className="flex items-baseline justify-between gap-2 mb-2">
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    Board {index + 1}: {formatStockLength(board.stockLength)}
                  </span>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Waste: {board.remainingWaste.toFixed(2)}"
                  </span>
                </div>
                <BoardCutDiagram
                  board={board}
                  kerfInches={kerfInches}
                />
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  Cuts: {board.cuts.map((c) => `${c}"`).join(", ")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
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

function BuyListEmptyState({
  hasCuts,
  hasProfile,
}: {
  hasCuts: boolean
  hasProfile: boolean
}) {
  const message = !hasCuts && !hasProfile
    ? "Add your cut list above and select a stock profile to see your optimized buy list."
    : !hasProfile
      ? "Select a stock profile above to see your buy list."
      : "Add your cut list above to see your buy list."

  return (
    <div
      className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 overflow-hidden shadow-sm transition-opacity duration-200"
      aria-hidden={!message}
    >
      <div className="p-4 border-b border-slate-200 dark:border-slate-600">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
          What you can buy
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Your optimized lumber buy list will appear here.
        </p>
      </div>
      <div className="p-8 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
          {message}
        </p>
      </div>
    </div>
  )
}

function StockConstraintsPanel({
  selectedId,
  onSelect,
}: {
  selectedId: string
  onSelect: (id: string) => void
}) {
  const selectedProfile = STOCK_PROFILES.find((p) => p.id === selectedId)

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-4 space-y-4 transition-shadow duration-200 hover:shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
          Allowed stock
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          The boards the optimizer is allowed to use — a constraint, not a purchase decision.
        </p>
      </div>

      {!selectedProfile && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Choose a profile below to set available lengths and kerf.
        </p>
      )}

      <div className="space-y-2">
        <label
          htmlFor="stock-profile"
          className="block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Stock profile
        </label>
        <Select.Root value={selectedId || undefined} onValueChange={onSelect}>
          <Select.Trigger
            id="stock-profile"
            className="inline-flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-left text-slate-900 dark:text-slate-100 shadow-sm outline-none hover:bg-slate-50 dark:hover:bg-slate-700 focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900 data-[placeholder]:text-slate-500"
            aria-label="Select stock profile"
          >
            <Select.Value placeholder="Choose a profile..." />
            <Select.Icon>
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                className="text-slate-500"
              >
                <path
                  d="M3 4.5L6 7.5L9 4.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content
              position="popper"
              sideOffset={4}
              className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg"
            >
              <Select.Viewport className="p-1 max-h-[240px]">
                {STOCK_PROFILES.map((profile) => (
                  <Select.Item
                    key={profile.id}
                    value={profile.id}
                    className="relative flex cursor-pointer select-none items-center rounded-md px-3 py-2 text-sm outline-none hover:bg-slate-100 dark:hover:bg-slate-700 focus:bg-slate-100 dark:focus:bg-slate-700 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                  >
                    <Select.ItemText>{profile.name}</Select.ItemText>
                    <Select.ItemIndicator className="absolute right-3">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2 6L5 9L10 3"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </div>

      {selectedProfile && (
        <ProfileDetails profile={selectedProfile} />
      )}
    </div>
  )
}

function ProfileDetails({ profile }: { profile: StockProfile }) {
  return (
    <dl className="rounded-md bg-slate-50 dark:bg-slate-700/30 px-3 py-2.5 space-y-1.5 text-sm">
      <div>
        <dt className="inline font-medium text-slate-700 dark:text-slate-300">
          Allowed lengths:{" "}
        </dt>
        <dd className="inline text-slate-600 dark:text-slate-400">
          {profile.allowedLengths.map(formatStockLength).join(", ")}
        </dd>
      </div>
      <div>
        <dt className="inline font-medium text-slate-700 dark:text-slate-300">
          Kerf:{" "}
        </dt>
        <dd className="inline text-slate-600 dark:text-slate-400">
          {profile.kerf}" {profile.kerf === 0.125 ? "(1/8″)" : ""}
        </dd>
      </div>
    </dl>
  )
}

function CutRow({
  cut,
  onUpdate,
  onDelete,
}: {
  cut: CutRequirement
  onUpdate: (oldLength: number, u: { length?: number; quantity?: number }) => void
  onDelete: (length: number) => void
}) {
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
      onUpdate(cut.length, { length: n })
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
      onUpdate(cut.length, { quantity: n })
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
          onClick={() => onDelete(cut.length)}
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
