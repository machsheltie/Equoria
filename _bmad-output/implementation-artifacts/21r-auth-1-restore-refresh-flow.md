# Story 21R-AUTH-1: Restore Refresh Flow (Hotfix — Widen Refresh-Token Cookie Path)

**Epic:** 21R-AUTH — Auth / CSRF Session Break Remediation (sibling of Epic 21R)
**Parent Epic:** 21R — Beta Deployment Readiness Remediation
**Priority:** P0 (beta-blocker — MUST ship as standalone hotfix before any other 21R-AUTH story)
**Status:** ready-for-dev
**Source:** `docs/sprint-change-proposal-2026-04-21.md` §4 Story 21R-AUTH-1
**Handover:** `docs/debugging-reports/CSRF-AUTH-BREAK-HANDOVER.md`
**Created:** 2026-04-21
**Owner:** BackendSpecialistAgent
**Deploy shape:** Standalone PR to `master`, merged and deployed BEFORE any other 21R-AUTH story opens.

---

## Story

As an **authenticated Equoria beta tester**,
I want **my session to stay alive past the 15-minute access-token boundary**,
so that **I can continue playing (feed shop purchases, training, breeding) without being silently logged out by a broken auto-refresh flow**.

## Problem (verified)

The refresh-token cookie is written with `path: '/auth/refresh-token'`, but the frontend calls `/api/auth/refresh-token`. Browsers do not send the cookie on the mismatched path, so:

1. Auto-refresh at the 15-minute boundary → `POST /api/auth/refresh-token` reads `req.cookies.refreshToken === undefined` → returns **400 "Refresh token is required"**.
2. Access token never renews → expires at 15 min.
3. `_csrf` cookie (coupled to the same 15-min maxAge) also expires.
4. Frontend's in-memory `_csrfToken` no longer matches a missing cookie → all mutations return **403 "Invalid CSRF token"**.
5. User is stuck until a full logout/re-login cycle.

Reproduction evidence (2026-04-21 curl against running backend):

| Check | Result |
|---|---|
| `POST /auth/refresh-token` with cookie jar | **200 OK** (cookie path matches) |
| `POST /api/auth/refresh-token` with same cookie jar | **400 Bad Request** "Refresh token is required" |

## Fix Summary

Widen the refresh-token cookie path from `/auth/refresh-token` → `/` in both the set and clear configurations. Two-line change in a single file. No schema, no migration, no data fixup. Existing cookies age out within 7 days naturally; users currently wedged need one manual logout/re-login after deploy.

## Acceptance Criteria

### AC-1: Cookie path widened (set)

- [ ] `backend/utils/cookieConfig.mjs:80` — `REFRESH_TOKEN_COOKIE_OPTIONS.path` changed from `'/auth/refresh-token'` → `'/'`.
- [ ] Comment at `backend/utils/cookieConfig.mjs:71` (the JSDoc `Path:` line above the export) updated to reflect the new scoping rationale. Proposed wording: `Path: / (sent to both /auth/refresh-token and /api/v1/auth/refresh-token mounts; narrow scope was causing session-refresh failures — see Story 21R-AUTH-1)`.

### AC-2: Cookie path widened (clear)

- [ ] `backend/utils/cookieConfig.mjs:143` — `CLEAR_COOKIE_OPTIONS.refreshToken.path` changed from `'/auth/refresh-token'` → `'/'` (logout must clear the cookie on the same widened path, or the browser keeps stale cookies around).
- [ ] `getCookieConfigSummary()` at `backend/utils/cookieConfig.mjs:175` updated so the summary output reports `path: '/'` for refresh-token.

### AC-3: Refresh flow works on BOTH mount shapes

- [ ] `POST /auth/refresh-token` with a valid cookie jar returns **200**. (Regression check — this was already green.)
- [ ] `POST /api/auth/refresh-token` with the same cookie jar returns **200**. (Previously 400 — this is the primary fix.)
- [ ] Verified by the integration test listed under AC-6.

### AC-4: Existing auth + CSRF integration tests still pass

- [ ] Full auth suite runs green: `cd backend && npm test -- auth`
- [ ] Full CSRF suite runs green: `cd backend && npm test -- csrf`
- [ ] Full cookie suite runs green: `cd backend && npm test -- cookie`
- [ ] Zero regressions in any previously-passing test.

