# Story 21-3: Add Community / Trainers / Riders API Integration Tests

**Epic:** 21 — Test Architecture Quality Sprint
**Risk:** R-04 (Score 6 — MITIGATE)
**Priority:** P0
**Status:** ready-for-dev

---

## Story

**As a** backend developer,
**I want** supertest HTTP integration tests for the community, trainers, and riders module groups,
**So that** the full route → middleware → controller → DB cycle is validated end-to-end and zero-coverage endpoints are protected from regressions.

---

## Acceptance Criteria

- **AC1:** `community` — supertest tests cover happy path + auth guard + validation error for:
  - `POST /api/clubs` (create club)
  - `GET /api/clubs` (list clubs)
  - `POST /api/forum` (create forum — stub: 501 or real, test the current behavior)
  - `GET /api/forum` (list forums)
  - `POST /api/messages` (send message)
- **AC2:** `trainers` — supertest tests cover happy path + auth guard + validation error for:
  - `GET /api/trainers/marketplace` (list marketplace)
  - `POST /api/trainers/marketplace/hire` (hire trainer)
  - `GET /api/trainers/assignments` (list assignments)
  - `POST /api/trainers/assignments` (assign trainer)
- **AC3:** `riders` — supertest tests cover happy path + auth guard + validation error for:
  - `GET /api/riders/marketplace` (browse marketplace)
  - `POST /api/riders/marketplace/hire` (hire rider)
  - `GET /api/riders/assignments` (list assignments)
  - `POST /api/riders/assignments` (assign rider)
- **AC4:** All test files placed in `backend/modules/<domain>/__tests__/` (co-location convention from 21-1)
  - `backend/modules/community/__tests__/communityRoutes.integration.test.mjs`
  - `backend/modules/trainers/__tests__/trainerRoutes.integration.test.mjs`
  - `backend/modules/riders/__tests__/riderRoutes.integration.test.mjs`
- **AC5:** All tests pass CI (`npm test` green, no regressions in existing suite)

---

## Tasks / Subtasks

- [ ] **Task 1 — TEA:AT (Acceptance Tests — REQUIRED before coding)**
  - [ ] 1.1 Run `/bmad-tea` → AT action for each of the three module groups
  - [ ] 1.2 Confirm failing test stubs exist before any implementation work begins

- [ ] **Task 2 — Community routes integration test (AC1, AC4)**
  - [ ] 2.1 Create `backend/modules/community/__tests__/communityRoutes.integration.test.mjs`
  - [ ] 2.2 `POST /api/clubs` happy path → 201 + `{ success: true, data: { club: { ... } } }`
  - [ ] 2.3 `POST /api/clubs` without auth → 401
  - [ ] 2.4 `POST /api/clubs` missing required fields → 400 validation error
  - [ ] 2.5 `GET /api/clubs` happy path → 200 + `{ success: true, data: { clubs: [...] } }`
  - [ ] 2.6 `GET /api/clubs` without auth → 401
  - [ ] 2.7 `GET /api/forum` happy path → 200
  - [ ] 2.8 `GET /api/forum` without auth → 401
  - [ ] 2.9 `POST /api/messages` happy path → 201 or appropriate status
  - [ ] 2.10 `POST /api/messages` without auth → 401

- [ ] **Task 3 — Trainers routes integration test (AC2, AC4)**
  - [ ] 3.1 Create `backend/modules/trainers/__tests__/trainerRoutes.integration.test.mjs`
  - [ ] 3.2 `GET /api/trainers/marketplace` without auth → 401
  - [ ] 3.3 `GET /api/trainers/marketplace` with auth → 200
  - [ ] 3.4 `POST /api/trainers/marketplace/hire` without auth → 401
  - [ ] 3.5 `POST /api/trainers/marketplace/hire` missing `marketplaceId` → 400
  - [ ] 3.6 `GET /api/trainers/assignments` without auth → 401
  - [ ] 3.7 `GET /api/trainers/assignments` with auth → 200
  - [ ] 3.8 `POST /api/trainers/assignments` without auth → 401
  - [ ] 3.9 `POST /api/trainers/assignments` missing required fields → 400

- [ ] **Task 4 — Riders routes integration test (AC3, AC4)**
  - [ ] 4.1 Create `backend/modules/riders/__tests__/riderRoutes.integration.test.mjs`
  - [ ] 4.2 `GET /api/riders/marketplace` without auth → 401
  - [ ] 4.3 `GET /api/riders/marketplace` with auth → 200
  - [ ] 4.4 `POST /api/riders/marketplace/hire` without auth → 401
  - [ ] 4.5 `POST /api/riders/marketplace/hire` missing `marketplaceId` → 400
  - [ ] 4.6 `GET /api/riders/assignments` without auth → 401
  - [ ] 4.7 `GET /api/riders/assignments` with auth → 200
  - [ ] 4.8 `POST /api/riders/assignments` without auth → 401
  - [ ] 4.9 `POST /api/riders/assignments` missing required fields → 400

