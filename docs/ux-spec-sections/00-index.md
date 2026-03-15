# UX Spec Sections — Implementation Index

**Source:** `docs/ux-design-specification.md` (2119 lines)
**Purpose:** Broken into small, individually-consumable sections for step-by-step implementation.

## Section Files

| #   | File                             | Spec Lines            | Status  | Description                                                               |
| --- | -------------------------------- | --------------------- | ------- | ------------------------------------------------------------------------- |
| 01  | `01-design-tokens.md`            | 80-155, 755-960       | done    | Color palette, typography, spacing, elevation, gradients                  |
| 02  | `02-4-layer-strategy.md`         | 496-562               | pending | Design system choice, 4-layer transformation, customization strategy      |
| 03  | `03-shadcn-restyling.md`         | 1438-1458, 1695-1710  | pending | 13 shadcn components: exact visual overrides per component                |
| 04  | `04-global-atmosphere.md`        | L1 scope + 1479-1491  | pending | Layer 1: StarfieldBackground, body gradient, global CSS                   |
| 05  | `05-frosted-panel-system.md`     | L2 scope + UI-3 ref   | pending | Layer 2: FrostedPanel replacing all Cards, glass system                   |
| 06  | `06-typography-system.md`        | 827-859               | pending | Layer 3: Cinzel + Inter, type scale, typography rules                     |
| 07  | `07-navigation-layout.md`        | 1828-1858, responsive | pending | Navigation: hamburger + breadcrumbs, hub-spoke, aside panel               |
| 08  | `08-hub-dashboard.md`            | 563-754               | pending | Hub page: Next Actions bar, horse cards, aside panel, WYAG                |
| 09  | `09-horse-card-design.md`        | focus group reqs      | pending | Horse cards: portrait, stats, traits, care strip, narrative chip, lineage |
| 10  | `10-component-new-custom.md`     | 1477-1738             | pending | 13 new custom components: specs and implementation order                  |
| 11  | `11-button-feedback-patterns.md` | 1739-1910             | pending | Button hierarchy, feedback tiers, form patterns, empty/loading states     |
| 12  | `12-journey-flows.md`            | 1086-1436             | pending | 6 user journey flows with decision trees                                  |
| 13  | `13-responsive-accessibility.md` | 1932-2120             | pending | Responsive breakpoints, a11y strategy, testing                            |

## How to Use

1. Run `/ux-step` to see which section is next
2. Read ONLY that section file
3. Implement what it specifies
4. Mark it `done` in this file
5. Run `/ux-step` again for the next section
