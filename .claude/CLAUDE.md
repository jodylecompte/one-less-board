# One Less Board — CLAUDE.md

## What This Project Is

A web-based cross-cut optimization tool for lumber. Users enter the cuts they need (length + quantity), select a board spec, and the optimizer generates a shopping list and visual cut diagrams that minimize wood waste. Key features: scrap inventory management (use leftovers first), multiple material groups, dark/light mode, print-friendly output.

Live at: https://onelessboard.com

---

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | React 19 + TypeScript 5 (strict) |
| Build | Vite 7 |
| Styling | Tailwind CSS 4 + PostCSS |
| UI primitives | Radix UI (select dropdown) |
| Package manager | npm |
| Linting | ESLint 9 (flat config) |
| Testing | **Vitest** (to be added) |

---

## Commands

```bash
npm run dev        # Dev server with HMR
npm run build      # tsc -b && vite build
npm run lint       # ESLint
npm run preview    # Preview production build
npm run test       # Vitest (once configured)
```

---

## Project Structure

```
src/
  main.tsx                   # Entry point
  App.tsx                    # Root state: groups, scrap, theme, result
  index.css                  # Tailwind + custom print styles
  lib/
    optimizer.ts             # Core 1D bin-packing algorithm (pure, no React)
    stock-profiles.ts        # BoardSpec definitions + constants + formatters
    material-groups.ts       # MaterialGroup types + factory functions
    cuts.ts                  # CutRequirement types + validators/parsers
    project-result.ts        # generateProjectResult() — aggregates per-group results
    presets.ts               # Informational board preset data
  components/
    MaterialGroupSection.tsx # Input form for one material group
    ScrapInventoryModal.tsx  # Scrap inventory CRUD modal
    UnifiedResultsView.tsx   # Results: shopping list + cut diagrams
    uiClasses.ts             # Shared Tailwind class constants
```

---

## Key Architecture

**Data flow:**
1. User enters cuts via `MaterialGroupSection` → stored in `groups` state (App.tsx)
2. "Generate plan" calls `generateProjectResult(groups, { scrap })` (project-result.ts)
3. Per group: `optimizeCuts()` dispatches to `optimizeBoardCuts()` (optimizer.ts)
4. Optimizer: Phase 1 = place cuts on scrap boards; Phase 2 = place remaining on new boards
5. Results rendered by `UnifiedResultsView` (shopping list + board diagrams)

**Optimizer algorithm** (`optimizer.ts`):
- 1D bin-packing, greedy best-fit (minimize remaining space per board)
- Scrap-first: tries scrap pool before opening new stock
- Prefers boards ≤ `preferredMaxLengthInches`; falls back to shortest that fits
- Kerf: 0.125" (1/8") default

**Persistence** (localStorage):
- `cut-optimizer-scrap` — scrap inventory (JSON)
- `cut-optimizer-theme` — "light" | "dark"

---

## Potential Improvements

### High Priority

1. **Vitest test suite** — Zero tests currently. All `lib/` files are pure functions; excellent candidates. See Testing Plan below.

2. **Sheet/plywood optimizer** — `materialType: "sheet"` is scaffolded but returns `[]`. A 2D bin-packing solver (guillotine cut or maximal-rectangles) would complete this feature.

3. **Custom board lengths** — Users can only pick from predefined `allowedLengths`. A free-form input for custom stock lengths would cover non-standard lumber (e.g. 14 ft).

4. **Input persistence** — Groups and cuts are reset on page reload. Save `groups` to localStorage so work isn't lost.

5. **Undo/redo** — Destructive actions (remove group, remove cut) have no undo.

### Medium Priority

6. **Fraction input support** — Cuts require decimal inches. Many woodworkers think in fractions (e.g. `3 1/2`). A fraction parser would reduce friction.

7. **Import/export project** — Allow saving/loading the cut list as JSON for sharing or archiving.

8. **Better waste accounting** — The optimizer uses greedy best-fit, which is fast but suboptimal. A smarter algorithm (e.g. First Fit Decreasing + column generation or simulated annealing for small inputs) could reduce board count.

