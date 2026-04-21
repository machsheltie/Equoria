# Sprint Change Proposal — Beta Readiness Gap Fixes (Adversarial Review Follow-Up)

**Project:** Equoria
**Date:** 2026-04-16
**Prepared by:** Adversarial code reviewer
**Trigger:** Fine-toothed adversarial review of `sprint-change-proposal-2026-04-03.md` and `sprint-change-proposal-2026-04-11.md`
**Scope Classification:** Major — blocks beta deployment signoff
**Supersedes:** Parts of the "done" status on Story 21R-3 and the "ready-for-signoff" status on `beta-deployment-readiness`
**Related:**

- `docs/sprint-change-proposal-2026-04-03.md` (Epic 1 auth bug fixes — ✅ fully implemented, no action here)
- `docs/sprint-change-proposal-2026-04-11.md` (Beta Deployment Readiness Remediation — partially implemented)
- `docs/sprint-change-proposal-2026-04-14.md` (21R active beta completion correction — partially implemented)
- `docs/beta-route-truth-table.md`
- `docs/beta-signoff.yaml`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

---

## 1. Issue Summary

Active beta policy, per the user and the 2026-04-11/2026-04-14 proposals, is:

> No production mocks in beta-facing code. No beta-read-only substitutes. No beta-hidden substitutes. No "coming soon", disabled, or missing backend behavior on beta-live surfaces. Beta testers must be able to actively test all exposed features, and those features must work.

Sprint status currently says `21r-1` through `21r-6` are `done` and `beta-deployment-readiness: ready-for-signoff`. An adversarial code review of the worktree `festive-herschel` at 2026-04-16 proves that is not true:

- Story 21R-3 is marked `done`, but its own acceptance command still returns matches: `x-test-skip-csrf` and `x-test-bypass-rate-limit` remain in both the production API client and the beta-critical E2E specs.
- `/leaderboards` is classified `beta-live`, but the backend endpoint it depends on (`GET /api/leaderboards/user-summary/:userId`) is **not registered**. The truth table admits this while still shipping the route.
- The `e2e_critical_path` readiness gate in `docs/beta-signoff.yaml` is `SKIP`, not `PASS`. A gate that can be skipped is not a gate.
- `/my-stable` is `beta-live` but shows hardcoded `competitions: 0, wins: 0, competitionsEntered: 0, firstPlaceFinishes: 0` for every retired horse and for the stable stats — real career data exists in the backend but is not fetched.
- `/settings` is `beta-live` but has no mutations, no API calls, and no persistence; the page is local-state-only while navigation advertises it as a real settings surface.
- Playwright still launches the backend with `NODE_ENV=test`, violating the proposal's explicit "beta-like environment, not generic NODE_ENV=test" rule.
- Several lower-priority items remain: dead code with `console.log` no-ops, an authenticated-only admin cleanup endpoint, and duplicated error branches introduced in the 2026-04-03 fixes.

The deployment decision must be based on actual production-parity evidence, not optimistic documentation.

---

## 2. Scope of This Proposal

This proposal does **not** reopen product scope. It does **not** propose hiding any beta-live surface. The user's explicit direction is: **find problems and fix them, do not make them read-only or hidden to pass the buck**.

In scope:

- Making the beta readiness gate actually pass all nine gates without SKIP.
- Removing production-code CSRF/rate-limit bypasses so Playwright runs in production parity.
- Replacing placeholder zeros on beta-live routes with real backend data.
- Either wiring Settings to real persistence or removing it from beta scope **through a product decision**, not a quiet hide.
- Closing the missing leaderboard backend endpoint.
- Cleaning small debt uncovered during the audit.

Out of scope:

- Visual polish, Celestial Night expansion, new gameplay features.
- Epic 22+ polish work.

---

## 3. Findings and Impact

### P0-1 — `/leaderboards` ships pointing at a non-existent backend endpoint

**Files:**