---

## Dev Notes

### Architecture Requirements

**Test placement (AC4):**
- Files go in `backend/modules/<domain>/__tests__/` NOT in `backend/tests/integration/`
- Naming convention: `<domain>Routes.integration.test.mjs` to distinguish from unit tests
- The `backend/tests/integration/clubAPI.test.mjs` exists as a pre-21-1 integration test and is a good reference, but is NOT co-located. 21-3 tests are the co-located equivalents.

**App routing:**
- `/api/clubs` → `backend/routes/clubRoutes.mjs` (shim) → `backend/modules/community/routes/clubRoutes.mjs`
- `/api/forum` → `backend/routes/forumRoutes.mjs` (shim) → `backend/modules/community/routes/forumRoutes.mjs`
- `/api/messages` → `backend/routes/messageRoutes.mjs` (shim) → `backend/modules/community/routes/messageRoutes.mjs`
- `/api/trainers` → `backend/routes/trainerRoutes.mjs` (shim) → `backend/modules/trainers/routes/trainerRoutes.mjs`
- `/api/riders` → `backend/routes/riderRoutes.mjs` (shim) → `backend/modules/riders/routes/riderRoutes.mjs`
- All above routes are mounted on `authRouter` — they require a valid JWT token. Requests without a token return 401.

**Auth pattern for integration tests:**
- Use `createTestUser` from `backend/tests/helpers/testAuth.mjs` to create a real DB user and get a JWT token
- Set `Authorization: Bearer <token>` and `x-test-skip-csrf: 'true'` headers on every authenticated request
- No auth header → 401 from `authenticateToken` middleware before route handler runs

**CSRF bypass:**
- All `POST/PUT/DELETE/PATCH` in `authRouter` go through `applyCsrfProtection`
- Tests must send `x-test-skip-csrf: 'true'` header to bypass in test mode

**Mock strategy:**
- These are **integration tests** — do NOT mock prisma or controllers
- Real DB writes happen; clean up in `afterAll` using prisma directly
- Pattern: `beforeAll` creates test user, `afterAll` deletes all test-created records

**Validation error shape (400):**
```json
{ "success": false, "message": "Validation failed", "errors": [{ "msg": "...", ... }] }
```

**Happy path response shapes (from 21-1 learnings):**
- `GET /api/clubs` → `{ success: true, data: { clubs: [...] } }`
- `POST /api/clubs` → 201, `{ success: true, data: { club: { id, name, type, leaderId, ... } } }`
- `GET /api/trainers/assignments` → `{ success: true, ... }` (200)
- `GET /api/riders/marketplace` → `{ success: true, ... }` (200)

**Trainer/Rider marketplace behavior:**
- `GET /api/trainers/marketplace` and `GET /api/riders/marketplace` will auto-generate listings if none exist for the user — this is normal and 200 is the expected response
- `POST /api/trainers/marketplace/hire` and `POST /api/riders/marketplace/hire` require a valid `marketplaceId` that matches an existing marketplace entry; for happy path tests, first fetch the marketplace to obtain a valid ID

**Import path from co-located test:**
```javascript
// From backend/modules/community/__tests__/communityRoutes.integration.test.mjs
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser } from '../../../tests/helpers/testAuth.mjs';
import request from 'supertest';
```

**Reference integration test:**
- `backend/tests/integration/clubAPI.test.mjs` is the canonical reference for community endpoints — tests in 21-3 should cover the same surface but scoped to AC1-AC3

### Existing Test Coverage Context (from 21-1)

The `__tests__/` directories already contain **unit tests** written in 21-1:
- `backend/modules/community/__tests__/` — clubController, forumController, messageController (unit, mocked prisma)
- `backend/modules/trainers/__tests__/` — trainerController (unit, mocked prisma)
- `backend/modules/riders/__tests__/` — riderController, riderMarketplaceController (unit, mocked prisma)

Story 21-3 adds **integration tests** to the same directories. The file names must be distinct (use `.integration.test.mjs` suffix).

### Pre-existing Integration Test Reference

`backend/tests/integration/clubAPI.test.mjs` demonstrates the full pattern for community routes including:
- `beforeAll` / `afterAll` DB setup/teardown
- `createTestUser` helper usage
- Token and CSRF header pattern
- Cascade delete for FK-constrained records

---

## Dev Agent Record

### Implementation Plan

_To be filled by dev agent._

### Debug Log

_To be filled by dev agent._

### Change Log

_To be filled by dev agent._
