# Sprint Change Proposal — Onboarding Beta-Critical Reclassification

**Date:** 2026-04-13  
**Change Trigger:** Correct-course finding 7 — `/onboarding` misclassified as `beta-readonly`  
**Source:** Post-review of 21R-1/21R-2 handoff during Epic 21R sprint  
**Scope:** Moderate — artifact updates + 21R-2 task addition + 21R-3 story anchoring  
**Status:** Awaiting Heirr approval

---

## Section 1 — Issue Summary

**Problem:** `docs/beta-route-truth-table.md` classifies `/onboarding` as `beta-readonly` and defers starter-horse persistence verification to 21R-2 as an optional decision. This classification is wrong.

**Why it matters:** Onboarding is the mandatory front door for every new beta tester. The flow is:

1. Register → 2. Verify/Login → 3. Onboarding (pick horse) → 4. Stable (see horse)

If step 3 does not persist the horse to the database, step 4 is empty and the tester's first session is broken. A beta tester who completes onboarding and arrives at an empty stable cannot play the game. This is not an optional polish gap — it is the single most critical playability blocker in the beta route set.

**Evidence:**

| File | Finding |
|---|---|
| `frontend/src/pages/OnboardingPage.tsx:321-327` | `completeMutation` calls `authApi.advanceOnboarding()` only — no `POST /api/horses` call |
| `frontend/src/pages/OnboardingPage.tsx:276-312` | Horse selection stored in `sessionStorage`, cleared on `completeMutation.onSuccess`, never sent to backend |
| `frontend/src/lib/api-client.ts:856-860` | `horsesApi` has `list`, `get`, `getTrainingHistory`, `getBreedingData`, `update`, `getConformation`, `getBreedAverages` — no `create` method |
| `backend/.augment/docs/api_specs.markdown:30` | `POST /api/horses` endpoint exists with body `{ name, age, breedId, ownerId, stableId, userId? }` |
| `docs/beta-route-truth-table.md:29` | `/onboarding` status = `beta-readonly`; blocker deferred; follow-up is `21R-2, 21R-3` (vague, not critical) |
| `docs/beta-route-truth-table.md:108` | Beta-live minimum set lists `/login`, `/register`, `/`, `/stable` — omits `/onboarding` entirely |

**Root cause:** 21R-1 correctly noted that "starter-horse selection persistence must be verified before beta-live" — but then classified the route as `beta-readonly` instead of treating that as a blocker requiring immediate resolution in 21R-2.

---

## Section 2 — Impact Analysis

**Epic Impact:**  
Epic 21R is not structurally affected. All six stories remain valid. The correction is a scope clarification inside 21R-2 and a prioritization anchor for 21R-3.

**Story Impact:**

| Story | Impact |
|---|---|
| 21R-1 (done) | Needs a fourth-pass review finding added to the artifact documenting the misclassification. Story remains `done` — the finding is a handoff record, not a re-opener. |
| 21R-2 (review) | Must add Task 10: wire `POST /api/horses` into `OnboardingPage`, expose `horsesApi.create`, update `betaRouteScope.ts`, and add focused tests. This is a must-fix before 21R-2 can pass review. |
| 21R-3 (backlog) | Story artifact does not yet exist. When created, onboarding must be its **first** E2E path: `register → login → onboarding → create starter horse → stable shows that horse`. Not a secondary path. Not skippable. |

**Artifact Conflicts:**

| Artifact | Required Change |
|---|---|
| `docs/beta-route-truth-table.md` | Upgrade `/onboarding` row: `beta-readonly` → `beta-live`; add `POST /api/horses` to Required APIs; update Known Blockers; update Mandatory Follow-Up text |
| `_bmad-output/implementation-artifacts/21r-1-...md` | Add fourth-pass review finding documenting the misclassification |
| `_bmad-output/implementation-artifacts/21r-2-...md` | Add Task 10 (onboarding horse persistence); add scope boundary note |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | No structural change needed — 21R-2 remains `review` until Task 10 passes |

