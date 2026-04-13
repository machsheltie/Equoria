# Sprint Change Proposal — 21R Seventh-Pass Course Correction

**Date:** 2026-04-13  
**Story:** 21R-2 — Remove Production Frontend Mocks from Beta-Facing Code  
**Triggered by:** Seventh-pass adversarial review findings (another LLM)  
**Scope:** Moderate — additional tasks within 21R-2; critical-path E2E pulled forward from 21R-3  
**Prepared by:** Scrum Master (bmad-correct-course)

---

## Section 1: Issue Summary

### Problem Statement

A seventh-pass adversarial review of 21R-1 and 21R-2 confirms the sixth-pass code corrections were applied correctly to the runtime implementation, but four compounding issues remain that prevent the beta-readiness gate from being unlocked:

1. **Documentation drift:** Fifth-pass finding markers (`[ ]`) in 21R-1 were never updated to `[x]` for items fixed during the sixth-pass. The document falsely implies seven critical/high issues are still unresolved.
2. **Beta-readonly routes appear in beta navigation (High):** NavPanel filters only `beta-hidden` routes. Beta-readonly routes (`/training`, `/competitions`, `/breeding`, `/bank`, `/marketplace`, etc.) remain visible to beta users — routes that have no working gameplay behind them.
3. **No production-parity E2E coverage (High):** The critical path `register → onboard → horse persisted → /stable shows horse` has no Playwright test. Unit tests prove component behavior with mocked APIs; they do not prove the actual system works for a new beta player.
4. **Mock-backed route debt has no owners (Medium):** `MOCK_RECENT_ACTIVITY`, `MOCK_STABLE`, `MOCK_HALL_OF_FAME`, and `MOCK_VET_HISTORY` remain in production source with no assigned story or tracking issue.

### Root Cause

The sprint has been operating under a "beta-readonly = acceptable placeholder" assumption. The product direction clarified during this correction is: **if a feature is not fully live, it is not shown in beta**. Beta-readonly and beta-hidden are the same outcome for a beta tester: they see nothing useful. Every hour spent scaffolding readonly states is an hour not spent shipping a working feature.

### New Project Policy (effective immediately)

> **No mocks. No beta-readonly routes in beta navigation. Ship working or ship nothing.**
>
> - All backend tests must use the real database. No mocked Prisma calls.
> - All E2E tests must use real credentials and a real backend. No bypass headers, no `x-test-user`, no `test.skip` on beta-critical flows.
> - Beta navigation (`NavPanel`) shows only `beta-live` routes. `beta-readonly` is a planning classification only — it does not earn a visible nav link in beta.

---

## Section 2: Impact Analysis

### Epic Impact

| Epic                     | Impact                                                                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| 21R — Beta Readiness     | 21R-2 needs Tasks 11–15 added. 21R-3 critical-path task pulled into 21R-2. 21R-3 retains tasks 2–6.                                     |
| 21 — Test Quality Sprint | Story 21-5 (React Query hook tests) and 21-8 (E2E credential strategy migration) must honor the no-mocks policy when implemented.       |
| Future epics (22–30)     | All new features must be built to beta-live quality from the start. beta-readonly is not an acceptable intermediate state for new work. |

### Story Impact

| Story           | Impact                                                                   |
| --------------- | ------------------------------------------------------------------------ |
| 21R-2 (current) | Add Tasks 11–15. Story cannot close until E2E critical path passes.      |
| 21R-3 (backlog) | Task 1 (critical path E2E) pulled into 21R-2. Tasks 2–6 remain in 21R-3. |
| 21R-1 (done)    | Documentation cleanup only — update fifth-pass `[ ]` markers to `[x]`.   |

### Artifact Conflicts

| Artifact                                                        | Conflict                                                                                                                   |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `docs/beta-route-truth-table.md`                                | Status semantics for `beta-readonly` must be updated to reflect that beta-readonly routes do NOT appear in beta navigation |
| `_bmad-output/implementation-artifacts/21r-1-...md`             | Fifth-pass finding markers for F1–F7 are `[ ]` — must be `[x]`                                                             |
| `_bmad-output/implementation-artifacts/21r-2-...md`             | Add Tasks 11–15                                                                                                            |
| `CLAUDE.md`                                                     | Testing philosophy section must state no-mocks policy                                                                      |
| `frontend/src/components/layout/NavPanel.tsx`                   | Filter both beta-hidden AND beta-readonly from beta nav                                                                    |
| `frontend/src/config/__tests__/betaRouteScope.test.ts`          | Add test verifying nav-visible routes are only beta-live in beta mode                                                      |
| New: `e2e/beta-critical-path.spec.ts`                           | New Playwright spec for critical path                                                                                      |
| New: `frontend/src/config/__tests__/betaRouteScopeSync.test.ts` | Drift guard: truth table ↔ runtime scope                                                                                  |

