import { useCallback, useEffect, useRef, useState } from "react";
import {
  STOCK_PROFILES,
  formatStockLength,
  DEFAULT_KERF_INCHES,
  DEFAULT_MAX_BOARD_LENGTH_INCHES,
} from "./lib/stock-profiles";
import { mergeScrapEntries, type ScrapEntry } from "./lib/optimizer";
import {
  createBoardGroup,
  createDefaultGroup,
  type MaterialGroup,
} from "./lib/material-groups";
import {
  saveGroupsToStorage,
  loadGroupsFromStorage,
  parseGroupsFromJSON,
  serializeGroups,
} from "./lib/persistence";
import {
  generateProjectResult,
  type ProjectResult,
} from "./lib/project-result";
import { MaterialGroupSection } from "./components/MaterialGroupSection";
import { ScrapInventoryModal } from "./components/ScrapInventoryModal";
import { UnifiedResultsView } from "./components/UnifiedResultsView";

const SCRAP_STORAGE_KEY = "cut-optimizer-scrap";
const THEME_STORAGE_KEY = "cut-optimizer-theme";
type ThemeMode = "light" | "dark";

function detectSystemTheme(): ThemeMode {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return "dark";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function readStoredTheme(): ThemeMode | null {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return raw === "light" || raw === "dark" ? raw : null;
  } catch {
    return null;
  }
}

function getInitialTheme(): ThemeMode {
  return readStoredTheme() ?? detectSystemTheme();
}