- Frontend hook: [`frontend/src/lib/api/leaderboards.ts:131-135`](frontend/src/lib/api/leaderboards.ts:131)
- Frontend page: [`frontend/src/pages/LeaderboardsPage.tsx:191`](frontend/src/pages/LeaderboardsPage.tsx:191)
- Backend routes file (no matching registration): [`backend/modules/leaderboards/routes/leaderboardRoutes.mjs`](backend/modules/leaderboards/routes/leaderboardRoutes.mjs)

**Evidence:**

- `fetchUserRankSummary` calls `GET /api/leaderboards/user-summary/:userId`.
- `grep -n "router\." backend/modules/leaderboards/routes/leaderboardRoutes.mjs` returns eight routes; none is `/user-summary/:userId`.
- Truth table row for `/leaderboards` admits: _"`fetchUserRankSummary()` currently returns `null` because its backend endpoint does not exist; user-rank panel cannot be beta-live"_ — yet `/leaderboards` is classified `beta-live`.

**Impact:** Beta testers hit a `null` or 404 when the user-rank dashboard tries to populate. This is exactly the pattern the user called out.

---

### P0-2 — `x-test-skip-csrf` is still shipped to production build during E2E

**Files:**

- [`frontend/src/lib/api-client.ts:614`](frontend/src/lib/api-client.ts:614)
- [`playwright.config.ts:47-48`](playwright.config.ts:47)

**Evidence:**

```ts
const isTestEnv =
  import.meta.env.MODE === 'test' || import.meta.env.VITE_E2E_TEST === 'true';
// ...
if (isMutation && !isTestEnv) { /* fetch real CSRF */ }
// ...
...(isTestEnv ? { 'x-test-skip-csrf': 'true' } : csrfHeader),
```

`playwright.config.ts` sets `VITE_E2E_TEST: 'true'`, so every mutation during Playwright runs bypasses CSRF. Story 21R-3's acceptance criterion is literally _"`rg -n "x-test-skip-csrf|x-test-bypass-rate-limit" tests/e2e frontend/src/lib/api-client.ts` returns no matches."_ It fails today.

**Impact:** Readiness signal is false. Real beta users will hit CSRF enforcement paths that tests never exercise. A regression in CSRF middleware would pass E2E and break production.

---

### P0-3 — `x-test-bypass-rate-limit` is sent on beta-critical specs

**Files:**

- [`tests/e2e/global-setup.ts:30`](tests/e2e/global-setup.ts:30)
- [`tests/e2e/auth.spec.ts:31`](tests/e2e/auth.spec.ts:31)
- [`tests/e2e/beta-critical-path.spec.ts:33`](tests/e2e/beta-critical-path.spec.ts:33)
- [`tests/e2e/core-game-flows.spec.ts:47`](tests/e2e/core-game-flows.spec.ts:47)
- [`tests/e2e/onboarding-flow.spec.ts:27`](tests/e2e/onboarding-flow.spec.ts:27)

**Impact:** Beta testers can hit rate limits the E2E suite never exercises. Any rate-limit regression passes E2E silently.

---

### P0-4 — Playwright backend runs with `NODE_ENV=test`

**File:** [`playwright.config.ts:30-31`](playwright.config.ts:30)

```
'set "PORT=3001" && set "NODE_ENV=test" && node backend/server.mjs'
'PORT=3001 NODE_ENV=test node backend/server.mjs'
```

The 2026-04-11 proposal explicitly requires: _"Run E2E backend in a beta-like environment, not generic `NODE_ENV=test`."_ Unchanged.

**Impact:** Whatever code paths branch on `NODE_ENV === 'test'` (logging, rate-limit middleware, CSRF middleware, Prisma client selection) run differently in E2E than in beta. Production parity is not established.

---

### P0-5 — `e2e_critical_path` gate in readiness record is `SKIP`, not `PASS`

**File:** [`docs/beta-signoff.yaml:32`](docs/beta-signoff.yaml:32)

```yaml
e2e_critical_path: SKIP
skipped: e2e_critical_path (--skip-e2e; requires running backend+frontend servers)
```

