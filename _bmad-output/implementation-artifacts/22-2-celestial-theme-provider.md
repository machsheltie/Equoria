# Story 22.2: CelestialThemeProvider

**Epic:** 22 — Celestial Night Foundation
**Story Key:** 22-2-celestial-theme-provider
**Status:** review
**Last Updated:** 2026-03-31

---

## User Story

As a developer,
I want a zero-JS CSS class toggle (`<body class="celestial">`) with a QA URL param,
So that Celestial Night styles can be progressively applied and instantly reverted.

---

## Acceptance Criteria

- [x] **AC1:** Given the app loads, when `localStorage.getItem('equoria-theme')` returns `'celestial'` OR no theme is stored, then `<body>` has `class="celestial"` applied
- [x] **AC2:** Given `?theme=celestial` URL param, theme is applied and persisted to localStorage; param is cleaned from URL
- [x] **AC3:** Given `?theme=default` URL param, celestial class is removed and `localStorage.setItem('equoria-theme', 'default')` is called; param is cleaned from URL
- [x] **AC4:** No React Context is created — pure CSS class, zero state management
- [x] **AC5:** Implementation uses `document.body.classList.add/remove` inside `CelestialThemeProvider.tsx` rendered inside `<Router>` boundary
- [x] **AC6:** Removing the class reverts ALL Celestial Night styles (kill switch via `?theme=default`)
- [x] **AC7:** Existing users with no `equoria-theme` key receive celestial on first load — one-time toast: "Equoria has a new look! Use ?theme=default in the URL to revert."
- [x] **AC8:** Toast shown-once state tracked via `localStorage.setItem('equoria-theme-welcome-shown', 'true')` — never shown again after first display
- [x] **AC9:** Zero ESLint errors (`npm run lint` exits 0 in `frontend/`)

---

## Tasks/Subtasks

- [x] **T1: Implement welcome toast in CelestialThemeProvider.tsx**

  - [x] T1.1: Import `toast` from `sonner`
  - [x] T1.2: Check `localStorage.getItem('equoria-theme-welcome-shown')` before showing toast
  - [x] T1.3: Set `equoria-theme-welcome-shown = 'true'` immediately after triggering toast
  - [x] T1.4: Only show toast when `stored === null` (no prior theme preference) — not when explicitly set to `'celestial'`

- [x] **T2: Add welcome toast tests**

  - [x] T2.1: Mock `sonner` toast in test file
  - [x] T2.2: Test: shows toast once when no prior theme stored
  - [x] T2.3: Test: does NOT show toast a second time (welcome-shown key present)
  - [x] T2.4: Test: does NOT show toast when theme is explicitly `'celestial'`
  - [x] T2.5: Test: does NOT show toast when `?theme=celestial` param is used

- [x] **T3: Verify all 10 tests pass**

---

## Dev Notes

**Architecture:**

- `CelestialThemeProvider.tsx` is already wired into `App.tsx` inside `<BrowserRouter>` — no App.tsx changes needed
- Uses `useSearchParams` (React Router) so must remain inside Router boundary
- No React Context — purely applies/removes `document.body.classList`
- localStorage keys: `'equoria-theme'` (values: `'celestial'` | `'default'`), `'equoria-theme-welcome-shown'` (value: `'true'`)

**Welcome toast logic:**

- Triggers ONLY when `localStorage.getItem('equoria-theme') === null` (never set before)
- Does NOT trigger when stored is `'celestial'` (user explicitly chose it) or `'default'` (user opted out)
- Does NOT trigger on `?theme=celestial` param path (URL param takes priority branch)
- `WELCOME_SHOWN_KEY` set to `'true'` immediately — safe against double renders / StrictMode

---

## Dev Agent Record

### Implementation Plan

1. Updated `CelestialThemeProvider.tsx`:
   - Added `toast` import from `sonner`
   - Extracted localStorage key constants (`THEME_KEY`, `WELCOME_SHOWN_KEY`)
   - Added welcome toast logic in the `stored === null` branch (first-time visitor)
2. Updated `CelestialThemeProvider.test.tsx`:
   - Added `vi.mock('sonner')` to prevent jsdom errors
   - Added 4 new welcome-toast tests (show once, not twice, not when explicit, not via param)
   - Existing 6 tests unchanged and passing

### Completion Notes

Story 22.2 complete. All 10 tests pass.

- `CelestialThemeProvider.tsx` manages `body.celestial` via URL param → localStorage → default (celestial)
- Welcome toast shown once to first-time visitors with no stored preference
- No React Context, no state management — pure side-effect component returning null

---

## File List

- `frontend/src/components/theme/CelestialThemeProvider.tsx` _(modified — added welcome toast)_
- `frontend/src/components/theme/__tests__/CelestialThemeProvider.test.tsx` _(modified — 4 new tests + sonner mock)_
- `_bmad-output/implementation-artifacts/22-2-celestial-theme-provider.md` _(new)_
- `_bmad-output/implementation-artifacts/sprint-status.yaml` _(modified — 22-2 → review)_

---

## Change Log

| Date       | Change                                                      |
| ---------- | ----------------------------------------------------------- |
| 2026-03-31 | Story created and implemented — welcome toast + tests added |
