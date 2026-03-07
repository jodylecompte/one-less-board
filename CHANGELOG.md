# Changelog

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
