# Story 21S-5: Persist `/settings` via Backend Endpoint

**Epic:** 21S - Beta Readiness Gap Closure
**Priority:** P0
**Status:** done
**Source:** `docs/sprint-change-proposal-2026-04-16-beta-readiness-gap-fixes.md` — Change D / Finding P0-7
**Owner:** BackendSpecialistAgent + FrontendSpecialistAgent

## Problem

`/settings` was classified `beta-live` but had zero persistence — `frontend/src/pages/SettingsPage.tsx` kept every toggle in local `useState` that disappeared on navigation. Truth table admitted "Account/display/notification controls appear local-state-only; do not advertise persistence in beta." Per user direction — fix, not hide.

## Acceptance Criteria

### Backend

- [x] AC-B1: Storage model — reused the existing `User.settings` JSONB column and nested `settings.preferences`. No migration needed (same pattern as onboarding flags).
- [x] AC-B2: Endpoint `PATCH /api/auth/profile/preferences`:
  - `authenticateToken` middleware + `profileRateLimiter`.
  - Whitelist validation — rejects unknown keys with 400.
  - Type validation — non-boolean values rejected with 400.
  - Merge-updates the existing preferences object.
  - Returns `{ status: 'success', data: { preferences: {...mergedPreferences} } }`.
- [x] AC-B3: `GET /api/auth/profile` response now includes a flattened `user.preferences` field.
- [x] AC-B4: Real-DB integration tests — 6/6 passing: auth guard (401), valid update persists, partial update merges without clobber, unknown key (400), non-boolean value (400), GET profile hydrates with saved prefs.

### Frontend

- [x] AC-F1: `useUpdatePreferences` hook added under `frontend/src/hooks/api/` with optimistic cache update + rollback on error.
- [x] AC-F2: `SettingsPage.tsx` hydrates toggle state from `user.preferences` (falling back to `DEFAULT_PREFERENCES` for legacy accounts) and fires the mutation on every toggle change, sending only the changed key.
- [x] AC-F3: Error toast via `sonner` on mutation failure (server validation errors surface message).
- [x] AC-F4: Component test (`SettingsPage.persistence.test.tsx`) covers hydration + single-key payload for both notification and display toggles — 4/4 passing.
- [x] AC-F5: `UserPreferences` type exported from `api-client.ts`; `User` type in `useAuth.ts` extended with optional `preferences`.

### Doc

- [x] AC-D1: Truth-table `/settings` row updated — added the new endpoint to Required APIs, swapped the "local-state-only" note for a Corrected-2026-04-20 reference to Story 21S-5.

## Verification

```bash
# Backend (NO MOCKS, real DB)
node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand \
  modules/auth/__tests__/preferencesRoutes.integration.test.mjs
# → 1 suite, 6 tests passed

# Frontend
./node_modules/.bin/vitest run src/pages/__tests__/SettingsPage.persistence.test.tsx
# → 1 file, 4 tests passed

# Lint — 0 errors on backend + frontend changed files

# Grep gate
grep -E "useMutation|usePreferences" frontend/src/pages/SettingsPage.tsx
# → matches useUpdatePreferences + useAuth import
```

## Dev Agent Record

### Completion Notes

- Chose the nested-JSONB path (`User.settings.preferences`) over a new `UserPreferences` table — onboarding already uses this pattern and there's no query workload where a normalized table would pay off. Smaller blast radius (no migration).
- Whitelist of 9 keys — 3 email, 3 in-app, 3 display — mirrors what `SettingsPage.tsx` currently renders. Adding a 10th key requires updates in two places (server `ALLOWED_PREFERENCE_KEYS` + client `UserPreferences` interface) which is intentional: keeps the contract visibly symmetric.
- Optimistic update via `setQueryData` + rollback via `onError` context — same pattern used in 21S-2 onboarding flow. Avoids UI flicker while the round trip completes.
- Mutation sends only the single changed key rather than the whole object. Keeps payloads small and preserves other-key integrity if multiple toggles are manipulated concurrently.
- `DEFAULT_PREFERENCES` exported at page level keeps the defaults close to the UI surface; when a new toggle is added, the default lives one line away from its renderer.
- Account / password / delete-account subsections left untouched per the story's "Out of Scope".

## File List

**Added:**
- `backend/modules/auth/__tests__/preferencesRoutes.integration.test.mjs`
- `frontend/src/hooks/api/useUpdatePreferences.ts`
- `frontend/src/pages/__tests__/SettingsPage.persistence.test.tsx`

**Modified:**
- `backend/modules/auth/controllers/authController.mjs` — added `updateUserPreferences` controller + `ALLOWED_PREFERENCE_KEYS` whitelist + flattened `preferences` in `getProfile` response
- `backend/modules/auth/routes/authRoutes.mjs` — registered `PATCH /api/auth/profile/preferences`
- `frontend/src/lib/api-client.ts` — added `UserPreferences` interface + `authApi.updatePreferences`
- `frontend/src/hooks/useAuth.ts` — `User.preferences?: Partial<UserPreferences>`
- `frontend/src/pages/SettingsPage.tsx` — replaced local-state toggles with hydration from `user.preferences` + mutation calls on every change
- `docs/beta-route-truth-table.md` — `/settings` row updated
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `21s-5` → `done`

## Change Log

| Date       | Author    | Change                                                                                                                                                                        |
| ---------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-20 | Dev Agent | Shipped `PATCH /api/auth/profile/preferences` + flattened profile hydration + `useUpdatePreferences` hook + wired SettingsPage. 6/6 backend + 4/4 frontend + lint clean. Done. |

## Out of Scope

- Account deletion / password-change UX on Settings page — tracked separately.
- Username/email fields on the Settings page — those already use `useUpdateProfile`; leaving untouched.