---

## Section 3: Recommended Approach

**Option 1: Direct Adjustment** — selected.

Add tasks within 21R-2 rather than opening new stories. The issues are all within the defined 21R-2 scope (beta-scope enforcement, mock removal, beta navigation correctness, test coverage). No rollback or MVP review is warranted — the sixth-pass code is correct; the gaps are in completeness.

**Timeline impact:** 21R-2 remains `review` until Tasks 11–15 pass. This is not an extension — the story was never fully verified. Completing it correctly now avoids a full re-review cycle later.

---

## Section 4: Detailed Change Proposals

---

### Change A: Documentation — Fix 21R-1 Fifth-Pass Markers

**File:** `_bmad-output/implementation-artifacts/21r-1-define-beta-scope-and-navigation-truth-table.md`  
**Section:** Fifth-Pass Adversarial Review Findings

Update findings F1–F7 from `[ ]` to `[x]` with evidence citing the actual code state after sixth-pass corrections.

| Finding                                                      | Status | Evidence                                                                            |
| ------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------- |
| F1: `/onboarding` still `beta-readonly` in betaRouteScope.ts | Fixed  | `betaRouteScope.ts:39` `'/onboarding': 'beta-live'`                                 |
| F2: Tests assert "four beta-live routes"                     | Fixed  | `betaRouteScope.test.ts:105` — "five beta-live routes"                              |
| F3: Onboarding navigates to `/my-stable`                     | Fixed  | `OnboardingPage.tsx:365` `navigate('/stable')`                                      |
| F4: onError fakes success                                    | Fixed  | `OnboardingPage.tsx:367-369` — error toast only, no navigate                        |
| F5: OnboardingGuard trusts localStorage                      | Fixed  | `OnboardingGuard.tsx:17` — "Server state is the sole source of truth"               |
| F6: Skip button bypasses horse selection                     | Fixed  | `OnboardingPage.tsx:491` — `{currentStep === 0 && !isBetaMode && ...}`              |
| F7: Truth table stale re: `horsesApi.create`                 | Fixed  | `api-client.ts` — `horsesApi.create` exists; `beta-route-truth-table.md:29` updated |

---

### Change B: New Project Policy — No Mocks (applies to all new code)

**File:** `CLAUDE.md` — Testing Philosophy section

**OLD:**

```markdown
### Testing Philosophy

- **Balanced mocking:** External dependencies only (DB, HTTP, logger)
- **Real business logic:** Test actual implementations
```

**NEW:**

```markdown
### Testing Philosophy

- **No mocks. Ever.** All backend tests run against the real test database. No mocked Prisma calls.
- **Integration by default:** Backend tests call real controllers, real services, real DB. Mocking a DB call is testing nothing.
- **Frontend unit tests:** Existing tests with mocked API responses may stay. Do NOT add new vi.mock-of-API-client tests. Prefer Playwright E2E for any new user-facing feature coverage.
- **E2E tests (Playwright):** Real credentials, real backend, real DB. No bypass headers, no x-test-user, no test.skip on beta-critical paths.
- **Fail fast:** A test that passes while hiding a broken feature is worse than no test.
```

---

### Change C: NavPanel — Beta-Live Only in Beta Mode

**File:** `frontend/src/components/layout/NavPanel.tsx:55-58`

**OLD:**

```typescript
/** In beta mode, hide beta-hidden routes from the nav panel. */
const NAV_SECTIONS = isBetaMode
  ? ALL_NAV_SECTIONS.filter((item) => !isBetaHidden(item.href))
  : ALL_NAV_SECTIONS;
```

**NEW:**

