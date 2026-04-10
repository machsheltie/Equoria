---
id: 22-4
title: Glass Panel & Surface Updates
epic: 22
status: done
---

# Story 22-4: Glass Panel & Surface Updates

**Status:** done

## Acceptance Criteria

- [x] `.glass-panel` scoped under `.celestial` — `blur(12px)`, `rgba(15,23,42,0.6)` bg, `rgba(148,163,184,0.2)` border, `border-radius: 12px`
- [x] `.glass-panel:hover` brightens border
- [x] `.glass-panel-heavy` variant exists (higher opacity + `blur(16px)`)
- [x] `.glass-panel-subtle` — NO `backdrop-filter`, solid `rgba(15,23,42,0.4)` bg, gold border `rgba(200,168,78,0.1)`
- [x] Single-blur-layer rule documented in CSS comment
- [x] Nested glass panels use solid bg (no stacked blurs)
- [x] Visual regression screenshot test covering all three variants
- [x] `npm run lint` exits 0 for new/modified files

## Dev Agent Record

### Files Changed

- `frontend/src/index.css` — Scoped all `.glass-panel*` classes under `.celestial`; fixed `border-radius` to `--radius-md` (12px); fixed `.glass-panel-subtle` to remove `backdrop-filter` and use gold border; expanded single-blur-layer rule comment
- `frontend/src/styles/tokens.css` — Updated `--glass-surface-subtle-bg` from `rgba(15,23,42,0.35)` to `rgba(15,23,42,0.4)`
- `tests/e2e/glass-panel-surface.spec.ts` — New visual regression test (created)

### Completion Notes

All three glass panel variants are now properly scoped under `.celestial`. The critical fix is `.glass-panel-subtle` which previously had `backdrop-filter: blur(6px)` — violating the single-blur-layer rule. It now uses a solid semi-transparent background with a gold border, making it safe to nest inside any blurred parent container without performance or visual stacking issues.

### TEA Quality Gates (2026-04-10 — retroactive)

**TEA:ATDD** — SKIPPED (pre-mandate). No commits-first evidence. E2E tests in `glass-panel-surface.spec.ts` were written as part of the story's deliverables.

**TEA:TA** — PASS. E2E tests cover: no backdrop-filter on `.glass-panel-subtle` (single-blur-layer rule), `.glass-panel` has backdrop-filter blur, login page at 1440px screenshot, login page at 375px screenshot. All three glass variants verified simultaneously. Screenshot regression tests guard against visual regressions.

**TEA:RV** — PASS. Tests use DOM injection (`page.evaluate`) to add fixture panels without depending on a specific page route — smart approach that isolates the CSS logic. `hasCelestial` assertion ensures test context is valid before proceeding. Screenshot tests use `maxDiffPixelRatio: 0.02` — appropriate tolerance for pixel-level rendering differences. No flakiness concerns identified.

---

### Review Findings

- [x] [Review][Patch] Duplicated `shouldBeCelestial` derivation between `useLayoutEffect` and `useEffect` — extracted `deriveTheme()` helper, single source of truth [CelestialThemeProvider.tsx]
- [x] [Review][Patch] `useLayoutEffect` fired on every `searchParams` change — now depends on `themeParam` only [CelestialThemeProvider.tsx]
- [x] [Review][Patch] `localStorage.getItem` inside `useLayoutEffect` without try/catch — extracted `safeLocalStorageGet()` helper with try/catch fallback [CelestialThemeProvider.tsx]
