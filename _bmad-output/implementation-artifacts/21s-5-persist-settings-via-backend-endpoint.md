# Story 21S-5: Persist `/settings` via Backend Endpoint

**Epic:** 21S - Beta Readiness Gap Closure
**Priority:** P0
**Status:** backlog
**Source:** `docs/sprint-change-proposal-2026-04-16-beta-readiness-gap-fixes.md` — Change D / Finding P0-7
**Owner:** BackendSpecialistAgent + FrontendSpecialistAgent

## Problem

`/settings` is classified `beta-live`, but `frontend/src/pages/SettingsPage.tsx` has:

- 0 `useMutation` calls
- 0 `fetch` calls
- 0 references to `api-client`
- 0 `localStorage` writes

Every toggle is local React state that disappears on navigation. Truth table admits _"Account/display/notification controls appear local-state-only; do not advertise persistence in beta."_ Per user direction, that's passing the buck. Fix it — do not hide.

## Acceptance Criteria

### Backend

- [ ] Model: add user-preferences persistence. Choose between:
  - (a) New `UserPreferences` Prisma model related 1:1 to `User`, or
  - (b) JSONB `preferences` column on `User`.
- [ ] Endpoint: `PATCH /api/auth/profile/preferences` (or nearest equivalent) accepts the preference fields currently surfaced in `SettingsPage.tsx` (notification toggles, display mode, sound, locale, etc.).
- [ ] Endpoint is auth-required, rate-limited per existing profile-edit pattern, and returns the updated preferences.
- [ ] `GET /api/auth/profile` response includes current preferences so the page can hydrate on load.
- [ ] Migration added to `packages/database/prisma/migrations/`.
- [ ] Integration tests (real DB) covering: auth required, successful update, validation of allowed fields, GET reflects the change.

### Frontend

- [ ] New hook `useUpdatePreferences()` in `frontend/src/hooks/api/`.
- [ ] `SettingsPage.tsx` wires every input to the mutation with optimistic update + error toast.
- [ ] Page hydrates initial values from the auth profile response.
- [ ] Component test covering a toggle mutation and an error path.

## Verification

- [ ] Manual beta test: change a preference, hard-refresh the page, confirm it persists.
- [ ] `grep -E "useMutation|usePreferences" frontend/src/pages/SettingsPage.tsx` returns at least one match.
- [ ] `docs/beta-route-truth-table.md` row for `/settings` updated: remove "local-state-only" note.

## Alternative (last resort, requires product decision)

If product decides Settings should not be in beta, remove `/settings` from `nav-items.tsx` AND from `BETA_SCOPE` in `betaRouteScope.ts`, and record the decision in the truth table. Do NOT leave it "beta-live but not persisting".

## Out of Scope

- Account deletion / password-change UX on Settings page — tracked separately if needed.
