# Changelog

## Group 3 — Optimizer Core

### Better waste accounting
Two improvements to the cutting stock optimizer:

**Bug fix:** Cuts longer than the shortest available stock length were silently dropped even when a longer board would fit (e.g. a 100" cut was discarded when 120" boards were available). Fixed — the optimizer now correctly routes oversized cuts to the smallest board that fits them, and only drops cuts that exceed every allowed length.

**Multi-strategy packing:** The optimizer now tries three cut orderings for the new-board phase and keeps whichever produces the best result:
- Largest-first (Best Fit Decreasing — the previous single strategy)
- Smallest-first
- Interleaved large/small (alternates pulling from each end, which helps pair long cuts with short fillers on the same board)

Winner is chosen by fewest new boards required, then least total stock material consumed.

---

## Group 2 — Data Management

### Input persistence
Cut lists and group configuration are now saved to `localStorage` automatically. Your work survives page reloads.

### Import / Export
Two buttons below "Add material group" let you save your cut plan as a `.json` file and reload it later (or share it). Import validates the file and shows an error message if the file isn't a valid project.

### Undo / Redo
Undo (Ctrl+Z) and Redo (Ctrl+Y / Ctrl+Shift+Z) are available for destructive actions: removing a material group and deleting individual cuts. Buttons also appear in the header toolbar.

---

## Group 1 — Input & Configuration

### More board types
Added six new profiles to the board spec selector:
- 1×4, 1×8, 1×12 dimensional
- 2×10, 2×12 dimensional
- 5/4 decking

### Fraction input support
Cut lengths now accept fraction notation in addition to decimals:
- Simple fractions: `1/2`, `3/4`
- Mixed numbers (space or hyphen): `3 1/2`, `47 3/4`, `3-1/2`
- Plain decimals still work: `48`, `48.5`

### Kerf customization
Each board group now has a kerf override field below the board spec selector. Leave it blank to use the spec default (1/8″). A "reset to default" link appears when overridden.

### Custom board lengths
Each board group now has an "Additional stock lengths" section. Enter a length in inches (fractions accepted), press Add or Enter to add it as a chip. Click × to remove. Custom lengths extend the spec's standard lengths and are passed to the optimizer.