### AC-5: Path-dependent test assertions migrated

Two existing tests assert the OLD path verbatim and MUST be updated as part of this story (otherwise AC-4 fails):

- [ ] `backend/__tests__/utils/cookieConfig.test.mjs:123` — change assertion from `path: '/auth/refresh-token'` → `path: '/'`.
- [ ] `backend/__tests__/utils/cookieConfig.test.mjs:142` — change from `.toBe('/auth/refresh-token')` → `.toBe('/')`.
- [ ] `backend/__tests__/integration/cookieIntegration.test.mjs:111` — change from `.toContain('Path=/auth/refresh-token')` → `.toContain('Path=/')`.
- [ ] If any other test file (`backend/tests/**` or `backend/__tests__/**`) asserts the literal string `'/auth/refresh-token'` against `REFRESH_TOKEN_COOKIE_OPTIONS.path` or `CLEAR_COOKIE_OPTIONS.refreshToken.path`, update it the same way. Run `grep -rn "/auth/refresh-token" backend/__tests__ backend/tests` before opening the PR to confirm the inventory is exhaustive.
- [ ] **Do not** change any test assertion that verifies a URL endpoint (routes `/auth/refresh-token` or `/api/auth/refresh-token` still exist as routes — only the *cookie path attribute* is changing).

### AC-6: New session-lifetime regression test added

Add one focused integration test that locks in the primary defect being fixed:

- [ ] File: `backend/__tests__/integration/refreshTokenCookiePath.test.mjs` (new).
- [ ] Test: register a user, extract the `Set-Cookie: refreshToken=...` header from the response, assert `Path=/` is present (not `Path=/auth/refresh-token`).
- [ ] Test: using the captured cookie jar, `POST /auth/refresh-token` returns 200.
- [ ] Test: using the same cookie jar, `POST /api/auth/refresh-token` returns 200 (the exact path the frontend calls — this is the regression being fixed).
- [ ] Follows existing integration-test conventions in `backend/__tests__/integration/auth-cookies.test.mjs` and `cookieIntegration.test.mjs` (real supertest, real DB, no mocking).
- [ ] The deeper full-session-lifetime regression coverage (advance-clock past access-token TTL etc.) is Story **21R-AUTH-6** scope, not this hotfix.

### AC-7: Manual verification against a running backend

- [ ] Log in as a real user (browser or curl cookie jar).
- [ ] Wait **16 minutes** (or advance the system clock / force cookie expiry via devtools).
- [ ] Perform a mutation (e.g., feed-shop purchase, training).
- [ ] Succeeds — NO `401` on `/api/auth/profile`, NO `400` on `/api/auth/refresh-token`, NO `403` on the mutation.
- [ ] Capture the manual verification evidence (curl transcript or browser devtools screenshot) and attach it to the PR description or a beads comment on this story.

### AC-8: Out-of-scope guardrails

- [ ] This story MUST NOT touch `backend/middleware/csrf.mjs` (that is Story 21R-AUTH-4).
- [ ] This story MUST NOT touch `CSRF_TOKEN_COOKIE_OPTIONS.maxAge` (that is Story 21R-AUTH-2).
- [ ] This story MUST NOT add `generateCsrfToken()` calls in the auth controller (that is Story 21R-AUTH-3).
- [ ] This story MUST NOT change `frontend/src/lib/api-client.ts` auth URL literals (that is Story 21R-AUTH-7).
- [ ] This story MUST NOT collapse the `/auth/*` + `/api/auth/*` dual mount in `backend/app.mjs` (that is Story 21R-AUTH-7). Cookie path `/` is correct both before and after the eventual mount consolidation, so no re-work is required later.

## Tasks / Subtasks

- [ ] **Task 1 — Apply the two-line cookie config fix** (AC: 1, 2)
  - [ ] Edit `backend/utils/cookieConfig.mjs:80` — `REFRESH_TOKEN_COOKIE_OPTIONS.path` → `'/'`.
  - [ ] Edit `backend/utils/cookieConfig.mjs:143` — `CLEAR_COOKIE_OPTIONS.refreshToken.path` → `'/'`.
  - [ ] Update JSDoc at line 71 (`Path: /auth/refresh-token ...`) to describe the new rationale.
  - [ ] Update `getCookieConfigSummary()` at line 175 so the printed path matches reality.
