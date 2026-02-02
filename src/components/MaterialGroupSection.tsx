import { useEffect, useRef, useState } from "react"
import * as Select from "@radix-ui/react-select"
import {
  mergeCuts,
  isValidLength,
  isValidQuantity,
  parseLength,
  parseQuantity,
  type CutRequirement,
} from "../lib/cuts"
import {
  STOCK_PROFILES,
  DEFAULT_MAX_BOARD_LENGTH_INCHES,
  BOARD_LENGTH_PREFERENCE_OPTIONS,
} from "../lib/stock-profiles"
import { getBoardGroupLabel, type MaterialGroup } from "../lib/material-groups"
import {
  fieldClassName,
  selectContentClassName,
  selectItemClassName,
  selectTriggerClassName,
} from "./uiClasses"

export function MaterialGroupSection({
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
    <section className="rounded-xl bg-white/90 dark:bg-slate-800/60 overflow-hidden shadow-sm">
      <div className="px-5 pt-5 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <span className="inline-flex items-center rounded-md bg-amber-100/80 dark:bg-amber-900/30 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
              Board group
            </span>
            <div className="relative group">
              <input
                type="text"
                value={group.label}
                onChange={(e) =>
                  onUpdateGroup((g) => ({
                    ...g,
                    label: e.target.value,
                    isLabelUserDefined: true,
                  }))
                }
                className="bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-500 focus:border-slate-400 dark:focus:border-slate-400 focus:outline-none px-1 py-0.5 pr-6 text-lg font-semibold text-slate-800 dark:text-slate-200 min-w-[8rem] cursor-text"
                aria-label="Group label"
                title="Edit group label"
              />
              <span
                className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 opacity-50 group-hover:opacity-80 group-focus-within:opacity-100 transition-opacity"
                aria-hidden
              >
                ✎
              </span>
            </div>
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

      <div className="border-t border-slate-200/80 dark:border-slate-600/50" aria-hidden />

      <div className="p-5 space-y-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-4">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Board spec (nominal size)
            </label>
            <Select.Root
              value={group.boardSpecId || undefined}
              onValueChange={(id) =>
                onUpdateGroup((g) => ({
                  ...g,
                  boardSpecId: id,
                  label: g.isLabelUserDefined ? g.label : getBoardGroupLabel(id),
                }))
              }
            >
              <Select.Trigger className={selectTriggerClassName}>
                <Select.Value placeholder="Choose profile..." />
                <Select.Icon>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content position="popper" sideOffset={4} className={selectContentClassName}>
                  {STOCK_PROFILES.map((profile) => (
                    <Select.Item key={profile.id} value={profile.id} className={selectItemClassName}>
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
            <Select.Trigger className={selectTriggerClassName}>
              <Select.Value />
              <Select.Icon>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content position="popper" sideOffset={4} className={selectContentClassName}>
                {BOARD_LENGTH_PREFERENCE_OPTIONS.map(({ feet, inches }) => (
                  <Select.Item
                    key={inches}
                    value={String(inches)}
                    className={selectItemClassName}
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
      </div>
    </section>
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

  const canAddDraftCut =
    !!group.draftCut &&
    isValidLength(parseLength(group.draftCut.length)) &&
    isValidQuantity(parseQuantity(group.draftCut.quantity))

  const addDraftCut = () => {
    onUpdateGroup((g) => {
      if (!g.draftCut) return g
      const length = parseLength(g.draftCut.length)
      const quantity = parseQuantity(g.draftCut.quantity)
      if (!isValidLength(length) || !isValidQuantity(quantity)) return g
      return {
        ...g,
        cuts: mergeCuts([...g.cuts, { length, quantity, materialType: "board" }]),
        draftCut: { length: "", quantity: "" },
      }
    })
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
                    canAdd={canAddDraftCut}
                    onAdd={addDraftCut}
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
          className={`w-full max-w-[6rem] px-2 py-1.5 text-sm ${fieldClassName} ${
            lengthError ? "border-red-500 focus:ring-red-500" : ""
          }`}
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
          className={`w-full max-w-[4rem] px-2 py-1.5 text-sm ${fieldClassName} ${
            qtyError ? "border-red-500 focus:ring-red-500" : ""
          }`}
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
  canAdd,
  onAdd,
  onCancel,
}: {
  draft: { length: string; quantity: string }
  onChange: (d: { length: string; quantity: string }) => void
  canAdd: boolean
  onAdd: () => void
  onCancel: () => void
}) {
  const lengthRef = useRef<HTMLInputElement>(null)

  const handleAdd = () => {
    if (!canAdd) return
    onAdd()
    requestAnimationFrame(() => {
      lengthRef.current?.focus()
    })
  }

  return (
    <tr className="bg-slate-50/80 dark:bg-slate-700/30">
      <td className="py-2 px-4">
        <input
          ref={lengthRef}
          type="text"
          inputMode="decimal"
          placeholder="e.g. 24"
          value={draft.length}
          onChange={(e) => onChange({ ...draft, length: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canAdd) {
              e.preventDefault()
              handleAdd()
            }
          }}
          className={`w-full max-w-[6rem] px-2 py-1.5 text-sm ${fieldClassName}`}
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
          onChange={(e) => onChange({ ...draft, quantity: e.target.value.replace(/\D/g, "") })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canAdd) {
              e.preventDefault()
              handleAdd()
            }
          }}
          className={`w-full max-w-[4rem] px-2 py-1.5 text-sm ${fieldClassName}`}
          aria-label="New cut quantity"
        />
      </td>
      <td className="py-2 px-2 flex gap-1">
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          className="p-1.5 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Add cut"
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
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
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
