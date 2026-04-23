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