```typescript
/** In beta mode, show only beta-live routes. beta-readonly and beta-hidden are both excluded. */
const NAV_SECTIONS = isBetaMode
  ? ALL_NAV_SECTIONS.filter((item) => isBetaLive(item.href))
  : ALL_NAV_SECTIONS;
```

**Import change:** Add `isBetaLive` to the import from `@/config/betaRouteScope`.

**Result:** Beta nav contains only `Home (/)` and `My Stable (/stable)`. All other entries (`/training`, `/competitions`, `/breeding`, `/marketplace`, `/messages`, `/bank`, `/settings`, `/world`) are removed from beta navigation.

**Test:** New `frontend/src/components/layout/__tests__/NavPanel.beta.test.tsx`

- Assert beta mode nav contains exactly 2 items: Home and My Stable
- Assert non-beta mode nav contains all 11 items (regression guard)
- Assert no beta-readonly routes appear in beta nav

---

### Change D: Update Truth Table Status Semantics

**File:** `docs/beta-route-truth-table.md` — Status Semantics section

**OLD:**

```markdown
- **beta-readonly:** May be visible to beta users only if unsupported actions are absent, disabled with honest copy, or clearly excluded from beta. It must not look like playable unsupported gameplay.
```

**NEW:**

```markdown
- **beta-readonly:** Planning classification only. These routes are NOT shown in beta navigation. A beta-readonly route is a route scheduled for upgrade to beta-live; it has no nav presence until that upgrade is complete. Direct-URL access to a beta-readonly route shows BetaExcludedNotice.
```

---

### Change E: Registration Integration Test (No Mocks, Real DB)

**File:** New `backend/__tests__/auth/register-starter-horse.test.mjs`

**Purpose:** Prove that `POST /api/auth/register` creates a user AND a starter horse atomically in the real test database. This test must fail if the horse creation is broken.

```javascript
// Test: registration produces a user AND a starter horse
// Uses real Prisma, real DB — no mocked calls
it('creates a starter horse for the new user on registration', async () => {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ username: uniqueUser, email: uniqueEmail, password: 'Test1234!' });

  expect(res.status).toBe(201);
  const userId = res.body.data?.user?.id;
  expect(userId).toBeDefined();

  // Real DB query — no mock
  const horses = await prisma.horse.findMany({ where: { userId } });
  expect(horses.length).toBeGreaterThanOrEqual(1);
});
```

**Rationale:** If the `catch (horseError)` swallow in `authController.mjs:140` silently drops a horse creation failure, this test catches it immediately. This is the fail-fast test that the adversarial reviewer said was missing.

---

### Change F: E2E Critical Path (Pulled from 21R-3 Task 1)

**File:** New `e2e/beta-critical-path.spec.ts`

**Requirements:**

- No `test.skip`, no `--bypass-auth`, no `x-test-user` header, no hardcoded tokens
- Real user registration via UI
- Real onboarding: pick breed, pick gender, enter horse name, submit
- Assert `POST /api/horses` response contains a horse ID
- Assert `GET /api/horses` returns array containing horse with the selected name
- Assert `/stable` renders a card with the correct horse name

**Structure:**

```typescript
test.describe('Beta Critical Path — New Player Front Door', () => {
  test('register → onboard → horse persisted → /stable shows horse', async ({ page }) => {
    // 1. Register fresh account
    // 2. Complete onboarding wizard
    // 3. Assert horse created in backend
    // 4. Assert /stable shows that horse
  });
});
```

**Prerequisite:** Backend and frontend running against test DB (same setup as existing E2E suite). Record exact command in Dev Agent Record.

---

### Change G: Beta-Readonly Direct-Route Blocking

**Background:** With nav filtering to beta-live only, a beta user who manually types `/training` should see `BetaExcludedNotice`, not the training page. This is consistent with existing beta-hidden behavior.

**Proposed approach:** In `App.tsx` (or route wrappers), add a check: if `isBetaMode` and route is NOT `beta-live`, render `<BetaExcludedNotice />`. This replaces the current behavior where beta-readonly routes render with partial content.

**Scope note:** This change has wider surface area than NavPanel. It is included as Task 15 in 21R-2 so it is tracked and not deferred.

---

### Change H: Docs/Config Drift Guard

**File:** New `frontend/src/config/__tests__/betaRouteScopeSync.test.ts`