**Technical Impact:**

- `frontend/src/lib/api-client.ts` needs `horsesApi.create` method
- `frontend/src/pages/OnboardingPage.tsx` needs chained mutation: create horse → advance onboarding → navigate to `/stable`
- `frontend/src/config/betaRouteScope.ts` needs `/onboarding` upgraded from `beta-readonly` to `beta-live`
- Backend `POST /api/horses` endpoint exists; body shape must be confirmed from `backend/modules/horses/` before wiring
- New starter horse defaults needed: `age: 1` (foal), sex mapping `'Mare'` → `'F'` / `'Stallion'` → `'M'`

---

## Section 3 — Recommended Approach

**Selected Path:** Direct Adjustment (Option 1)

**Rationale:** The backend endpoint exists (`POST /api/horses`). The frontend collection UI exists (`HorseStep` in `OnboardingPage.tsx`). The gap is a single missing chained API call. This is a targeted fix, not a re-architecture. Adding it to 21R-2 as Task 10 keeps it inside the current sprint with no replanning overhead.

**Effort:** Low–Medium (add `horsesApi.create` to api-client; rewrite `completeMutation`; add 4–6 focused Vitest tests)  
**Risk:** Low (backend endpoint verified; no new auth surface; no new route registrations)  
**Timeline Impact:** Adds 1–2 hours of dev work to the 21R-2 review cycle; does not affect 21R-3 onwards

---

## Section 4 — Detailed Change Proposals

### Change 4.1 — `docs/beta-route-truth-table.md`

**Edit A — Upgrade `/onboarding` row (line 29)**

OLD:
```
| `/onboarding`      | Onboarding      | `frontend/src/App.tsx` | `OnboardingPage`     | beta-readonly | `GET /api/v1/breeds`, `POST /api/auth/advance-onboarding`, `GET /api/auth/profile`                      | Complete intro flow and advance onboarding state             | Current page advances onboarding but starter-horse selection persistence must be verified before beta-live                                      | 21R-2, 21R-3 |
```

NEW:
```
| `/onboarding`      | Onboarding      | `frontend/src/App.tsx` | `OnboardingPage`     | beta-live     | `GET /api/v1/breeds`, `POST /api/auth/advance-onboarding`, `GET /api/auth/profile`, `POST /api/horses` | Complete intro wizard: select breed/gender/name, persist starter horse via POST /api/horses, advance onboarding state, navigate to /stable | OnboardingPage collects breed/gender/name but never calls POST /api/horses — horse data is discarded to sessionStorage only; horsesApi.create does not exist in api-client.ts; must be implemented in 21R-2 before this route is treated as beta-live | 21R-2 |
```

**Edit B — Update beta-live minimum set (line ~101–108)**

OLD:
```
The current minimum beta-live route set is deliberately small:

- `/login`
- `/register`
- `/`
- `/stable`
```

NEW:
```
The current minimum beta-live route set is deliberately small:

- `/login`
- `/register`
- `/onboarding` (must-fix: horse persistence gap — assigned to 21R-2 Task 10)
- `/`
- `/stable`
```

**Edit C — Update Mandatory Follow-Up Decisions (line ~119)**

OLD:
```
- 21R-2 must decide whether `/onboarding`, `/horses/:id`, `/training`, `/breeding`, `/competitions`, and `/bank` can be upgraded from readonly to live after mock/placeholder cleanup.
```

NEW:
```
- ~~21R-2 must decide whether `/onboarding`, `/horses/:id`, `/training`, `/breeding`, `/competitions`, and `/bank` can be upgraded from readonly to live after mock/placeholder cleanup.~~ **Revised 2026-04-13 (course correction):** `/onboarding` is now classified `beta-live` — it is the mandatory front door and its upgrade is not optional. 21R-2 Task 10 must wire `POST /api/horses` into `OnboardingPage.tsx` and expose `horsesApi.create` in `api-client.ts`. The remaining routes (`/horses/:id`, `/training`, `/breeding`, `/competitions`, `/bank`) remain `beta-readonly` pending their own verification.
```

