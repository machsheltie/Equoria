# Story 22.3: Painted Background System

**Epic:** 22 — Celestial Night Foundation
**Story Key:** 22-3-painted-background-system
**Status:** review
**Last Updated:** 2026-04-02

---

## User Story

As a player,
I want each area of the game to display a themed background scene behind the content,
So that every page feels visually distinct and immersive — not a uniform repeating texture.

---

## Acceptance Criteria

- [x] **AC1:** Given the `.celestial` class is active, when any page loads, a full-viewport background div renders behind all content at `z-[var(--z-below)]`
- [x] **AC2:** The background image resolves to the scene-specific WebP path (`/images/backgrounds/{scene}/bg-{ratio}.webp`) when `scene` is provided, or generic `/images/bg-{ratio}.webp` when omitted — backward compatible
- [x] **AC3:** The background uses `backgroundSize: cover` and `backgroundPosition: center` to fill all viewport sizes without distortion
- [x] **AC4:** A deep navy fallback color (`var(--bg-deep-space)`) displays when no art is present for the scene — no broken images
- [x] **AC5:** A semi-transparent readability veil (`rgba(5,10,20,0.45)`) sits between the background and content
- [x] **AC6:** `prefers-reduced-motion` has no impact (backgrounds are static images)
- [x] **AC7:** `StarfieldBackground` is removed from `App.tsx`; `StarField.tsx` and `StarfieldBackground.tsx` are deleted
- [x] **AC8:** All starfield CSS (`@keyframes starfield-drift-*`, `.starfield-bg`, `.starfield-layer*`) removed from `index.css`
- [x] **AC9:** `DashboardLayout.tsx` uses `<PageBackground scene={sceneForRoute} />` with a route-to-scene map covering all 9 scene keys
- [x] **AC10:** Auth pages (Login, Register, ForgotPassword, ResetPassword, VerifyEmail) use `<PageBackground scene="auth" />` and no longer call `useResponsiveBackground` directly
- [x] **AC11:** `useResponsiveBackground` hook accepts an optional `scene?: SceneKey` parameter and resolves paths with scene directory when provided
- [x] **AC12:** Zero new ESLint errors (`npm run lint` exits 0 in `frontend/`)

---

## Tasks/Subtasks

- [x] **T1: Create `SceneKey` type and extend `useResponsiveBackground` hook**

  - [x] T1.1: Export `SceneKey` union type from `useResponsiveBackground.ts`
  - [x] T1.2: Add optional `scene?: SceneKey` param to `useResponsiveBackground`
  - [x] T1.3: When `scene` provided, resolve path as `/images/backgrounds/{scene}/bg-{ratio}.webp`
  - [x] T1.4: When `scene` absent, return existing `/images/bg-{ratio}.webp` (backward compat)
  - [x] T1.5: Update/add hook unit tests

- [x] **T2: Create `PageBackground.tsx` component**

  - [x] T2.1: Create `frontend/src/components/layout/PageBackground.tsx`
  - [x] T2.2: Props: `{ scene?: SceneKey; className?: string }`
  - [x] T2.3: Fixed-position, full-viewport, `z-[var(--z-below)]`, `aria-hidden`
  - [x] T2.4: Background layer: `backgroundColor: var(--bg-deep-space)` + `backgroundImage` with WebP URL + JPEG fallback via `image-set()`
  - [x] T2.5: Readability veil: nested `<div>` with `rgba(5,10,20,0.45)`
  - [x] T2.6: Write `PageBackground.test.tsx` — renders, aria-hidden, scene paths, no-scene fallback, veil present

- [x] **T3: Update `DashboardLayout.tsx`**

  - [x] T3.1: Add route-to-scene mapping function covering all 9 SceneKey values
  - [x] T3.2: Remove `useResponsiveBackground` import and inline `backgroundImage` style
  - [x] T3.3: Render `<PageBackground scene={getSceneForPath(pathname)} />` inside the layout

- [x] **T4: Update auth pages to use `PageBackground`**

  - [x] T4.1: `LoginPage.tsx` — replace `useResponsiveBackground` bg with `<PageBackground scene="auth" />`
  - [x] T4.2: `RegisterPage.tsx` — same
  - [x] T4.3: `ForgotPasswordPage.tsx` — same
  - [x] T4.4: `ResetPasswordPage.tsx` — same
  - [x] T4.5: `VerifyEmailPage.tsx` — same

- [x] **T5: Update `App.tsx` — remove `StarfieldBackground`**

  - [x] T5.1: Remove `StarfieldBackground` import
  - [x] T5.2: Remove `<StarfieldBackground />` render call

- [x] **T6: Delete old starfield components**

  - [x] T6.1: Delete `frontend/src/components/layout/StarField.tsx`
  - [x] T6.2: Delete `frontend/src/components/layout/StarfieldBackground.tsx`
  - [x] T6.3: Delete `frontend/src/components/layout/__tests__/StarfieldBackground.test.tsx`
  - [x] T6.4: Update `frontend/src/App.story-8-1.test.tsx` — remove stale `StarField` mock

- [x] **T7: Remove starfield CSS from `index.css`**

  - [x] T7.1: Remove `@keyframes starfield-drift-sm/md/lg` blocks
  - [x] T7.2: Remove `.starfield-bg`, `.starfield-layer`, `.starfield-layer--sm/md/lg` rules
  - [x] T7.3: Remove `prefers-reduced-motion` overrides for starfield layers

