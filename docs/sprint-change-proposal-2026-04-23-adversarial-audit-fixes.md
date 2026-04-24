# Sprint Change Proposal — Adversarial Audit Fixes

**Date:** 2026-04-23
**Tracking issue:** `Equoria-ocn9`
**Trigger:** Adversarial audit identified 4 beta-readiness defects (2 P0, 2 P1)
**Mode:** Batch
**Scope classification:** Moderate (multi-artifact, no PRD/architecture re-plan)
**Approved:** User-approved 2026-04-23 (path forward, batch mode, single tracking issue)

---

## Section 1 — Issue Summary

An adversarial code review of the Epic 21R beta-readiness state surfaced four
defects that violate the 21R doctrine ("No false green status. No fake product
values. No bypass evidence."). All four were verified against source before
this proposal.

| #   | Severity | Defect                                                                                                                                                                                                                                                                            |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | P0       | `SettingsPage` is a façade on a `beta-live` route — hardcoded `defaultValue` inputs, no real `Save Changes`/`Update Password`/`Delete Account` handlers, fake "Saved ✓" timer.                                                                                                    |
| 2   | P0       | Horse list quick actions (`HorseListView.tsx:239,243`) navigate to `/training/${id}` and `/competition/enter/${id}` — neither route is registered in `nav-items.tsx`/`App.tsx`. Users get a 404 by inspection.                                                                    |
| 3   | P1       | Two security tests (`parameter-pollution.test.mjs:154,192`) are `it.skip` with TODO comments documenting missing duplicate-key + `__proto__` body-layer defenses.                                                                                                                 |
| 4   | P1       | `rate-limit-circuit-breaker.test.mjs:199-237` asserts behavior for `x-test-bypass-rate-limit` — a header the production middleware (`rateLimiting.mjs:273`) explicitly does not implement. The test passes only because mock requests don't share a key, giving false confidence. |

---

## Section 2 — Impact Analysis

### Epic Impact

- **Epic 21R — Beta Deployment Readiness:** All 4 findings block readiness sign-off until resolved (per CLAUDE.md non-deferral doctrine).
- No other epic affected.

### Artifact Impact

| Artifact                                                                     | Change Required                                                                                                            |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/pages/SettingsPage.tsx`                                        | Wire to `useAuth().user`, `useUpdateProfile`, `useChangePassword`, `useDeleteAccount`; remove fake save state.             |
| `frontend/src/components/HorseListView.tsx`                                  | Quick action handlers route to existing pages with query params.                                                           |
| `frontend/src/components/training/TrainingDashboard.tsx`                     | Read `?horse=` query param and pre-select that horse.                                                                      |
| `frontend/src/pages/CompetitionBrowserPage.tsx`                              | Read `?horse=` query param and pre-fill `selectedHorseId`.                                                                 |
| `backend/middleware/requestBodyGuard.mjs` (NEW)                              | Reject duplicate JSON keys and prototype-pollution payloads at parse time.                                                 |
| `backend/app.mjs`                                                            | Replace `express.json()` with the guarded variant.                                                                         |
| `backend/__tests__/integration/security/parameter-pollution.test.mjs`        | Unskip the two tests; assert 400 for both attack vectors.                                                                  |
| `backend/__tests__/integration/rate-limit-circuit-breaker.test.mjs`          | Delete `Test Environment Bypasses` describe block (asserts non-existent behavior).                                         |
| `backend/__tests__/integration/security/rate-limit-no-bypass.test.mjs` (NEW) | Real-path coverage: hammer rate-limited endpoint until 429, verify `Retry-After`, recover after window. No bypass headers. |

### Technical Impact

- New backend middleware sits in the request pipeline before all `/api/` handlers.
  Behavior is purely additive (rejects malicious payloads with 400) — no
  legitimate request is affected.
- Frontend SettingsPage gains real network mutations; no schema changes.
- Quick-action route changes are purely client-side; no backend impact.
- Rate-limit test changes remove false-confidence coverage and add a real-path
  integration test that does not rely on bypass headers.

---

## Section 3 — Recommended Approach

**Selected: Option 1 — Direct Adjustment.**

All four defects can be addressed within Epic 21R by editing/adding the
artifacts listed in Section 2. No PRD scope change, no architecture
re-decision, no rollback of completed work.

**Rationale:**

- The required infrastructure (`useUpdateProfile`, `useChangePassword`,
  `useDeleteAccount`, query-param pages, rate-limit middleware) already exists.
  The defects are wiring/coverage gaps, not missing systems.
- Each fix has a clear, testable acceptance criterion (Section 4).
- Effort: Medium. Risk: Low. No backwards-compatibility concerns.

---

## Section 4 — Detailed Change Proposals

### Change 1 — SettingsPage real wiring (P0)

**File:** `frontend/src/pages/SettingsPage.tsx`

**OLD (Account section):**

```tsx
const [savedAccount, setSavedAccount] = useState(false);
const handleSaveAccount = () => {
  setSavedAccount(true);
  setTimeout(() => setSavedAccount(false), 2000);
};
// ...
<input id="settings-username" type="text" defaultValue="NobleRider" ... />
<input id="settings-email" type="email" defaultValue="rider@equoria.com" ... />
<button onClick={handleSaveAccount}>{savedAccount ? 'Saved ✓' : 'Save Changes'}</button>
// "Update Password" button — no onClick
// "Delete Account" button — no onClick
```

**NEW:**

- Controlled `<input>`s seeded from `user.username` / `user.email`
- `Save Changes` → `useUpdateProfile().mutate({ username, email })`
- `Update Password` → reveal inline form (oldPassword / newPassword / confirm)
  → `useChangePassword().mutate(...)`. On success: success toast, sign user
  out (sessions invalidated server-side per `auth/change-password` contract).
- `Delete Account` → confirmation modal requiring user to type their username
  → `useDeleteAccount(user.id).mutate()`. On success: `useDeleteAccount`
  already clears cache and redirects to `/login`.
- All states reflect real mutation `isPending`/`isError`/`isSuccess` with
  `sonner` toasts. No fake "Saved ✓" timer.

**Rationale:** `/settings` is `beta-live` (per `betaRouteScope.ts:40`).
Per 21R doctrine: "If a tester can reach a feature with write actions, those
actions must call real APIs and persist real state."

---

### Change 2 — Horse quick action routing (P0)

**Files:**

- `frontend/src/components/HorseListView.tsx`
- `frontend/src/components/training/TrainingDashboard.tsx`
- `frontend/src/pages/CompetitionBrowserPage.tsx`

**OLD (`HorseListView.tsx:239-245`):**

```tsx
const handleTrain = (horseId: number) => {
  navigate(`/training/${horseId}`); // 404 — route not registered
};
const handleCompete = (horseId: number) => {
  navigate(`/competition/enter/${horseId}`); // 404 — route not registered
};
```

**NEW:**

```tsx
const handleTrain = (horseId: number) => {
  navigate(`/training?horse=${horseId}`);
};
const handleCompete = (horseId: number) => {
  navigate(`/competitions?horse=${horseId}`);
};
```

**`TrainingDashboard.tsx`:** add `useSearchParams()` lookup; on mount or when
horses load, if `?horse=N` matches a trainable horse, call `setSelectedHorse(...)`
and scroll the section into view. Falls back gracefully if the horse is not in
the trainable list (e.g. ineligible).

**`CompetitionBrowserPage.tsx`:** add `useSearchParams()` lookup; if `?horse=N`
matches a horse the user owns, pre-set `selectedHorseId` so the entry modal
opens with that horse already chosen.

**Rationale:** Both target routes are registered (`/training`, `/competitions`).
Query-param coupling is the standard React Router pattern for "deep link with
preselected entity" and avoids inflating the route table with parameterized
clones.

---

### Change 3 — Body-layer pollution defenses (P1)

**File (NEW):** `backend/middleware/requestBodyGuard.mjs`

Two-part defense:

1. **Duplicate-key detection (parse-time):** install a `verify` callback on
   `express.json` that captures the raw JSON buffer. After parsing, walk the
   raw text with a small streaming tokenizer that tracks open object scopes
   and the keys seen in each — if any key appears twice in the same object
   (at any depth), throw a 400.

2. **Prototype-pollution detection (post-parse):** recursively walk the parsed
   `req.body`; if any object has an own property named `__proto__`,
   `constructor`, or `prototype`, return 400. This is stricter than the
   reviver approach (which silently strips) — the audit requires explicit
   rejection.

**File:** `backend/app.mjs`

Replace:

```js
app.use(express.json({ limit: '10mb' }));
```

with:

```js
import { secureJsonBodyParser, prototypePollutionGuard } from './middleware/requestBodyGuard.mjs';

app.use(secureJsonBodyParser({ limit: '10mb' }));
app.use(prototypePollutionGuard());
```

**File:** `backend/__tests__/integration/security/parameter-pollution.test.mjs`

- Remove `it.skip(...)` from the two TODO tests (lines 154 + 192).
- Each must now respond with HTTP 400 and `success: false`.

**Rationale:** Per 21R: "No graceful skips. No admitted unimplemented defenses
in beta-readiness coverage." The middleware is generic (applies to all `/api/`
JSON requests), so existing pollution tests for other endpoints continue to
pass.

---

### Change 4 — Bypass test removal + real-path coverage (P1)

**File:** `backend/__tests__/integration/rate-limit-circuit-breaker.test.mjs`

- **DELETE** the `Test Environment Bypasses` describe block (lines 199-237).
  The "should bypass rate limiting with test header" test asserts behavior
  the middleware does not implement (`rateLimiting.mjs:273` explicitly
  comments "No test-only bypass logic"); it passes only because mock
  requests don't share a rate-limit key.

**File (NEW):** `backend/__tests__/integration/security/rate-limit-no-bypass.test.mjs`

Real-path integration test (no bypass headers, real Express app, real
middleware):

- Hammer `/api/auth/login` with invalid credentials from a fixed IP until
  the auth limiter returns 429.
- Assert: `Retry-After` header present, body matches the rate-limit error
  shape, no bypass header was sent.
- Assert: a request without bypass headers is still rate-limited even when
  `process.env.NODE_ENV === 'test'` (proves the gate is real, not a
  test-mode placebo).

**Rationale:** Per 21R: "Do not cite tests that use `x-test-bypass-rate-limit`
as readiness evidence." The deleted block is exactly such a test. The new
test proves the production rate limit works without any escape hatch.

---

## Section 5 — Implementation Handoff

**Scope:** Moderate
**Recipient:** Development team (this Claude Code session)
**Tracking:** `Equoria-ocn9` (in_progress)

**Acceptance criteria (verified before close per `COMPLETION_VERIFICATION_POLICY.md`):**

1. SettingsPage:

   - [ ] `grep -n "defaultValue=\"NobleRider\"\\|defaultValue=\"rider@equoria.com\"\\|setSavedAccount" frontend/src/pages/SettingsPage.tsx` returns 0 matches.
   - [ ] All three buttons (Save Changes / Update Password / Delete Account) call real mutation hooks.

2. Quick actions:

   - [ ] `grep -n "navigate(\\\`/training/\\\${\\|navigate(\\\`/competition/enter/" frontend/src/` returns 0 matches.
   - [ ] Manual UX verification: from `/stable`, clicking quick-action Train/Compete lands on the right page with the chosen horse selected.

3. Pollution defenses:

   - [ ] `grep -n "it.skip" backend/__tests__/integration/security/parameter-pollution.test.mjs` returns 0 matches.
   - [ ] `npm test -- parameter-pollution` passes (all tests, no skips).

4. Bypass cleanup:
   - [ ] `grep -rn "x-test-bypass-rate-limit" backend/__tests__/integration/rate-limit-circuit-breaker.test.mjs` returns 0 matches.
   - [ ] `npm test -- rate-limit-no-bypass` passes (new file).

**Sign-off:** Per CLAUDE.md, do NOT mark `Equoria-ocn9` closed without
explicit user approval. Report results with evidence.

---

## Section 6 — Review Findings (bmad-code-review, 2026-04-24)

Three-layer adversarial review (Blind Hunter + Edge Case Hunter + Acceptance Auditor) of commits `7988b999` and `27214cc6` produced 40 raw findings → triaged to 2 decision-needed, 13 patches, 25 dismissed.

### Decision-Needed (resolve before patch phase)

- [ ] [Review][Decision] Pre-push hook blocks all pushes when test DB is unreachable — Hook runs full backend suite on every push; with Postgres down, even doc-only pushes are blocked. Add a connectivity probe with a clear failure message? Skip the integration suite when DB is down? Allow user override via env var? Or accept the current "DB must be up to push" stance? [.husky/pre-push:38-45]
- [ ] [Review][Decision] `rate-limit-no-bypass.test.mjs` exercises a synthetic `/probe` route, not the production `/api/auth/login` mounted limiter — Spec Section 4 said "hammer `/api/auth/login` with invalid credentials … assert `Retry-After` header." Implementation uses a fresh Express app with a fresh `createRateLimiter` on `/probe`. Functionally proves the limiter trips and bypass headers don't help, but does not prove the production-mounted limiter on the real auth route works end-to-end. Acceptable as-is, or add a real-route assertion? [backend/__tests__/integration/security/rate-limit-no-bypass.test.mjs:59-83]

### Patch (fix before closing Equoria-ocn9)

- [ ] [Review][Patch] Unicode-escape bypass in `detectDuplicateJsonKeys` — Keys are stored as raw escaped substrings, so `{"name":"a","\u006eame":"b"}` is seen as two distinct keys but JSON.parse collapses both to `name`. Fix: JSON-parse each captured key string before adding to the dedupe Set. [backend/middleware/requestBodyGuard.mjs:114]
- [ ] [Review][Patch] `prototypePollutionGuard` is mounted before `express.urlencoded` — urlencoded payloads with `__proto__[isAdmin]=true` reach controllers without inspection. Fix: also mount the guard after the urlencoded parser. [backend/app.mjs:411-414]
- [ ] [Review][Patch] `findPollutionKey` is unbounded recursive — A 10 MB deeply-nested JSON body that JSON.parse accepts crashes the worker with `RangeError: Maximum call stack size exceeded` → 500 instead of 400; DoS vector against the very middleware that's supposed to defend. Fix: convert to iterative walk with explicit depth cap (e.g., 200). [backend/middleware/requestBodyGuard.mjs:195]
- [ ] [Review][Patch] Replacement env-override test only asserts `expect(limiter).toBeDefined()` — Loses the regression coverage of the deleted bypass-header test. Fix: send max+1 requests with `TEST_RATE_LIMIT_MAX_REQUESTS=999999` set against a `useEnvOverride: false` limiter; assert 429 fires at the hardcoded max, not the inflated env value. [backend/__tests__/integration/rate-limit-circuit-breaker.test.mjs:218-237]
- [ ] [Review][Patch] Pre-push hook docstring claims `--max-old-space-size` applies to workers — It only applies to the parent node process; child workers don't inherit CLI argv. Fix the comment to match reality. [.husky/pre-push:14-30]
- [ ] [Review][Patch] Deep-link `?horse=` persists in URL after manual selection — User lands on `/training?horse=5`, manually selects horse 7, navigates away, hits back → component remounts and re-selects horse 5. Fix: call `setSearchParams({})` after auto-select. [frontend/src/components/training/TrainingDashboard.tsx:177-192, frontend/src/pages/CompetitionBrowserPage.tsx:48-65]
- [ ] [Review][Patch] SettingsPage resync effect is broken — Logic only re-syncs when local field is empty. Two failure modes: (a) user clears the field intending to type a new value, profile refetches, server value snaps back, wiping their edit; (b) server normalizes the saved value but local form keeps un-normalized text → next Save sees a diff and re-submits forever. Fix: remove the effect entirely (let React Query be the source of truth) OR track an explicit `dirty` flag. [frontend/src/pages/SettingsPage.tsx:127-131]
- [ ] [Review][Patch] No success toast on Save Changes — Real mutation wired but only `onError` handled. Users see no confirmation. Fix: add `onSuccess` toast. [frontend/src/pages/SettingsPage.tsx:142-147]
- [ ] [Review][Patch] Logout failure after change-password leaves user in a zombie state — Server invalidated all sessions; if `logout.mutate()` fails, client still thinks user is logged in. Fix: `window.location.href = '/login'` in `onSettled` regardless of outcome. [frontend/src/pages/SettingsPage.tsx:183-191]
- [ ] [Review][Patch] Delete-account modal cannot be dismissed by Escape or backdrop click — Required by `role="dialog" aria-modal="true"` ARIA convention. Fix: add Escape keydown handler + backdrop `onClick`. [frontend/src/pages/SettingsPage.tsx:402-420]
- [ ] [Review][Patch] Delete-account modal has no `autoFocus` and no focus trap — Tabbing escapes the modal. Fix: at minimum add `autoFocus` to the confirm input. [frontend/src/pages/SettingsPage.tsx:402-420]
- [ ] [Review][Patch] Delete confirm comparison is whitespace-sensitive — Browser autofill trailing space blocks delete. Fix: `.trim()` the input before comparison. [frontend/src/pages/SettingsPage.tsx:210]
- [ ] [Review][Patch] Pre-push hook hardcodes `node_modules/jest/bin/jest.js` — Cryptic "Cannot find module" on first push from a fresh clone/worktree. Fix: presence check with helpful message, or use `npx jest`. [.husky/pre-push:42]

### Dismissed (25 findings)

B1 (duplicate-key test missing Content-Type — verified false: line 168 has `.set('Content-Type', 'application/json')`); B4 (`\u` escape only skips 2 chars — hex digits not tokenizer-relevant); B10 (defensive `__proto__` descriptor check is dead code — harmless); E2 (unicode-escape bypass also affects `__proto__` — caught by post-parse guard); E3 (top-level JSON literals not guarded — no attack surface); E7 (jsonBodyErrorHandler hardcodes 400 — correct for this error); E9 (RateLimit-\* header lowercase coupling — acceptable test brittleness); E11 (hex/octal in `?horse=` — ownership check ensures safety); E12 (multiple `?horse=` params — acceptable URL semantics); E14 (horse not found → silent no-op — acceptable for query-param miss); E15 (horse list refetch race — pre-existing pattern); E16 (`?horse=' '` whitespace — no real failure); E21 (trim-only username silently skipped — acceptable); E25 (Enter in password form — validation catches it); E26 (useChangePassword no profile invalidation — logout fires anyway); E30 (`cd backend` relative path — Husky invokes from repo root); E31 (Windows path slashes — Husky uses Git Bash); A2 (scroll-into-view nice-to-have — not in AC); A3 partial (cannot verify `npm test` from diff — verified: push5 ran 4825/4825); E4/E6, E13/E20 (duplicates merged into patches above).