---

### Change 4.2 — `_bmad-output/implementation-artifacts/21r-1-define-beta-scope-and-navigation-truth-table.md`

**Add new section after "Third-Pass Correction Plan":**

```markdown
### Fourth-Pass Review Finding - 2026-04-13

- [ ] [Review][Patch][Critical] `/onboarding` is classified `beta-readonly` in the truth table, but this is wrong — onboarding is the mandatory front door of the beta. A beta tester who registers, picks a horse, and clicks "Begin" must arrive at `/stable` with that horse in the database. The current `OnboardingPage.tsx` collects breed, gender, and horse name across three steps, but its `completeMutation` calls only `authApi.advanceOnboarding()` and then discards all horse data (stored only in `sessionStorage`). `POST /api/horses` is never called. `horsesApi.create` does not exist in `api-client.ts`. The truth table must classify `/onboarding` as `beta-live`, the Known Blockers must name the missing horse persistence explicitly, and 21R-2 must fix it as a must-fix — not a "decide whether to upgrade" decision. Evidence: `docs/beta-route-truth-table.md:29`, `frontend/src/pages/OnboardingPage.tsx:321-327`, `frontend/src/lib/api-client.ts:856-860`, `backend/.augment/docs/api_specs.markdown:30`.

### Fourth-Pass Correction Plan

1. Update `docs/beta-route-truth-table.md` row for `/onboarding`: upgrade to `beta-live`; add `POST /api/horses` to Required APIs; update Primary Actions and Known Blockers; set Follow-up to `21R-2` only.
2. Add `/onboarding` to the beta-live minimum set section in the truth table.
3. Update Mandatory Follow-Up Decisions to strike the ambiguous "decide whether to upgrade" language and replace with the explicit horse-persistence must-fix.
4. Add Task 10 to 21R-2 covering `horsesApi.create`, `OnboardingPage` mutation chain, `betaRouteScope.ts` upgrade, and focused tests.
5. Record in the 21R-3 story when it is created that the first production-parity E2E path is: `register → login → onboarding → create starter horse → stable shows that horse`.
```

---

### Change 4.3 — `_bmad-output/implementation-artifacts/21r-2-remove-production-frontend-mocks-from-beta-facing-code.md`

**Add Task 10 after the existing Task 9 block:**

```markdown
- [ ] **Task 10 - Onboarding starter-horse persistence (beta-critical must-fix) — course correction 2026-04-13**
  - [ ] 10.1 Add `horsesApi.create` to `frontend/src/lib/api-client.ts`. Endpoint: `POST /api/horses`. Confirm the request body shape from `backend/modules/horses/` (controller or routes file) before hardcoding it. Expected shape based on `api_specs.markdown`: `{ name: string, breedId: number, sex: 'M' | 'F', age: number, userId: number }`. Map `OnboardingPage` gender values: `'Mare'` → `'F'`, `'Stallion'` → `'M'`. Use `age: 1` for starter foals unless the backend requires a different default.
  - [ ] 10.2 In `frontend/src/pages/OnboardingPage.tsx`, replace the `completeMutation` with a two-step chain: (1) call `horsesApi.create(...)` with the collected `horseSelection` and the current user's ID from auth context; (2) on success, call `authApi.advanceOnboarding()`; (3) invalidate `['horses']` and `['profile']` query keys; (4) clear `sessionStorage`; (5) navigate to `/stable`, not `/bank` — the tester must immediately see the persisted horse. If horse creation fails, surface a user-facing error toast and do not advance onboarding state.
  - [ ] 10.3 Update `frontend/src/config/betaRouteScope.ts`: change `/onboarding` from `beta-readonly` to `beta-live`.
  - [ ] 10.4 Update `docs/beta-route-truth-table.md` `/onboarding` row per Change 4.1 above: `beta-live`, `POST /api/horses` in Required APIs, known blocker resolved, Follow-up = `21R-3`.
  - [ ] 10.5 Add or update `frontend/src/pages/__tests__/OnboardingPage.test.tsx` with focused tests: (a) `horsesApi.create` is called with correct payload on final step submit; (b) `authApi.advanceOnboarding` is called only after horse creation succeeds; (c) navigation goes to `/stable`; (d) if `horsesApi.create` fails, `advanceOnboarding` is not called and an error toast is shown; (e) `sessionStorage` is cleared on both success and failure paths.
  - [ ] 10.6 Run `npm --prefix frontend run test:run -- --run src/pages/__tests__/OnboardingPage.test.tsx` and confirm all new tests pass. Run `npm --prefix frontend run lint` on changed files.
  - [ ] 10.7 Update Dev Agent Record with file list, targeted test output, and any backend endpoint shape discrepancy found during implementation.
```

