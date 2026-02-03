import { useEffect, useState } from "react"
import { isValidLength, isValidQuantity, parseLength, parseQuantity } from "../lib/cuts"
import { mergeScrapEntries, type ScrapEntry } from "../lib/optimizer"
import { STOCK_PROFILES, shortNominalName } from "../lib/stock-profiles"
import { fieldClassName } from "./uiClasses"

export function ScrapInventoryModal({
  scrapInventory,
  setScrapInventory,
  onClose,
  formatStockLength,
}: {
  scrapInventory: ScrapEntry[]
  setScrapInventory: (next: ScrapEntry[] | ((prev: ScrapEntry[]) => ScrapEntry[])) => void
  onClose: () => void
  formatStockLength: (inches: number) => string
}) {
  const [boardDraft, setBoardDraft] = useState<{
    nominalSizeId: string
    length: string
    quantity: string
  } | null>(null)
  const [draftError, setDraftError] = useState<string | null>(null)

  const boardEntries = scrapInventory.filter(
    (s): s is Extract<ScrapEntry, { materialType: "board" }> => s.materialType === "board"
  )

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  const addBoardDraft = () => {
    if (!boardDraft) return
    const stockLength = parseLength(boardDraft.length)
    const quantity = parseQuantity(boardDraft.quantity)
    if (!boardDraft.nominalSizeId) {
      setDraftError("Board size is required.")
      return
    }
    if (!isValidLength(stockLength)) {
      setDraftError("Length is required and must be greater than 0.")
      return
    }
    if (!isValidQuantity(quantity)) {
      setDraftError("Quantity is required and must be a whole number.")
      return
    }
    setScrapInventory((prev) =>
      mergeScrapEntries([
        ...prev,
        { materialType: "board", nominalSizeId: boardDraft.nominalSizeId, stockLength, quantity },
      ])
    )
    setBoardDraft((d) => (d ? { ...d, length: "", quantity: "" } : d))
    setDraftError(null)
  }

  const removeBoardScrap = (nominalSizeId: string, stockLength: number) => {
    setScrapInventory((prev) =>
      prev.filter(
        (s) =>
          !(
            s.materialType === "board" &&
            s.nominalSizeId === nominalSizeId &&
            s.stockLength === stockLength
          )
      )
    )
  }

  const updateBoardQuantity = (nominalSizeId: string, stockLength: number, newQuantity: number) => {
    if (newQuantity < 1) {
      removeBoardScrap(nominalSizeId, stockLength)
      return
    }
    if (!Number.isInteger(newQuantity)) return
    setScrapInventory((prev) =>
      prev.map((s) =>
        s.materialType === "board" && s.nominalSizeId === nominalSizeId && s.stockLength === stockLength
          ? { ...s, quantity: newQuantity }
          : s
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
              Optional advanced feature. Add boards you already have; inventory is saved in this browser.
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
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Boards by nominal size and length</h3>
            <div className="rounded-lg overflow-hidden bg-slate-50/80 dark:bg-slate-700/30">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-100/80 dark:bg-slate-700/40">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-300">Nominal size</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-300">Length</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-700 dark:text-slate-300">Qty</th>
                    <th className="w-12" aria-hidden />
                  </tr>
                </thead>
                <tbody>
                  {boardEntries.length === 0 && !boardDraft ? (
                    <tr>
                      <td colSpan={4} className="py-8 px-4 text-center text-sm text-slate-500 dark:text-slate-400">
                        No board scrap yet. You can ignore this unless you want the optimizer to consume offcuts first.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {boardEntries.map((s) => (
                        <tr
                          key={`${s.nominalSizeId}-${s.stockLength}`}
                          className="bg-white/50 dark:bg-slate-800/30 even:bg-transparent dark:even:bg-slate-800/20"
                        >
                          <td className="py-2 px-4 text-slate-700 dark:text-slate-200">
                            {shortNominalName(STOCK_PROFILES.find((p) => p.id === s.nominalSizeId)?.name ?? s.nominalSizeId)}
                          </td>
                          <td className="py-2 px-4 text-slate-900 dark:text-slate-100 font-medium">
                            {formatStockLength(s.stockLength)}
                          </td>
                          <td className="py-2 px-4">
                            <input
                              type="number"
                              min={1}
                              value={s.quantity}
                              onChange={(e) =>
                                updateBoardQuantity(
                                  s.nominalSizeId,
                                  s.stockLength,
                                  parseInt(e.target.value, 10) || 0
                                )
                              }
                              className={`w-16 px-2 py-1.5 text-sm ${fieldClassName}`}
                              aria-label={`Quantity for ${formatStockLength(s.stockLength)}`}
                            />
                          </td>
                          <td className="py-2 px-2">
                            <button
                              type="button"
                              onClick={() => removeBoardScrap(s.nominalSizeId, s.stockLength)}
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
                      {boardDraft && (
                        <tr className="bg-slate-50/80 dark:bg-slate-700/30">
                          <td className="py-2 px-4">
                            <select
                              value={boardDraft.nominalSizeId}
                              onChange={(e) => {
                                setBoardDraft((d) => (d ? { ...d, nominalSizeId: e.target.value } : d))
                                setDraftError(null)
                              }}
                              className={`w-full min-w-[8rem] px-2 py-1.5 text-sm ${fieldClassName}`}
                              aria-label="Nominal size"
                            >
                              {STOCK_PROFILES.map((profile) => (
                                <option key={profile.id} value={profile.id}>
                                  {shortNominalName(profile.name)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-4">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder='Required (e.g. 96")'
                              value={boardDraft.length}
                              onChange={(e) => {
                                setBoardDraft((d) => (d ? { ...d, length: e.target.value } : null))
                                setDraftError(null)
                              }}
                              onBlur={() => {
                                if (!boardDraft.length.trim()) setDraftError("Length is required.")
                              }}
                              className={`w-full max-w-[6rem] px-2 py-1.5 text-sm ${fieldClassName}`}
                              aria-label="Length (inches)"
                              autoFocus
                            />
                          </td>
                          <td className="py-2 px-4">
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="Required"
                              value={boardDraft.quantity}
                              onChange={(e) => {
                                setBoardDraft((d) =>
                                  d ? { ...d, quantity: e.target.value.replace(/\D/g, "") } : null
                                )
                                setDraftError(null)
                              }}
                              onBlur={() => {
                                if (!boardDraft.quantity.trim()) setDraftError("Quantity is required.")
                              }}
                              className={`w-full max-w-[4rem] px-2 py-1.5 text-sm ${fieldClassName}`}
                              aria-label="Quantity"
                            />
                          </td>
                          <td className="py-2 px-2 flex gap-1">
                            <button
                              type="button"
                              onClick={addBoardDraft}
                              className="p-1.5 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                              aria-label="Add"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 5v14M5 12h14" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setBoardDraft(null)
                                setDraftError(null)
                              }}
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
            {boardDraft && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Length and quantity are required to add board scrap.
              </p>
            )}
            {draftError && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{draftError}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {!boardDraft ? (
                <button
                  type="button"
                  onClick={() =>
                    setBoardDraft({
                      nominalSizeId: STOCK_PROFILES[0]?.id ?? "2x4",
                      length: "",
                      quantity: "",
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-700/60 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600/60"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3v10M3 8h10" />
                  </svg>
                  Add board
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
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
  )
}