Sprint status header reads _"all 8 beta-readiness gates passing (1 skipped E2E requires live servers)"_ — the rollup says 8 of 9. That is not a passing gate, it is a skipped gate. Story 21R-6's acceptance criterion is "Gate cannot be marked ready unless all gates pass." Not satisfied.

---

### P0-6 — `/my-stable` shows fabricated zeros for career stats

**File:** [`frontend/src/pages/MyStablePage.tsx:272-311`](frontend/src/pages/MyStablePage.tsx:272)

```ts
career: { competitions: 0, wins: 0, earnings: <real> }
stats: {
  totalHorses: <real>,
  activeRacers: <real>,
  competitionsEntered: 0,
  firstPlaceFinishes: 0,
  totalEarnings: <real>,
  breedingPairs: <real>,
}
```

Backend exposes `/api/users/:userId/competition-stats` and `/api/horses/:horseId/competition-history`. Neither is called from this page.

**Impact:** The Hall of Fame is advertised but the numbers are fake. The tester's data says 0 wins, 0 competitions, 0 first-place finishes, regardless of their actual record. This is mock-by-another-name.

---

### P0-7 — `/settings` has no persistence despite being `beta-live`

**File:** [`frontend/src/pages/SettingsPage.tsx`](frontend/src/pages/SettingsPage.tsx)

Grep confirms zero `useMutation`, zero `fetch`, zero `api`/`api-client`, zero `localStorage` references. Every toggle and input is local React state that disappears on navigation. The truth table even admits this: _"Account/display/notification controls appear local-state-only; do not advertise persistence in beta."_

Either wire persistence or explicitly remove from beta scope with a product decision — not a quiet hide.

---

### P1-8 — Dead code with placeholder `console.log` buttons

**File:** [`frontend/src/components/MultiHorseComparison.tsx:222-234`](frontend/src/components/MultiHorseComparison.tsx:222)

Three buttons (`exportToPDF`, `exportToCSV`, `saveComparison`) `console.log` and do nothing. Component is not imported anywhere (`grep -rn "MultiHorseComparison" frontend/src` returns only the file itself).

**Impact:** Confusion risk if any future work imports it. Low.

---

### P1-9 — `POST /api/memory/cleanup` authenticated but not role-restricted

**File:** [`backend/modules/labs/routes/memoryManagementRoutes.mjs:254-290`](backend/modules/labs/routes/memoryManagementRoutes.mjs:254)

Any authenticated beta tester can POST to this route and trigger `memoryManager.cleanupAllResources()`. Not a `/test/cleanup` route so it wasn't in 21R-4 scope, but the spirit of that story applies. Requires admin role or removal.

---

### P1-10 — Duplicated email-error branches in RegisterPage (from 2026-04-03 change 5)

**File:** [`frontend/src/pages/RegisterPage.tsx:85-99`](frontend/src/pages/RegisterPage.tsx:85)

The proposal's onError pattern was a flat `if/else if`. The implementation nests `already exists || already in use` inside a duplicated `email` branch. It works, but is redundant and invites bugs on maintenance. Small cleanup.

---

### P2-11 — Sprint status misrepresents readiness state

**File:** [`_bmad-output/implementation-artifacts/sprint-status.yaml`](_bmad-output/implementation-artifacts/sprint-status.yaml)

Currently says `beta-deployment-readiness: ready-for-signoff`. Given P0-1 through P0-7, this must revert to `blocked` until gaps are closed.

---

### P2-12 — Truth-table language leftover from "hide/defer" era

**File:** [`docs/beta-route-truth-table.md`](docs/beta-route-truth-table.md)

Lines like _"cannot be beta-live"_ co-exist with rows classified `beta-live`. The 2026-04-14 Change F flagged this. Partially addressed; spot-check and finish.

---

## 4. Recommended Approach

**Option:** Direct adjustment inside a single follow-on Epic 21S (or extension of Epic 21R) — no rollback, no product re-scope.

Rejected alternatives:

- **Re-hide `/leaderboards`, `/settings`, `/my-stable`:** user explicitly rejected this. It is passing the buck.
- **Defer to post-beta:** violates the active beta policy.
- **Declare victory despite gaps:** what the current sprint status is doing; being corrected here.

