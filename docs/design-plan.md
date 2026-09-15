# Print Request POS — design plan

## Pass 1 (first draft)

- **Color**: charcoal tiers `ink-950 → ink-800` for ground, surfaces and floating layers. Red `#E4141B` for primary actions, the active nav item, live states and critical alerts. White "paper" only for receipts, quotations and print previews.
- **Type**: Space Grotesk for headings and the numeric HUD. Geist for UI text. Geist Mono for order numbers, SKUs and references. `tabular-nums` on every figure.
- **Layout**: a fixed left nav rail and a top bar with the drawer status. Pages are split into bordered panels, and data sits in real tables.
- **Principles**: dense but calm; 1px `ink-700` borders carry the structure; 3px corner radius; a shadow only on things that float.

## Critique against the generic tells

1. *Dashboard as a grid of stat cards* is the most common admin-template tell. **Revise:** show the stats as one "HUD strip", a single bordered band split by vertical rules, like a press console readout.
2. *Rounded cards for every list* (products, customers). **Revise:** use full-width tables with 40px rows, a sticky header and right-aligned tabular figures. Forms open in a side drawer so the table stays in view.
3. *Red everywhere* (badges, icons, headers). **Revise:** red appears in only four places: the primary button, the active nav bar, the live production pulse, and overdue or short amounts. Status chips use ok, warn, info and a neutral grey.
4. *Generic empty states with an illustration.* **Revise:** a faint halftone field with crop marks and one line of shop-voice copy plus an action. Used only on empty states and the login screen.
5. *Motion on every mount.* **Revise:** only the dashboard counters and charts animate on load, once. Everything else animates only in response to an action: adding a cart line, dragging a card, opening a modal, a toast, the palette, or a total changing.

## Pass 2 (tokens as built)

| Token | Dark (signature) | Light (bright counter) |
|---|---|---|
| `--bg` | ink-950 `#0C0E12` | paper-2 `#F6F6F4` |
| `--surface` | ink-900 `#12151B` | `#FFFFFF` |
| `--raised` | ink-800 `#1A1E27` | `#FFFFFF` |
| `--line` | ink-700 `#262B36` | `#DCDDD8` |
| `--line-muted` | ink-600 `#3A4150` | `#C5C7C1` |
| `--fg` | `#ECEEF2` | `#12151B` |
| `--fg-muted` | `#9AA2B1` | `#4F5663` |
| `--fg-faint` | `#5B6472` | `#6E7581` (AA on paper-2) |
| `--accent` | red-500 `#E4141B` | red-600 `#C21016` (AA for text) |

- Radius: `2px` for inputs and chips, `4px` for panels and modals. Nothing pill-shaped except the live dot.
- Type scale (1.25): 12 / 13 / 14 (base UI) / 16 / 20 / 25 / 31 / 39.
- Focus ring: `2px solid var(--red-400)` with a 2px offset, on every interactive element.
- Signature touch: the peeling corner from the logo appears on the paper receipt preview and nowhere else.
