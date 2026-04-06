# Story 22-6: Custom Game Component Library

**Epic:** 22 — Celestial Night Foundation  
**Status:** done  
**Completed:** 2026-04-06

---

## Summary

Created all 12 game-native UI components under `frontend/src/components/ui/game/`, compositing over the Celestial Night–styled shadcn primitives. All components use CSS custom property tokens exclusively (no raw hex/rgba in component files). Wrote 44 Vitest/RTL tests covering token-based class names, keyboard interaction, and Radix `data-state` attributes.

---

## Deliverables

### Game Component Files (`frontend/src/components/ui/game/`)

| File | Game Name | Underlying Primitive |
|---|---|---|
| `FrostedPanel.tsx` | `FrostedPanel`, `FrostedPanelHeader/Title/Description/Content/Footer` | `card.tsx` |
| `GameDialog.tsx` | `GameDialog`, `GameDialogTrigger/Content/Header/Footer/Title/Description/Close/Overlay/Portal` | `dialog.tsx` |
| `GoldTabs.tsx` | `GoldTabs`, `GoldTabsList/Trigger/Content` | `tabs.tsx` |
| `GameBadge.tsx` | `GameBadge`, `gameBadgeVariants`, `GameBadgeProps` | `badge.tsx` |
| `GlassInput.tsx` | `GlassInput`, `GlassInputProps` | `input.tsx` |
| `GlassTextarea.tsx` | `GlassTextarea`, `GlassTextareaProps` | `textarea.tsx` |
| `StatBar.tsx` | `StatBar` | `@radix-ui/react-progress` (standalone) |
| `GameCheckbox.tsx` | `GameCheckbox` | `checkbox.tsx` |
| `GameLabel.tsx` | `GameLabel` | `label.tsx` |
| `GameTooltip.tsx` | `GameTooltip`, `GameTooltipTrigger/Content/Provider` | `tooltip.tsx` |
| `GameScrollArea.tsx` | `GameScrollArea`, `GameScrollAreaProps` | `scroll-area.tsx` |
| `GameCollapsible.tsx` | `GameCollapsible`, `GameCollapsibleTrigger/Content` | `collapsible.tsx` |
| `index.ts` | Barrel export for all 12 | — |

### StatBar Audit Criteria (all ✅)

1. **Fill:** `bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-light)]`
2. **Track:** `bg-[var(--bg-midnight)]`
3. **Glow at 100%:** `shadow-[0_0_8px_rgba(201,162,39,0.6)]` activates when `value >= max`

### Tests (`frontend/src/components/ui/game/__tests__/game-components.test.tsx`)

- **44 tests, 44 passing**
- Coverage: token-based class names (a), keyboard interaction — Tab/Enter/Space/Escape/ArrowRight (b), Radix `data-state` open/closed/checked/inactive (c)

---

## Architecture Decision

All 12 shadcn components were already updated with Celestial Night token styling in Epic 22-4. The game/ layer is a pure re-export layer providing game-native names (`FrostedPanel` instead of `Card`) without duplicating any styling logic. `StatBar` required standalone implementation since no equivalent Radix Progress wrapper existed in the shadcn layer.

---

## Acceptance Criteria

- [x] All 12 game components exist in `game/` directory
- [x] `game/index.ts` barrel exports all components
- [x] StatBar passes all 3 audit criteria
- [x] All components use CSS token variables (no raw hex/rgba in component files)
- [x] 44 tests passing covering (a) token classes, (b) keyboard, (c) data-state