- [ ] **Task 2 — Migrate path-dependent test assertions** (AC: 5)
  - [ ] `backend/__tests__/utils/cookieConfig.test.mjs:123` and `:142` — change to `'/'`.
  - [ ] `backend/__tests__/integration/cookieIntegration.test.mjs:111` — change to `Path=/`.
  - [ ] Run `grep -rn "'/auth/refresh-token'" backend/__tests__ backend/tests` to confirm no stragglers remain (grep the quoted string form — route URLs in `.post('/auth/refresh-token')` must stay untouched).
- [ ] **Task 3 — Add regression test** (AC: 6)
  - [ ] Create `backend/__tests__/integration/refreshTokenCookiePath.test.mjs` covering the three assertions in AC-6.
  - [ ] Follow patterns from `backend/__tests__/integration/auth-cookies.test.mjs` (real supertest, real DB, teardown via existing helpers).
  - [ ] Ensure the test is discoverable by the standard `npm test` run in `backend/`.
- [ ] **Task 4 — Run the full regression gate locally** (AC: 3, 4)
  - [ ] `cd backend && npm test -- cookie` → green.
  - [ ] `cd backend && npm test -- csrf` → green.
  - [ ] `cd backend && npm test -- auth` → green.
  - [ ] `cd backend && npm test` → green (no regressions anywhere).
- [ ] **Task 5 — Manual verification against a running backend** (AC: 7)
  - [ ] Boot backend + frontend locally (or staging if available).
  - [ ] Log in, wait past the 15-min access-token boundary, perform a mutation, confirm success.
  - [ ] Capture evidence (curl transcript or devtools screenshot).
- [ ] **Task 6 — Open the hotfix PR**
  - [ ] Title: `fix(auth): widen refreshToken cookie path to / — Epic 21R-AUTH story 1`.
  - [ ] Body: link this story file, link `docs/sprint-change-proposal-2026-04-21.md` §4, paste the manual-verification evidence.
  - [ ] Target branch: `master`.
  - [ ] Label: `hotfix`, `epic:21R-AUTH`, `beta-blocker`.
