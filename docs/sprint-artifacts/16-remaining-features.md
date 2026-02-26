# Epic 16 — Remaining Feature Work

**Date:** 2026-02-26
**Status:** ✅ Complete
**Branch:** `cleanup-session-2026-01-30`

---

## Summary

Epic 16 wired the last remaining "disabled" features in the frontend, scaffolded art assets, and added a new-player onboarding wizard. Three stories completed in a single session.

---

## Stories

### 16-1 · Inventory Equip / Unequip (Live API) ✅

**Goal:** Replace the mock InventoryPage with a live equip/unequip API backed by JSONB fields.

**Key decision — no schema migration needed:**

- `Horse.tack Json?` already existed (tack-shop purchases were already stored here)
- `User.settings Json` already existed
- All inventory data stored in these fields — zero Prisma migrations required

**Backend files created:**

- `backend/controllers/inventoryController.mjs` — GET (with first-time seed), POST `/equip`, POST `/unequip`
  - First-time seed: if `User.settings.inventory` is empty but `Horse.tack` has data, derives inventory from horse tack and persists it (backward-compat for existing tack-shop purchases)
  - Equip: unequips from any previous horse first, writes `Horse.tack[category] = itemId` + `User.settings.inventory[item].equippedToHorseId`
  - Imports `TACK_INVENTORY` from `tackShopController.mjs` for item definitions
- `backend/routes/inventoryRoutes.mjs` — GET `/`, POST `/equip` (validates inventoryItemId + horseId), POST `/unequip`
- `backend/app.mjs` — added `authRouter.use('/inventory', inventoryRoutes)`

**Frontend files created/modified:**

- `frontend/src/lib/api-client.ts` — Added `InventoryItem`, `InventoryData`, `EquipResult`, `UnequipResult` types + `inventoryApi` surface using unwrapped `T` (not `{ success; data: T }`)
- `frontend/src/hooks/api/useInventory.ts` — `useInventory()`, `useEquipItem()`, `useUnequipItem()` with cache invalidation
- `frontend/src/pages/InventoryPage.tsx` — replaced `MOCK_INVENTORY` with live hooks; added `HorsePicker` inline modal for tack equip; loading/error/empty states

**ESLint lessons:**

- Base `no-unused-vars` does NOT have `^_` exception — only `@typescript-eslint/no-unused-vars` does
- Fix: avoid destructuring entirely when only value needed (e.g., `Object.values()` not `Object.entries()`)
- Interface function type params require `_prefix` when decorative (e.g., `_horseId: number`)

---

### 16-2 · New Player Onboarding Wizard ✅

**Goal:** Show a 3-step wizard to brand-new players on first login; mark `completedOnboarding` on completion.

**Onboarding flag semantics:**

- `completedOnboarding === false` → new user, redirect to `/onboarding`
- `completedOnboarding === undefined` → legacy account, no redirect
- `completedOnboarding === true` → done, no redirect

**Backend files modified:**

- `backend/controllers/authController.mjs`:
  - `register()`: seeds `settings: { completedOnboarding: false }` for new users
  - `getProfile()`: added `settings: true` to Prisma select; exposes `completedOnboarding` as flat field
  - Added `completeOnboarding()` — merges `completedOnboarding: true` into `User.settings`
- `backend/routes/authRoutes.mjs` — `POST /complete-onboarding` (authenticated)

**Frontend files created/modified:**

- `frontend/src/hooks/useAuth.ts` — added `completedOnboarding?: boolean` to `User` interface
- `frontend/src/lib/api-client.ts` — added `authApi.completeOnboarding()`
- `frontend/src/pages/OnboardingPage.tsx` — 3-step wizard:
  - Step 1 (Welcome): horse emoji, feature grid (genetics / compete / level-up)
  - Step 2 (Starter Kit): 4 items (1000 gold, stable slot, free training, basic tack)
  - Step 3 (Ready): next-steps guide with Star icon and path hints
  - Progress dots, "Skip intro" on step 1, Loader during mutation
  - `data-testid="onboarding-next"`, `data-testid="onboarding-skip"`
- `frontend/src/components/auth/OnboardingGuard.tsx` — `useEffect` checking `user.completedOnboarding === false` AND `location.pathname !== '/onboarding'`; returns null
- `frontend/src/App.tsx` — `OnboardingGuard` sibling of `<Suspense>` inside `<BrowserRouter>`; lazy `OnboardingPage` + `/onboarding` route

**OnboardingGuard placement rule:**

- Must be inside `<BrowserRouter>` to access `useNavigate` / `useLocation`
- Must be a sibling of `<Routes>` (not child) so it can intercept all navigations

---

### 16-3 · Art Asset Scaffolding ✅

**Goal:** Scaffold placeholder art assets with the Celestial Night aesthetic for future designer handoff.

**Files created:**

- `frontend/public/placeholder.svg` — dark celestial background (`#0f2346`) with semi-transparent horse silhouette; usable immediately as `<img src="/placeholder.svg">`
- `frontend/public/assets/horses/README.md` — naming convention: `{breed-slug}-{color}.{ext}`, gender fallback `generic-{sex}.svg`; directory structure guide

---

## Commits

| Commit     | Message                                                       |
| ---------- | ------------------------------------------------------------- |
| `1873aa8f` | `feat(16-1): inventory equip/unequip system — live API wired` |
| `f02205db` | `feat(16-2): new player onboarding flow`                      |

---

## Retrospective

### What went well

- **No schema migrations** — reusing existing JSONB fields (`Horse.tack`, `User.settings`) kept scope tight
- **First-time seed pattern** — elegant backward-compat for existing tack-shop data
- **Onboarding guard placement** — clean separation: guard is a silent side-effect component, not a route wrapper

### What was tricky

- **fetchWithAuth T-type confusion** — `apiClient.get<T>` returns unwrapped `T` (not `{ success; data: T }`); must type accordingly
- **Base ESLint `no-unused-vars`** — does NOT inherit the `^_` exception set on `@typescript-eslint/no-unused-vars`; fix: avoid destructuring unused keys
- **OnboardingGuard import order** — React import must come before component usage (top-of-file)

### Architecture notes

- `inventoryApi` types are the _inner_ payload types because `fetchWithAuth` line 595 unwraps `data.data`
- `horsesApi.list()` returns `HorseSummary[]` directly — no `.data` wrapping needed in components
- `completeOnboarding` is best-effort: even on API error, the user is navigated home (toast info instead of error)