**Also add to the `Dev Notes → Scope Boundary` section:**

```markdown
Onboarding (added 2026-04-13 course correction): Task 10 makes `/onboarding` beta-live. `OnboardingPage.tsx` must persist the starter horse via `POST /api/horses` before advancing onboarding state — the stable would be empty without it. Backend endpoint exists (`api_specs.markdown:30`). Confirm request body from `backend/modules/horses/` before wiring. Post-create navigation must go to `/stable`.
```

---

### Change 4.4 — `_bmad-output/implementation-artifacts/21r-3-production-parity-e2e-smoke-tests.md` (CREATE)

New story to be written when 21R-3 development begins. The first E2E path is non-negotiable:

**Path 1 (required, must run first):**
> `Register new account → Login → Onboarding wizard (pick breed, gender, name) → Submit → Stable page shows the created horse`

This path:
- Must use real credentials (no test-only bypass headers per the existing 21R-3 scope)
- Must assert that `GET /api/horses` returns the starter horse after onboarding completes
- Must assert that the stable view renders the horse card with the correct name and breed
- Failure here means the beta front door is broken and all subsequent E2E paths are moot

**Subsequent paths (in order):**
- Path 2: Login smoke (`login → / → stable shows horses`)
- Path 3: Horse detail (from stable → `/horses/:id` shows real horse data)
- Path 4: Any other beta-live route confirmations per the truth table

---

## Section 5 — Implementation Handoff

**Scope Classification:** Moderate — requires 21R-2 scope extension + story pre-population for 21R-3

**Handoff:**

| Recipient | Action |
|---|---|
| **Dev Agent (21R-2)** | Apply Changes 4.1 (truth table edits), 4.2 (21R-1 finding), 4.3 (21R-2 Task 10). Implement Task 10 before 21R-2 passes review. |
| **SM (21R-3 creation)** | When creating the 21R-3 story artifact, use Change 4.4 as the E2E path ordering anchor. Onboarding must be Path 1. |

**Success Criteria:**

- [ ] `docs/beta-route-truth-table.md` `/onboarding` row shows `beta-live` with `POST /api/horses` in Required APIs
- [ ] `betaRouteScope.ts` classifies `/onboarding` as `beta-live`
- [ ] `OnboardingPage.tsx` calls `horsesApi.create(...)` before `authApi.advanceOnboarding()`
- [ ] Navigation post-onboarding goes to `/stable`
- [ ] `horsesApi.create` exists in `api-client.ts`
- [ ] Focused `OnboardingPage.test.tsx` tests pass (5 test cases per Task 10.5)
- [ ] 21R-3 story artifact lists `register → login → onboarding → stable shows horse` as Path 1

---

*Sprint Change Proposal — Equoria / Epic 21R / 2026-04-13*