---

## 5. Change Proposals (Ordered by Priority)

### Change A (P0) — Implement `GET /api/leaderboards/user-summary/:userId`

**Backend work:**

- Add controller `getUserRankSummary(req, res)` in `backend/modules/leaderboards/controllers/`.
- Compute per-category rank by reusing existing leaderboard queries (level, xp, horse-earnings, horse-performance), then the user's rank within each.
- Compute `bestRankings` list by filtering categories where the user's rank ≤ some threshold (e.g. top 100 or top 10%).
- Return shape matching `UserRankSummaryResponse` declared in `frontend/src/lib/api/leaderboards.ts`.
- Register as `router.get('/user-summary/:userId', auth, getUserRankSummary)` in [`leaderboardRoutes.mjs`](backend/modules/leaderboards/routes/leaderboardRoutes.mjs).

**Test coverage:**

- Route test: unauthenticated → 401; ghost userId → 404 or empty `rankings: []`; real user with no results → empty arrays; real user with ranks → correct rank position per category.

**Truth-table update:** row for `/leaderboards` — change "cannot be beta-live" note to "implemented + verified by routes test".

---

### Change B (P0) — Remove test-only CSRF/rate-limit bypasses from production code and beta-critical specs

**B.1 Frontend api-client:**

- In [`api-client.ts`](frontend/src/lib/api-client.ts:614), delete the `isTestEnv` branch entirely. The client must always acquire CSRF via the same path as beta.
- Keep `VITE_E2E_TEST` available only for logging/telemetry scope if genuinely needed; remove the CSRF branch.

**B.2 Playwright config:**

- Remove `VITE_E2E_TEST` frontend env var.
- Switch backend launch from `NODE_ENV=test` to `NODE_ENV=beta` (new profile) or `NODE_ENV=staging`. Add a corresponding backend config branch that uses the real CSRF middleware and real rate-limit middleware while pointing at a throwaway Postgres database.
- Update `playwright.config.ts` on both branches (Windows `set` and Unix inline env).

**B.3 Specs:**

- [`global-setup.ts`](tests/e2e/global-setup.ts), [`auth.spec.ts`](tests/e2e/auth.spec.ts), [`beta-critical-path.spec.ts`](tests/e2e/beta-critical-path.spec.ts), [`core-game-flows.spec.ts`](tests/e2e/core-game-flows.spec.ts), [`onboarding-flow.spec.ts`](tests/e2e/onboarding-flow.spec.ts): remove the `x-test-bypass-rate-limit` header injection.
- Where rate limiting matters for test stability, use per-suite unique accounts plus realistic `await page.waitForTimeout` pacing or pre-emptive rate-limit reset via test harness.
- The `tests/e2e/readiness/` suite may keep its support tooling, but it must document that those tools are support-only and not part of the readiness gate.

**B.4 Middleware hardening:**

- In `backend/middleware/csrf.mjs` and `backend/middleware/rateLimiting.mjs`, make the bypass headers no-ops when `NODE_ENV === 'beta' || NODE_ENV === 'production'`. Defence in depth.

**Acceptance verification:**

```powershell
rg -n "x-test-skip-csrf|x-test-bypass-rate-limit" tests/e2e frontend/src/lib/api-client.ts
# Expected: 0 matches
```

---

### Change C (P0) — Wire `/my-stable` career stats to real APIs

**Frontend work in [`MyStablePage.tsx`](frontend/src/pages/MyStablePage.tsx):**

- For each retired horse, fetch `/api/horses/:horseId/competition-history` (or existing hook `useHorseCompetitionHistory`) to populate `competitions`, `wins`, `earnings`.
- For stable stats, fetch `/api/users/:userId/competition-stats` to populate `competitionsEntered`, `firstPlaceFinishes`, and confirm `totalEarnings` matches server aggregation.
- Render loading, empty, and error states.

**Tests:**

- New vitest spec covering: loading skeleton, empty state (no retired horses), populated state (3 mock horses in RTL tree with real hook mocked at the query level).

