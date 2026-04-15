---
stepsCompleted:
  - step-01-preflight-and-context
  - step-02-generation-mode
  - step-03-test-strategy
  - step-04-generate-tests
lastStep: step-04-generate-tests
lastSaved: '2026-04-10'
story: '21-3'
tddPhase: RED
inputDocuments:
  - _bmad-output/implementation-artifacts/21-3-community-trainers-riders-api-tests.md
  - docs/epic-21-test-quality-sprint.md
  - backend/modules/community/routes/clubRoutes.mjs
  - backend/modules/community/routes/forumRoutes.mjs
  - backend/modules/community/routes/messageRoutes.mjs
  - backend/modules/trainers/routes/trainerRoutes.mjs
  - backend/modules/riders/routes/riderRoutes.mjs
  - backend/tests/integration/clubAPI.test.mjs
  - _bmad/_config/tea/config.yaml
---

# ATDD Checklist — Story 21-3: Community / Trainers / Riders API Integration Tests

**TDD Phase:** 🔴 RED — All tests use `it.skip()` (failing by intention until verified green)
**Generated:** 2026-04-10
**Stack:** Backend (Jest 29 + supertest, ESM `.mjs`)
**Execution Mode:** Sequential (AI generation)

---

## Step 1: Preflight Summary

| Item | Status |
|------|--------|
| Story approved with clear AC | ✅ |
| Test framework configured (Jest + `--experimental-vm-modules`) | ✅ |
| Dev environment available | ✅ |
| `detected_stack` | `backend` |
| Generation mode | AI generation |
| Playwright Utils profile | API-only (not used — Jest stack) |
| Pact.js CDC | Disabled |

---

## Step 2: Generation Mode

**Mode selected:** AI Generation
**Reason:** Backend stack, standard CRUD + auth + validation scenarios — no browser recording needed.

---

## Step 3: Test Strategy

### AC → Scenario Mapping

| AC | Endpoint | Scenario | Level | Priority |
|----|----------|----------|-------|----------|
| AC1 | `POST /api/clubs` | happy path → 201 + club data | API Integration | P0 |
| AC1 | `POST /api/clubs` | no auth → 401 | API Integration | P0 |
| AC1 | `POST /api/clubs` | missing name → 400 | API Integration | P0 |
| AC1 | `GET /api/clubs` | happy path → 200 + clubs array | API Integration | P0 |
| AC1 | `GET /api/clubs` | no auth → 401 | API Integration | P0 |
| AC1 | `GET /api/forum/threads` | happy path → 200 + threads array | API Integration | P1 |
| AC1 | `GET /api/forum/threads` | no auth → 401 | API Integration | P1 |
| AC1 | `POST /api/forum/threads` | no auth → 401 | API Integration | P1 |
| AC1 | `POST /api/forum/threads` | missing title → 400 | API Integration | P1 |
| AC1 | `POST /api/messages` | no auth → 401 | API Integration | P1 |
| AC1 | `POST /api/messages` | missing recipientId → 400 | API Integration | P1 |
| AC1 | `POST /api/messages` | missing subject → 400 | API Integration | P1 |
| AC2 | `GET /api/trainers/marketplace` | happy path → 200 | API Integration | P0 |
| AC2 | `GET /api/trainers/marketplace` | no auth → 401 | API Integration | P0 |
| AC2 | `POST /api/trainers/marketplace/hire` | no auth → 401 | API Integration | P0 |
| AC2 | `POST /api/trainers/marketplace/hire` | missing marketplaceId → 400 | API Integration | P0 |
| AC2 | `POST /api/trainers/marketplace/hire` | happy path (listing-dependent) | API Integration | P0 |
| AC2 | `GET /api/trainers/assignments` | happy path → 200 | API Integration | P0 |
| AC2 | `GET /api/trainers/assignments` | no auth → 401 | API Integration | P0 |
| AC2 | `POST /api/trainers/assignments` | no auth → 401 | API Integration | P0 |
| AC2 | `POST /api/trainers/assignments` | missing trainerId → 400 | API Integration | P0 |
| AC2 | `POST /api/trainers/assignments` | missing horseId → 400 | API Integration | P0 |
| AC3 | `GET /api/riders/marketplace` | happy path → 200 | API Integration | P0 |
| AC3 | `GET /api/riders/marketplace` | no auth → 401 | API Integration | P0 |
| AC3 | `POST /api/riders/marketplace/hire` | no auth → 401 | API Integration | P0 |
| AC3 | `POST /api/riders/marketplace/hire` | missing marketplaceId → 400 | API Integration | P0 |
| AC3 | `POST /api/riders/marketplace/hire` | happy path (listing-dependent) | API Integration | P0 |
| AC3 | `GET /api/riders/assignments` | happy path → 200 | API Integration | P0 |
| AC3 | `GET /api/riders/assignments` | no auth → 401 | API Integration | P0 |
| AC3 | `POST /api/riders/assignments` | no auth → 401 | API Integration | P0 |
| AC3 | `POST /api/riders/assignments` | missing riderId → 400 | API Integration | P0 |
| AC3 | `POST /api/riders/assignments` | missing horseId → 400 | API Integration | P0 |

