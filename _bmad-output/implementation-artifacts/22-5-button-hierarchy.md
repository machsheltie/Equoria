# Story 22.5: Button Hierarchy

**Epic:** 22 — Celestial Night Foundation
**Story Key:** 22-5-button-hierarchy
**Status:** done
**Last Updated:** 2026-04-03

---

## User Story

As a player,
I want buttons to have distinct visual hierarchy — gold for primary actions, frosted for secondary, text for tertiary,
So that I always know which button is the most important action on any screen.

---

## Acceptance Criteria

- [x] **AC1:** `default` variant has gold gradient background with horseshoe arc decorations (`btn-cobalt`), gold text, rounded corners, glow on hover
- [x] **AC2:** `secondary` variant has frosted glass background (`glass-panel-subtle`), navy border, cream text, border brightens on hover
- [x] **AC3:** `ghost` variant has no background, `--gold-light` colored text (7.1:1 contrast on `--bg-deep-space`), underline on hover
- [x] **AC4:** `destructive` variant has dark red background, `--status-error` text, no gold accents
- [x] **AC5:** `default` size minimum height `h-11` (44px)
- [x] **AC6:** `sm` size `h-9` (36px) with invisible `after:-inset-1` touch-target expansion to 44px
- [x] **AC7:** All buttons have minimum 44×44px touch targets (`default`, `icon` = `h-11`; `sm` has expansion)
- [x] **AC8:** `outline` variant defined (navy border, cream text, gold border on hover)
- [x] **AC9:** `glass` variant defined (glass panel surface, cream text, gold border hover)
- [x] **AC10:** Focus indicators use gold `box-shadow` ring (`focus-visible:ring-[var(--gold-bright)]`)
- [x] **AC11:** Disabled state uses `disabled:text-[var(--text-muted)]` with `disabled:opacity-40`
- [x] **AC12:** `--gold-light` (7.1:1) used for ghost/link text; `--gold-primary` (4.2:1) NOT used for body-size text
- [x] **AC13:** Zero ESLint errors

---

## Tasks/Subtasks

- [x] **T1:** Restyle `button.tsx` variants under `.celestial` scope
  - [x] T1.1: `default` → `btn-cobalt` + gold gradient, `h-11`
  - [x] T1.2: `secondary` → `glass-panel-subtle`, navy border, cream text
  - [x] T1.3: `ghost` → transparent, `--gold-light` text, `hover:underline`
  - [x] T1.4: `link` → transparent, `--gold-light` text, underline
  - [x] T1.5: `outline` → navy border, cream text, gold border on hover
  - [x] T1.6: `glass` → `glass-panel`, cream text, gold border hover
  - [x] T1.7: `destructive` → red-tinted glass, `--status-error` text
  - [x] T1.8: Size table: `default` = `h-11 px-4 py-2`, `sm` = `h-9 px-3` + touch expansion, `lg` = `h-12 px-8`, `icon` = `h-11 w-11`
  - [x] T1.9: Disabled state: `disabled:text-[var(--text-muted)] disabled:opacity-40`
  - [x] T1.10: Focus ring: `focus-visible:ring-[var(--gold-bright)]`

- [x] **T2:** Write `button.test.tsx` (18 tests)
  - [x] T2.1: All 7 variant class assertions
  - [x] T2.2: All size variants
  - [x] T2.3: Contrast requirement assertions (ghost/link use `--gold-light`)
  - [x] T2.4: Disabled state assertions
  - [x] T2.5: Keyboard interaction (Enter, Space, disabled non-fire)
  - [x] T2.6: `asChild` forwarding to `<a>` element

---

## Dev Notes

- `btn-cobalt` class (horseshoe arcs) already defined in `index.css` from Epic 18-5 — reused for `default` variant
- `--gold-light` = `#e8d48b` (7.1:1 contrast on `--bg-deep-space`) — used for ghost/link per spec note
- `--gold-primary` = 4.2:1 — spec explicitly forbids this for body-size text; used only in large display text and decorative gradients
- `sm` touch target: `after:absolute after:-inset-1 after:content-[""]` expands the 36px button to 44px hit area
- All variants use CSS custom properties from `tokens.css` only — no raw hex/rgba in component

---

## File List

- `frontend/src/components/ui/button.tsx` _(modified)_
- `frontend/src/components/ui/__tests__/button.test.tsx` _(new — 18 tests)_
- `_bmad-output/implementation-artifacts/sprint-status.yaml` _(modified)_

---

---

## TEA Quality Gates (2026-04-10 — retroactive)

**TEA:ATDD** — ACCEPTABLE. Task T2 (write tests) is listed alongside T1 (implement), indicating tests were part of the story. 18 tests written covering all 7 variants, all 4 sizes, accessibility (focus ring, disabled, keyboard), and `asChild` forwarding.

**TEA:TA** — PASS. All ACs have test coverage. Tests assert both class presence and absence (e.g. ghost uses `--gold-light`, NOT `--gold-primary`). Keyboard tests cover Enter, Space, and disabled non-fire. `asChild` forwarding verified. One minor gap: no test for the `xl` size variant (xl is in the implementation but not tested).

**TEA:RV** — PASS. Tests are clean, readable, and focused. Class-based assertions are appropriate for a styling-heavy component where jsdom doesn't compute Tailwind CSS. `userEvent.setup()` used correctly for async keyboard interactions. `toBeDisabled()` assertion correctly tests the HTML disabled attribute.

---

## Code Review (2026-04-10 — retroactive)

- [x] [Review][Decision] **Raw rgba values in `secondary` and `glass` variants** — **RESOLVED (Option B — tokenize)**: Added 5 named tokens to `tokens.css` (`--btn-secondary-border`, `--btn-secondary-border-hover`, `--btn-secondary-bg-hover`, `--btn-glass-border`, `--btn-glass-border-hover`) using canonical `rgba(200,168,78,...)` values. `button.tsx` migrated to use tokens. [`frontend/src/styles/tokens.css`, `frontend/src/components/ui/button.tsx`]
- [x] [Review][Decision] **Duplicate JSDoc comment blocks on `ghost` and `link` variants** — **RESOLVED (A — clean up)**: Removed leading stub JSDoc block from each; kept the informative second block with contrast-ratio rationale. [`frontend/src/components/ui/button.tsx`]

---

## Change Log

| Date       | Change                                     |
| ---------- | ------------------------------------------ |
| 2026-04-03 | Story implemented; spec gaps patched; tests written |
| 2026-04-10 | Retroactive TEA audit + code review — 2 decisions pending |
| 2026-04-10 | Code review decisions resolved — tokenized button rgba values, cleaned duplicate comments |