---

### Change D (P0) — Make `/settings` really persist, or formally remove from beta

Default choice: **make it work.** Removing is the last resort and requires a product decision logged in the truth table.

**Backend work:**

- Add `PATCH /api/auth/profile/preferences` (or extend existing profile update) accepting display/notification/account preference fields. Persist via new columns on `user_preferences` or extend `User` model as appropriate.
- Return the updated preferences.

**Frontend work in [`SettingsPage.tsx`](frontend/src/pages/SettingsPage.tsx):**

- Add `useUpdatePreferences()` mutation hook.
- Wire each toggle/input to the mutation with optimistic update.
- Show save/save-error states.

**Tests:**

- Backend route test: auth required; validation; persistence verification via follow-up GET.
- Frontend test: toggle + mutation invocation assertion.

---

### Change E (P0) — Make `e2e_critical_path` a hard, non-skippable gate

**File:** `scripts/check-beta-readiness.sh` (or equivalent).

- Remove the `--skip-e2e` branch.
- Add server-bootstrap logic inside the script: start backend on 3001 with `NODE_ENV=beta`, frontend on 3000, wait for `/health`, run `npx playwright test tests/e2e/beta-critical-path.spec.ts --project=chromium`, tear down.
- Fail loudly if any server fails to come up.
- Update `docs/beta-signoff.yaml` generator so `gates_skipped` is not an acceptable state for signoff.

**Acceptance:**

```yaml
e2e_critical_path: PASS   # required, SKIP is no longer allowed
gates_passed: 9
gates_skipped: 0
```

---

### Change F (P1) — Delete dead code `MultiHorseComparison.tsx`

**Files:** [`frontend/src/components/MultiHorseComparison.tsx`](frontend/src/components/MultiHorseComparison.tsx) and any colocated `__tests__` or exports referring to it (grep confirms no imports).

---

### Change G (P1) — Require admin role on `POST /api/memory/cleanup`

**File:** [`backend/modules/labs/routes/memoryManagementRoutes.mjs:254`](backend/modules/labs/routes/memoryManagementRoutes.mjs:254)

- Add `requireRole('admin')` middleware (or existing admin guard) after `authenticateToken`.
- Alternative: remove the route entirely and keep cleanup as a CLI script.

---

### Change H (P1) — Flatten duplicated email-error branches in RegisterPage

**File:** [`RegisterPage.tsx:85-99`](frontend/src/pages/RegisterPage.tsx:85)

- Replace nested `already exists || already in use` + repeated `email` checks with the single `message.includes('email') && message.includes('taken')` pattern from the 2026-04-03 proposal.
- Run auth test suite.

---

### Change I (P2) — Revert sprint status to `blocked`

**File:** [`_bmad-output/implementation-artifacts/sprint-status.yaml`](_bmad-output/implementation-artifacts/sprint-status.yaml)

- `beta-deployment-readiness: blocked` until Changes A–E all verified.
- Update `last_updated` header.
- Reopen Story `21r-3` status to `in-progress` until Change B verification passes.
- Reopen Story `21r-6` status to `in-progress` until Change E verification passes.

---

### Change J (P2) — Scrub "hide/defer/read-only" leftover language from truth table

**File:** [`docs/beta-route-truth-table.md`](docs/beta-route-truth-table.md)

- For each beta-live row, ensure the "Known Blockers" cell names a specific implementation task from Changes A–E (or is "none").
- Remove any sentence that instructs future agents to hide/defer/read-only.

---

## 6. Epic and Sprint Impact

- **Epic 21R:** not closed as claimed. Stories `21r-3` and `21r-6` reopen.
- **New Epic (or extension) 21S — Beta Readiness Gap Closure:** holds Changes A through J as user stories.
- **Epics 22+:** continue, no disruption. Frontend polish work is not paused by this proposal; readiness gap fixes run in parallel.
- **Beta deployment:** remains `blocked` until Changes A–E verified and `docs/beta-signoff.yaml` shows `gates_passed: 9, gates_skipped: 0, e2e_critical_path: PASS`.