9. **Kerf customization** — Kerf is hardcoded at 0.125". Users with different saws (e.g. track saw at 0.09") would benefit from per-profile overrides.

10. **More board types** — Missing common profiles: 2×10, 2×12, 1×4, 1×8, 1×12, 5/4 decking.

### Low Priority / Polish

11. **Cut diagram scale** — Diagrams use percentage widths; very long boards compress short cuts into invisibly thin bars. A min-px-per-inch scale would improve readability.

12. **Group reordering** — No drag-to-reorder for material groups.

13. **Accessibility audit** — Input tables use `<input>` without explicit `<label>` associations (use `aria-label` or `htmlFor`).

14. **Error boundary** — No React error boundary; a bad state could crash the UI with no recovery path.

15. **Bundle analysis** — No bundle size tracking. Worth adding `vite-bundle-visualizer` to catch regressions.

---

## Testing Plan (Vitest)

### Setup Steps

1. Install: `npm install -D vitest @vitest/coverage-v8`
2. Add `test` script to `package.json`: `"test": "vitest"`, `"test:coverage": "vitest run --coverage"`
3. Add vitest config to `vite.config.ts` (or separate `vitest.config.ts`)

### Test Files to Create

All test files go in `src/lib/__tests__/` or co-located as `*.test.ts`.

#### `cuts.test.ts`
- `isValidLength` — valid numbers, zero, negative, NaN, Infinity
- `isValidQuantity` — valid integers, floats, zero, negative
- `parseLength` / `parseQuantity` — string parsing edge cases
- `mergeCuts` — deduplication, quantity summing, sort order
- `getCutsForMaterial` — filtering by materialType, missing materialType defaults

#### `stock-profiles.test.ts`
- `formatStockLength` — 96→"8 ft", 120→"10 ft", non-12-divisible inches
- `shortNominalName` — strips " dimensional", " hardwood", trims whitespace
- `STOCK_PROFILES` — shape validation (all have id, name, allowedLengths, kerf)

#### `material-groups.test.ts`
- `getBoardGroupLabel` — known profile ids, unknown id fallback
- `createBoardGroup` — default values, overrides applied
- `createSheetGroup` — default values, overrides applied
- `mergeSheetPieces` — deduplication, quantity summing, area-descending sort

#### `optimizer.test.ts` (most critical)
- `mergeScrapBoards` — dedup, skip invalid entries (zero qty, negative length, etc.)
- `mergeScrapSheets` — same for sheets
- `mergeScrapEntries` — mixed board+sheet entries
- `optimizeBoardCuts`:
  - Single cut, single board
  - Multiple cuts that fit one board
  - Multiple cuts requiring multiple boards
  - Kerf accounted for correctly
  - Scrap-first: uses scrap before new boards
  - Scrap exhausted: spills to new boards
  - Preferred max length respected
  - Cut exceeding preferred max falls back to longer board
  - Invalid inputs filtered (zero length, negative quantity, non-integer quantity)
  - Empty cuts → empty result
  - Empty allowedLengths → empty result
- `classifyRemaining` (via OptimizedBoard output): ≥12" → scrapRemaining, <12" → wasteRemaining
- `optimizeCuts` dispatcher: routes board → `optimizeBoardCuts`, sheet → `[]`

#### `project-result.test.ts`
- `generateProjectResult` — board group: shopping list populated correctly
- Board group with no cuts → no shopping list entry, empty diagram boards
- Sheet group → shoppingListSheets entry, no board shopping list entry
- Scrap used: `source: "scrap"` boards don't appear in shopping list
- Multiple groups of same nominal size → counts aggregated in single shopping list entry
- Shopping list sorted by `NOMINAL_SIZE_ORDER`
- Insurance board flag (if/when moved to lib)

### Coverage Target

Aim for **90%+ line coverage** on all `src/lib/` files. Components can be tested with React Testing Library in a follow-up pass.