**Purpose:** Read `docs/beta-route-truth-table.md` at test time; assert every route classified `beta-live` in the markdown is present in `BETA_SCOPE` as `'beta-live'`. Fails loudly if someone updates the truth table without updating the runtime scope.

---

### Change I: Create Tracking Issues for Mock-Backed Routes

**Action:** Create `bd` issues (not deferred parking):

| Route/Component       | Mock to Replace                    | Owner           |
| --------------------- | ---------------------------------- | --------------- |
| `CommunityPage.tsx`   | `MOCK_RECENT_ACTIVITY`             | 21R-5 / Epic 27 |
| `MyStablePage.tsx`    | `MOCK_STABLE`, `MOCK_HALL_OF_FAME` | 21R-5 / Epic 24 |
| `HorseDetailPage.tsx` | `MOCK_VET_HISTORY`                 | 21R-5 / Epic 24 |

Each gets a `bd create` issue with a clear title, real API contract reference, and assigned story. No parking in Dev Notes comments.

---

## Section 5: Implementation Handoff

### Scope Classification: Moderate

All changes are within 21R-2 scope. No strategic replan required.

### New Tasks for 21R-2

| Task        | Description                                                                                        | AC Satisfied |
| ----------- | -------------------------------------------------------------------------------------------------- | ------------ |
| **Task 11** | NavPanel: filter to beta-live only in beta mode; NavPanel.beta.test.tsx                            | AC2, AC6     |
| **Task 12** | E2E critical path: register → onboard → horse persisted → /stable (real credentials, real backend) | AC6          |
| **Task 13** | Backend integration test: `POST /api/auth/register` creates a starter horse (real DB, no mocks)    | AC5, AC6     |
| **Task 14** | Beta-readonly direct-route blocking via App.tsx or route wrapper; update truth table semantics     | AC2, AC3     |
| **Task 15** | Docs/config drift guard (`betaRouteScopeSync.test.ts`); `bd create` issues for mock-backed routes  | AC1, AC6     |

### 21R-2 Close Criteria (all must pass)

- [ ] NavPanel shows only Home and My Stable in beta mode (Task 11 test passes)
- [ ] E2E critical path passes: fresh registration → onboarding → horse in `/stable` (Task 12)
- [ ] Backend registration integration test passes against real DB (Task 13)
- [ ] Direct navigation to `/training` (and other readonly routes) in beta renders `BetaExcludedNotice` (Task 14)
- [ ] `betaRouteScopeSync.test.ts` passes (Task 15)
- [ ] Fifth-pass `[ ]` markers updated to `[x]` in 21R-1 (Change A)
- [ ] `CLAUDE.md` testing philosophy updated (Change B)
- [ ] Truth table semantics updated (Change D)
- [ ] `bd` issues created for each mock-backed route (Change I)

### Handoff Recipients

- **Dev Agent (immediate):** Implement Tasks 11–15
- **21R-3 (backlog, next story):** Tasks 2–6 (login smoke, horse detail smoke, CI integration, no-bypass verification, E2E gate) — Task 1 is now in 21R-2
- **Epic 21-5 / 21-8:** Must honor no-mocks policy when those stories are worked

---

## Appendix: Verification Commands

After all tasks complete, run:

```bash
# 1. Confirm no mock-backed routes leak into beta-live nav
npm --prefix frontend run test:run -- --run src/components/layout/__tests__/NavPanel.beta.test.tsx

# 2. Confirm beta scope runtime matches truth table
npm --prefix frontend run test:run -- --run src/config/__tests__/betaRouteScopeSync.test.ts

# 3. Confirm onboarding persistence tests pass
npm --prefix frontend run test:run -- --run src/pages/__tests__/OnboardingPage.test.tsx

# 4. Confirm registration integration test passes (real DB)
cd backend && npm test -- register-starter-horse

# 5. Run E2E critical path (requires dev stack running)
cd frontend && npx playwright test e2e/beta-critical-path.spec.ts

# 6. Mock scan — confirm no new mocks in beta-facing code
rg -n "mockApi|MOCK_|allMockHorses|mockSummary" frontend/src/pages frontend/src/components frontend/src/hooks/api

# 7. Beta navigation scan — confirm no beta-readonly or beta-hidden links
rg -n "beta-readonly|beta-hidden" frontend/src/components/layout/NavPanel.tsx
```