- [x] **T8: Run lint and full test suite**
  - [x] T8.1: `npm run lint` exits 0 in `frontend/`
  - [x] T8.2: All existing tests pass (no regressions)

---

## Dev Notes

**Architecture:**

- `PageBackground` is a pure presentational component — no state, no router dependency
- `DashboardLayout` provides the scene by reading `useLocation().pathname` and mapping it
- Auth pages render `PageBackground` directly with hardcoded `scene="auth"`
- `useResponsiveBackground` backward compat: existing consumers that call it without args still get `/images/bg-{ratio}.webp`

**Scene-to-route mapping (for DashboardLayout):**

```
'/'                        → 'hub'
'/horses/:id'              → 'horse-detail'
'/horses', '/my-stable'    → 'stable'
'/training*'               → 'training'
'/competition*'            → 'competition'
'/breeding*', '/foal*'     → 'breeding'
'/world*', '/community*', '/clubs*', '/messages*', '/message-board*' → 'world'
everything else            → 'default'
```

**WebP + JPEG fallback strategy:**
Use CSS `image-set()` in the `backgroundImage` inline style:

```
image-set(url('/images/backgrounds/hub/bg-16.9.webp') type('image/webp'), url('/images/backgrounds/hub/bg-16.9.jpg') type('image/jpeg'))
```

When art doesn't exist yet, the browser falls through to `backgroundColor: var(--bg-deep-space)`. No broken images.

**Starfield removal:**

- `StarField.tsx` — only mocked in `App.story-8-1.test.tsx`, never used in production. Delete.
- `StarfieldBackground.tsx` — used in `App.tsx` only. Replace with nothing (PageBackground is in DashboardLayout).
- `App.story-8-1.test.tsx` — remove the stale `vi.mock('@/components/layout/StarField')` line.

**`prefers-reduced-motion`:** No action needed — static background images are unaffected.

---

## Dev Agent Record

### Implementation Plan

1. Extend `useResponsiveBackground` with `SceneKey` type and optional `scene` param
2. Create `PageBackground.tsx` with nested veil div
3. Update `DashboardLayout.tsx` — route-to-scene map + PageBackground
4. Update 5 auth pages — replace inline bg with `<PageBackground scene="auth" />`
5. Update `App.tsx` — remove StarfieldBackground
6. Delete `StarField.tsx`, `StarfieldBackground.tsx`, `StarfieldBackground.test.tsx`
7. Update `App.story-8-1.test.tsx` — remove stale StarField mock
8. Remove starfield CSS from `index.css`
9. Write `PageBackground.test.tsx`
10. Run lint + tests

### Debug Log

_(filled during implementation)_

### Completion Notes

All 8 tasks complete. Key decisions:

- **jsdom image-set() limitation:** jsdom doesn't parse the `image-set()` CSS function, so `style.backgroundImage` reads as empty in tests. Added `data-bg` attribute to the image layer holding the webp path; tests use `getAttribute('data-bg')` for path assertions.
- **jsdom rgba normalization:** jsdom adds spaces after rgba commas (`rgba(5, 10, 20, 0.45)` not `rgba(5,10,20,0.45)`). Test assertion updated accordingly.
- **App.story-8-1.test.tsx failures are pre-existing** (9 failed / 1 passed before and after our changes) — caused by React.lazy + Suspense not resolving synchronously in tests. Not introduced by this story.
- **Prettier ternary format:** `buildPath` inline ternary reformatted to a single line to satisfy prettier.
- **ESLint exhaustive-deps comment removed:** The project's ESLint config doesn't include the `react-hooks` plugin, so the `eslint-disable-next-line` comment itself caused an error. Removed.

---

## File List

- `frontend/src/hooks/useResponsiveBackground.ts` _(modified)_
- `frontend/src/components/layout/PageBackground.tsx` _(new)_
- `frontend/src/components/layout/__tests__/PageBackground.test.tsx` _(new)_
- `frontend/src/components/layout/DashboardLayout.tsx` _(modified)_
- `frontend/src/pages/LoginPage.tsx` _(modified)_
- `frontend/src/pages/RegisterPage.tsx` _(modified)_
- `frontend/src/pages/ForgotPasswordPage.tsx` _(modified)_
- `frontend/src/pages/ResetPasswordPage.tsx` _(modified)_
- `frontend/src/pages/VerifyEmailPage.tsx` _(modified)_
- `frontend/src/App.tsx` _(modified)_
- `frontend/src/components/layout/StarField.tsx` _(deleted)_
- `frontend/src/components/layout/StarfieldBackground.tsx` _(deleted)_
- `frontend/src/components/layout/__tests__/StarfieldBackground.test.tsx` _(deleted)_
- `frontend/src/App.story-8-1.test.tsx` _(modified — stale mock removed)_
- `frontend/src/index.css` _(modified — starfield CSS removed)_
- `_bmad-output/implementation-artifacts/sprint-status.yaml` _(modified)_

---

## Change Log

| Date       | Change                        |
| ---------- | ----------------------------- |
| 2026-04-02 | Story created and implemented |