---

## 7. Suggested Story Breakdown

| Story ID  | Title                                                                    | Owner           | Priority | Change |
| --------- | ------------------------------------------------------------------------ | --------------- | -------- | ------ |
| 21S-1     | Implement user-rank-summary backend endpoint                             | Backend         | P0       | A      |
| 21S-2     | Remove CSRF/rate-limit bypass from api-client.ts and beta-critical specs | Backend + QA    | P0       | B      |
| 21S-3     | Switch Playwright webserver to NODE_ENV=beta profile                     | Backend + QA    | P0       | B.2    |
| 21S-4     | Wire /my-stable to real competition-stats and competition-history APIs   | Frontend        | P0       | C      |
| 21S-5     | Persist Settings preferences via backend PATCH endpoint                  | Backend + FE    | P0       | D      |
| 21S-6     | Make e2e_critical_path gate non-skippable                                | QA              | P0       | E      |
| 21S-7     | Delete dead code MultiHorseComparison.tsx                                | Frontend        | P1       | F      |
| 21S-8     | Require admin role on POST /api/memory/cleanup                           | Backend + Sec   | P1       | G      |
| 21S-9     | Flatten duplicated email-error branches in RegisterPage                  | Frontend        | P1       | H      |
| 21S-10    | Revert sprint-status to blocked; reopen 21r-3 and 21r-6                  | LeadArch / SM   | P2       | I      |
| 21S-11    | Scrub defer/hide language from beta-route-truth-table                    | LeadArch / Docs | P2       | J      |

---

## 8. Acceptance (Readiness Gate)

The correction is complete only when all of the following are true in a clean worktree:

- [ ] `rg -n "x-test-skip-csrf|x-test-bypass-rate-limit" tests/e2e frontend/src/lib/api-client.ts` returns **0 matches**.
- [ ] `grep NODE_ENV playwright.config.ts` shows no `NODE_ENV=test` (replaced by `beta`).
- [ ] `curl http://localhost:3001/api/leaderboards/user-summary/<realUserId>` returns 200 with a `UserRankSummaryResponse` shape.
- [ ] `/my-stable` does not render any hardcoded `0` for `competitions`, `wins`, `competitionsEntered`, or `firstPlaceFinishes` when the tester has real records.
- [ ] `/settings` saves a preference change; after full reload the change is still visible.
- [ ] `scripts/check-beta-readiness.sh` runs E2E without `--skip-e2e` and produces `gates_passed: 9, gates_skipped: 0, e2e_critical_path: PASS`.
- [ ] `MultiHorseComparison.tsx` is deleted or used.
- [ ] `POST /api/memory/cleanup` rejects non-admin callers (403).
- [ ] `RegisterPage.tsx` onError maps email and username errors via flat `if/else if`.
- [ ] Sprint status shows `beta-deployment-readiness: blocked` until the above boxes are all checked, then flips to `ready-for-signoff`.
- [ ] Truth table has no "hide/defer/read-only" instructions on beta-live rows.

---

## 9. MVP Impact

None. These are correctness and honesty fixes. Gameplay scope, epic roadmap, and feature surface are unchanged. What changes is that beta testers can actually test what the truth table says is beta-live, and the readiness signal is no longer based on a skipped gate.

---

## 10. Approval and Handoff

**Recommended agent routing:**

- **LeadArchitect:** own sprint-status revert (Change I) and truth-table scrub (Change J).
- **BackendSpecialistAgent:** Changes A, B.4, D (backend half), G.
- **FrontendSpecialistAgent:** Changes B.1, C, D (frontend half), F, H.
- **QualityAssuranceAgent:** Changes B.2, B.3, E.
- **SecurityArchitect:** review G.

**Handoff target:** `/bmad-correct-course` workflow for sprint-backlog insertion and story generation.

---

_Prepared 2026-04-16 by adversarial code reviewer. Route via BMad Correct Course to create stories 21S-1 through 21S-11 and re-block beta readiness until verification passes._