function loadScrapFromStorage(): ScrapEntry[] {
  try {
    const raw = localStorage.getItem(SCRAP_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const asEntries = parsed
      .map((x): ScrapEntry | null => {
        if (typeof x !== "object" || x === null) return null;
        const candidate = x as Record<string, unknown>;
        if (
          candidate.materialType === "board" &&
          typeof candidate.nominalSizeId === "string" &&
          typeof candidate.stockLength === "number" &&
          typeof candidate.quantity === "number"
        ) {
          return {
            materialType: "board",
            nominalSizeId: candidate.nominalSizeId,
            stockLength: candidate.stockLength,
            quantity: candidate.quantity,
          };
        }
        if (
          candidate.materialType === "sheet" &&
          typeof candidate.width === "number" &&
          typeof candidate.height === "number" &&
          typeof candidate.thickness === "string" &&
          typeof candidate.quantity === "number"
        ) {
          return {
            materialType: "sheet",
            width: candidate.width,
            height: candidate.height,
            thickness: candidate.thickness,
            quantity: candidate.quantity,
          };
        }
        if (
          typeof candidate.stockLength === "number" &&
          typeof candidate.quantity === "number"
        ) {
          return {
            materialType: "board",
            nominalSizeId: STOCK_PROFILES[0]?.id ?? "2x4",
            stockLength: candidate.stockLength,
            quantity: candidate.quantity,
          };
        }
        return null;
      })
      .filter((x): x is ScrapEntry => x !== null);
    return mergeScrapEntries(asEntries);
  } catch {
    return [];
  }
}

function saveScrapToStorage(scrap: ScrapEntry[]) {
  try {
    localStorage.setItem(SCRAP_STORAGE_KEY, JSON.stringify(scrap));
  } catch {
    // ignore
  }
}

function App() {
  // ── Groups state with undo/redo ─────────────────────────────────────────
  const [groups, setGroupsRaw] = useState<MaterialGroup[]>(
    () => loadGroupsFromStorage() ?? [createDefaultGroup()]
  );
  const [undoPast, setUndoPast] = useState<MaterialGroup[][]>([]);
  const [undoFuture, setUndoFuture] = useState<MaterialGroup[][]>([]);

  /** Update groups, persist, and clear redo stack. */
  const setGroups = useCallback(
    (next: MaterialGroup[] | ((prev: MaterialGroup[]) => MaterialGroup[])) => {
      setGroupsRaw((prev) => {
        const value = typeof next === "function" ? next(prev) : next;
        saveGroupsToStorage(value);
        return value;
      });
      setUndoFuture([]);
    },
    []
  );

  /** Snapshot the current groups into the undo stack before a destructive action. */
  const snapshotForUndo = useCallback(() => {
    setUndoPast((prev) => [...prev, groups]);
    setUndoFuture([]);
  }, [groups]);

  const canUndo = undoPast.length > 0;
  const canRedo = undoFuture.length > 0;

  const undo = useCallback(() => {
    if (undoPast.length === 0) return;
    const previous = undoPast[undoPast.length - 1];
    setUndoPast((p) => p.slice(0, -1));
    setUndoFuture((f) => [groups, ...f]);
    setGroupsRaw(previous);
    saveGroupsToStorage(previous);
  }, [undoPast, groups]);

  const redo = useCallback(() => {
    if (undoFuture.length === 0) return;
    const next = undoFuture[0];
    setUndoFuture((f) => f.slice(1));
    setUndoPast((p) => [...p, groups]);
    setGroupsRaw(next);
    saveGroupsToStorage(next);
  }, [undoFuture, groups]);

  // Keep refs so keyboard handler never goes stale
  const undoRef = useRef(undo);
  undoRef.current = undo;
  const redoRef = useRef(redo);
  redoRef.current = redo;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        undoRef.current();
      }
      if (mod && (e.key === "y" || (e.shiftKey && e.key === "z"))) {
        e.preventDefault();
        redoRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // ── Group CRUD ───────────────────────────────────────────────────────────
  const [projectResult, setProjectResult] = useState<ProjectResult | null>(
    null,
  );
  const [scrapInventory, setScrapInventoryState] = useState<ScrapEntry[]>(() =>
    loadScrapFromStorage(),
  );
  const [useScrapWhenGenerating, setUseScrapWhenGenerating] = useState(true);
  const [scrapModalOpen, setScrapModalOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme());
  const [lastRunScrapNote, setLastRunScrapNote] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const setScrapInventory = (
    next: ScrapEntry[] | ((prev: ScrapEntry[]) => ScrapEntry[]),
  ) => {
    setScrapInventoryState((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      saveScrapToStorage(value);
      return value;
    });
  };

  const updateGroup = (
    id: string,
    updater: (g: MaterialGroup) => MaterialGroup,
  ) => {
    setGroups((prev) => prev.map((g) => (g.id === id ? updater(g) : g)));
  };

  const addMaterialGroup = () => {
    setGroups((prev) => [...prev, createBoardGroup()]);
  };

  const removeGroup = (id: string) => {
    if (groups.length <= 1) return;
    snapshotForUndo();
    setGroups((prev) => prev.filter((g) => g.id !== id));
  };

  // ── Import / Export ──────────────────────────────────────────────────────
  const exportProject = () => {
    const json = JSON.stringify(serializeGroups(groups), null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cut-plan.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result;
        if (typeof text !== "string") throw new Error("Could not read file.");
        const parsed = JSON.parse(text) as unknown;
        const imported = parseGroupsFromJSON(parsed);
        if (!imported) throw new Error("File does not contain valid project data.");
        snapshotForUndo();
        setGroups(imported);
        setImportError(null);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : "Import failed.");
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be re-imported
    e.target.value = "";
  };

  const hasCuts = groups.some(
    (g) => g.materialType === "board" && g.cuts.length > 0,
  );
  const everyGroupHasValidBoardSpec = groups.every(
    (g) =>
      g.materialType !== "board" ||
      (g.boardSpecId && STOCK_PROFILES.some((p) => p.id === g.boardSpecId)),
  );
  const canGenerate = hasCuts && everyGroupHasValidBoardSpec;
  const generationErrors: string[] = [];
  if (!hasCuts)
    generationErrors.push("Add at least one cut to generate a plan.");
  if (!everyGroupHasValidBoardSpec)
    generationErrors.push("Select a board spec for every material group.");

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    if (
      readStoredTheme() !== null ||
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const syncWithSystem = (event: MediaQueryListEvent) =>
      setTheme(event.matches ? "dark" : "light");
    mediaQuery.addEventListener("change", syncWithSystem);
    return () => mediaQuery.removeEventListener("change", syncWithSystem);
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleGenerate = () => {
    const result = generateProjectResult(groups, {
      scrap: useScrapWhenGenerating ? scrapInventory : [],
    });
    setProjectResult(result);

    if (!useScrapWhenGenerating) {
      setLastRunScrapNote("Scrap inventory was not used for this run.");
      return;
    }

    const boardScrap = scrapInventory.filter(
      (s): s is Extract<ScrapEntry, { materialType: "board" }> =>
        s.materialType === "board",
    );
    const nonBoardScrap = scrapInventory.filter(
      (s) => s.materialType !== "board",
    );
    const usedFromScrap = new Map<string, number>();

    for (const diagram of result.diagrams) {
      if (diagram.materialType !== "board" || !diagram.boardSpecId) continue;
      for (const board of diagram.boards) {
        if (board.source === "scrap") {
          const key = `${diagram.boardSpecId}:${board.stockLength}`;
          usedFromScrap.set(key, (usedFromScrap.get(key) ?? 0) + 1);
        }
      }
    }

    const remainingBoardScrap = boardScrap
      .map((entry) => {
        const key = `${entry.nominalSizeId}:${entry.stockLength}`;
        const usedQty = usedFromScrap.get(key) ?? 0;
        const nextQty = entry.quantity - usedQty;
        return nextQty > 0 ? { ...entry, quantity: nextQty } : null;
      })
      .filter(
        (entry): entry is Extract<ScrapEntry, { materialType: "board" }> =>
          entry !== null,
      );

    const nextScrap = mergeScrapEntries([
      ...nonBoardScrap,
      ...remainingBoardScrap,
    ]);
    setScrapInventory(nextScrap);

    const usedCount = [...usedFromScrap.values()].reduce(
      (sum, n) => sum + n,
      0,
    );
    if (usedCount === 0) {
      setLastRunScrapNote("No stored scrap was consumed in this run.");
      return;
    }
    setLastRunScrapNote(
      `Used ${usedCount} scrap board${usedCount === 1 ? "" : "s"} from inventory.`,
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 py-6 px-4 sm:p-6 lg:py-8 lg:px-8 print:bg-white print:py-0 print:px-0 overflow-x-hidden">
      <div className="w-full mx-auto transition-all duration-200 print:max-w-none print:safe-inset print:grid-cols-1 lg:max-w-[1920px] lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-x-10 lg:items-start">
        <div className="space-y-6 print:hidden lg:space-y-8">
          <header className="text-center lg:text-left lg:pt-1 space-y-3">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100">
                One Less Board
              </h1>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mt-1">
                Cross-cut optimization for lumber
              </p>
              <p className="text-sm mt-5 sm:text-base text-slate-600 dark:text-slate-400 mt-1">
                Save one board today. Have one tomorrow.
              </p>
            </div>
            <div className="flex items-center justify-center lg:justify-start gap-1">
              <button
                type="button"
                onClick={undo}
                disabled={!canUndo}
                className="inline-flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700/60 p-2.5 min-h-[44px] min-w-[44px] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600/60 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                aria-label="Undo"
                title="Undo (Ctrl+Z)"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7v6h6" />
                  <path d="M3 13a9 9 0 1 0 2.6-6.36L3 9" />
                </svg>
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={!canRedo}
                className="inline-flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700/60 p-2.5 min-h-[44px] min-w-[44px] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600/60 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                aria-label="Redo"
                title="Redo (Ctrl+Y)"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 7v6h-6" />
                  <path d="M21 13a9 9 0 1 1-2.6-6.36L21 9" />
                </svg>
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700/60 p-2.5 min-h-[44px] min-w-[44px] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600/60 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                aria-label={
                  theme === "dark"
                    ? "Switch to light mode"
                    : "Switch to dark mode"
                }
                title={
                  theme === "dark"
                    ? "Switch to light mode"
                    : "Switch to dark mode"
                }
              >
                {theme === "dark" ? (
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
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                  </svg>
                ) : (
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
                    <path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z" />
                  </svg>
                )}
              </button>
            </div>
          </header>

          <div className="space-y-6 lg:space-y-8">
            {groups.map((group) => (
              <MaterialGroupSection
                key={group.id}
                group={group}
                onUpdateGroup={(updater) => updateGroup(group.id, updater)}
                onRemove={() => removeGroup(group.id)}
                canRemove={groups.length > 1}
                onBeforeDestructiveAction={snapshotForUndo}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={addMaterialGroup}
            className="inline-flex w-full lg:w-auto items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-800/80 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900 print:hidden"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M8 3v10M3 8h10" />
            </svg>
            Add material group
          </button>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={exportProject}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-700/60 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600/60 focus:outline-none focus:ring-2 focus:ring-slate-400"
              title="Export project as JSON"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export
            </button>
            <button
              type="button"
              onClick={() => { setImportError(null); importInputRef.current?.click(); }}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-700/60 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600/60 focus:outline-none focus:ring-2 focus:ring-slate-400"
              title="Import project from JSON"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Import
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportFile}
              aria-label="Import project JSON file"
            />
            {importError && (
              <p className="text-xs text-red-600 dark:text-red-400">{importError}</p>
            )}
          </div>
        </div>

        <div className="mt-8 lg:mt-0 print:mt-0 space-y-4">
          <section className="print:hidden rounded-xl bg-slate-50/80 dark:bg-slate-800/40 p-4 lg:p-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setScrapModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-700/60 px-3 py-2.5 min-h-[44px] text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600/60 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <line x1="10" y1="9" x2="8" y2="9" />
                </svg>
                Scrap inventory
                {scrapInventory.length > 0 && (
                  <span className="rounded-full bg-slate-300 dark:bg-slate-600 px-1.5 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-200">
                    {scrapInventory.reduce((s, b) => s + b.quantity, 0)}
                  </span>
                )}
              </button>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useScrapWhenGenerating}
                  onChange={(e) => setUseScrapWhenGenerating(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Use scrap for this run
                </span>
              </label>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Assumptions: {DEFAULT_KERF_INCHES}" kerf (1/8″) per cut, max board
              length preference defaults to{" "}
              {DEFAULT_MAX_BOARD_LENGTH_INCHES / 12} ft.
            </p>
            {!canGenerate && generationErrors.length > 0 && (
              <ul className="space-y-1 text-sm text-amber-700 dark:text-amber-300">
                {generationErrors.map((msg) => (
                  <li key={msg}>• {msg}</li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-3.5 min-h-[48px] text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-600 touch-manipulation"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <line x1="10" y1="9" x2="8" y2="9" />
              </svg>
              Generate plan
            </button>
          </section>
          {projectResult ? (
            <UnifiedResultsView
              result={projectResult}
              scrapNote={lastRunScrapNote}
            />
          ) : (
            <div className="print:hidden px-1 py-2">
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Your shopping list and cut diagrams appear here after you
                generate.
              </p>
            </div>
          )}
        </div>

        {scrapModalOpen && (
          <ScrapInventoryModal
            scrapInventory={scrapInventory}
            setScrapInventory={setScrapInventory}
            onClose={() => setScrapModalOpen(false)}
            formatStockLength={formatStockLength}
          />
        )}
      </div>
      <footer className="print:hidden mt-8 text-center text-xs text-slate-500 dark:text-slate-400">
        <p>
          © 2026{" "}
          <a
            href="https://jodylecompte.com"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-slate-700 dark:hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 rounded-sm"
          >
            JodyLeCompte.com
          </a>
        </p>
        <p className="mt-1">
          Open source and freely available on{" "}
          <a
            href="https://github.com/jodylecompte/one-less-board"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-slate-700 dark:hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 rounded-sm"
          >
            GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;