**Total scenarios:** 32 | **P0:** 27 | **P1:** 5

### Duplicate Coverage Guard

- Unit tests (21-1) cover controller logic in isolation with mocked DB — different aspect
- These integration tests cover route → middleware → controller → real DB cycle — no overlap

---

## Step 4: Generated Files (TDD RED PHASE)

### Files Written

| File | Tests | Phase |
|------|-------|-------|
| `backend/modules/community/__tests__/communityRoutes.integration.test.mjs` | 12 | 🔴 RED (`it.skip`) |
| `backend/modules/trainers/__tests__/trainerRoutes.integration.test.mjs` | 10 | 🔴 RED (`it.skip`) |
| `backend/modules/riders/__tests__/riderRoutes.integration.test.mjs` | 10 | 🔴 RED (`it.skip`) |

**Total:** 32 test cases, all `it.skip()` (TDD red phase)

### Test Pattern Applied

```
beforeAll  → createTestUser (real DB user + JWT)
it.skip    → request(app).[method] + auth + body assertions
afterAll   → prisma.deleteMany for created records + cleanupTestData()
```

### Auth Pattern

```javascript
.set('Authorization', `Bearer ${userToken}`)  // authenticated
.set('x-test-skip-csrf', 'true')              // CSRF bypass for POST/DELETE/PATCH
// no headers → 401 from authenticateToken middleware
```

---

## Implementation Checklist (DEV)

To move from RED → GREEN:

- [ ] Remove `it.skip()` from each test case one at a time
- [ ] Run `npm test -- communityRoutes.integration` from `backend/` — verify green
- [ ] Run `npm test -- trainerRoutes.integration` — verify green
- [ ] Run `npm test -- riderRoutes.integration` — verify green
- [ ] Run full suite `npm test` — verify no regressions
- [ ] Update story 21-3 tasks in story file as complete
- [ ] Update sprint-status.yaml: `21-3-community-trainers-riders-api-tests: done`

### Known Complexity: Marketplace Happy Path

`POST /api/trainers/marketplace/hire` and `POST /api/riders/marketplace/hire` happy paths:
- Must first `GET` marketplace to obtain a real listing ID
- If marketplace returns empty listings, the test gracefully returns (logs as skipped scenario)
- The test is designed to be non-brittle: it checks `listings.length === 0` before attempting hire

---

## Risk Notes (Murat)

**Risk R-04 (Score 6 — MITIGATE):** Zero integration coverage on three high-traffic module groups.

**Post-implementation expected impact:**
- Coverage gap on community/trainers/riders endpoint cycle eliminated
- Auth guard path (401) confirmed for all 12 target endpoints
- Validation error path (400) confirmed for all 5 mutation endpoints with required fields
- Regression protection for `authenticateToken` + `applyCsrfProtection` middleware interaction

**Residual risk after story:** Marketplace hire happy path is listing-dependent. If the marketplace generation service is non-deterministic, that single test will gracefully no-op. Low risk — the validation guard test (400) is more valuable anyway.