- [ ] **Task 7 — Post-merge actions**
  - [ ] Request deploy within 24 hours of merge (beta hotfix SLA — §5 Success Criteria #1).
  - [ ] After deploy, post in beads/slack: "Story 21R-AUTH-1 live — wedged testers need one manual logout/re-login cycle to discard their old-path refresh cookie."
  - [ ] Update `docs/sprint-artifacts/sprint-status.yaml` once Epic 21R-AUTH is registered (the SM creates the epic entry; dev closes the story status to `done` after user approval).

## Dev Notes

### Implementation-level guardrails

- **Two lines. No more.** This is a deliberate surgical hotfix. Do not refactor adjacent code, do not add defensive `|| '/'` fallbacks, do not "clean up" the JSDoc beyond updating the affected `Path:` line. Resist the urge.
- **Do NOT narrow elsewhere.** The access-token cookie is already `path: '/'`. The CSRF-token cookie is already `path: '/'`. Do not change them — only refresh-token is in scope.
- **Clear options MUST mirror set options.** If `REFRESH_TOKEN_COOKIE_OPTIONS.path` is updated but `CLEAR_COOKIE_OPTIONS.refreshToken.path` is not, logout stops clearing the cookie correctly in browsers that still hold an old-path cookie. Both paths must move together.
- **Cookie path is NOT a URL.** The route handlers at `/auth/refresh-token` and `/api/auth/refresh-token` continue to exist unchanged. Only the *Set-Cookie* `Path=` attribute changes. Any test that calls `.post('/auth/refresh-token')` as a URL stays correct.
- **Security posture.** Widening from `/auth/refresh-token` → `/` does not meaningfully expand attack surface: the cookie is still `httpOnly: true`, still `secure: true` in production, still `sameSite: strict` in production. The only *relaxation* is which same-origin requests the browser attaches it to — which was already the design intent; the narrow path was a mistake, not a security control. ADR-005 (written under Story 21R-AUTH-4) will document this decision formally.

### Why the old path was wrong

The comment at `cookieConfig.mjs:71` said "Only cookie-based refresh endpoint needs access (least privilege)". That would be a valid argument if the app only mounted the endpoint at one path. But `backend/app.mjs:161-163` mounts the auth router at BOTH `/auth` AND `/api/auth`, so the refresh endpoint lives at two URLs. A single path-scoped cookie cannot cover both. Story 21R-AUTH-7 will consolidate the mounts down to one (`/api/v1/auth/*`), but widening to `/` is correct today AND still correct after Story 21R-AUTH-7 lands — no re-work required.

### Source tree components to touch

| Path | Lines | Change type |
|---|---|---|
| `backend/utils/cookieConfig.mjs` | 71 (comment), 80, 143, 175 | edit |
| `backend/__tests__/utils/cookieConfig.test.mjs` | 123, 142 | edit (assertion literal) |
| `backend/__tests__/integration/cookieIntegration.test.mjs` | 111 | edit (assertion literal) |
| `backend/__tests__/integration/refreshTokenCookiePath.test.mjs` | whole file | **new** |

### Testing standards

- All tests in this story are **integration tests against the real test DB** — consistent with the project's no-mock policy (`.claude/rules/GENERAL_RULES.md`, `CLAUDE.md`).
- Use `supertest(app)` with real `express.app` import (follow `auth-cookies.test.mjs` as the reference pattern).
- Do NOT mock Prisma, do NOT mock the CSRF middleware, do NOT use `x-test-skip-csrf` headers — those would render the test invalid as 21R beta-readiness evidence.
- Use the standard test-user cleanup pattern from `cookieIntegration.test.mjs` (`prisma.user.delete` in afterEach).

### Rollback plan

Revert the commit. Zero schema impact, zero data impact. Existing user sessions continue to work because the old-path cookie still round-trips on `/auth/refresh-token`; only the `/api/auth/refresh-token` flow regresses, which is the current production behavior anyway.

### Project Structure Notes

- Cookie config lives under `backend/utils/` per the standard project layout (CLAUDE.md §Folder Structure Standards: `utils/` = reusable helper logic).
- All tests live under `backend/__tests__/` (the canonical test root — NOT `backend/tests/`). A small number of legacy files remain under `backend/tests/`; new tests go under `backend/__tests__/`.
- ES modules only, `.mjs` extension, `import`/`export` syntax — no CommonJS. Required by `.claude/rules/ES_MODULES_REQUIREMENTS.md`.
- camelCase identifiers, no snake_case (`refreshToken`, not `refresh_token`).

### References

- Story source: [Source: docs/sprint-change-proposal-2026-04-21.md#Story 21R-AUTH-1 — Restore refresh flow (MUST-SHIP FIRST HOTFIX)]
- Root-cause handover: [Source: docs/debugging-reports/CSRF-AUTH-BREAK-HANDOVER.md]
- Epic scope + rationale: [Source: docs/sprint-change-proposal-2026-04-21.md#4 Detailed Change Proposals]
- 21R doctrine (no bypasses as readiness evidence): [Source: CLAUDE.md#21R Beta Readiness Doctrine — No Deferrals]
- Completion verification policy: [Source: .claude/rules/COMPLETION_VERIFICATION_POLICY.md]
- Cookie config under change: [Source: backend/utils/cookieConfig.mjs:71-82, 139-145, 161-188]
- App-level dual mount (context for why path `/` is correct today AND post-consolidation): [Source: backend/app.mjs:151-163]
- ES modules / naming standards: [Source: .claude/rules/ES_MODULES_REQUIREMENTS.md, .claude/rules/CONTRIBUTING.md]
- Security properties table for cookies: [Source: .claude/rules/SECURITY.md#cookie]

## Dev Agent Record

### Agent Model Used

(Populate at implementation time — e.g., "claude-opus-4-7 via Claude Code dev-story workflow")

### Debug Log References

(Populate during implementation)

### Completion Notes List

(Populate during implementation — include grep output for AC-5 sweep, full `npm test` tail, manual verification transcript)

### File List

(Populate during implementation — expected:
- modified: `backend/utils/cookieConfig.mjs`
- modified: `backend/__tests__/utils/cookieConfig.test.mjs`
- modified: `backend/__tests__/integration/cookieIntegration.test.mjs`
- added: `backend/__tests__/integration/refreshTokenCookiePath.test.mjs`
)
