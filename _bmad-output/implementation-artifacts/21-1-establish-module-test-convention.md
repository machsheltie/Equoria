# Story 21-1: Establish Module-Level Test Convention

**Epic:** 21 — Test Architecture Quality Sprint
**Priority:** P0 (BLOCK risk R-01, Score 9)
**Status:** done

---

## Story

**As a** backend developer,
**I want** unit tests co-located alongside each domain module,
**So that** finding tests is effortless, coverage gaps are obvious at a glance, and new contributors follow the same structure by default.

---

## Acceptance Criteria

- **AC1:** `backend/modules/community/__tests__/` exists with unit tests for `clubController.mjs`, `forumController.mjs`, `messageController.mjs`
- **AC2:** `backend/modules/trainers/__tests__/` exists with unit tests for `trainerController.mjs`
- **AC3:** `backend/modules/riders/__tests__/` exists with unit tests for `riderController.mjs` and `riderMarketplaceController.mjs`
- **AC4:** All new tests pass CI (local: `npm test` green, 85/85 passing)
- **AC5:** `CONTRIBUTING.md` documents the co-location convention for future epics

---

## Tasks / Subtasks

- [x] **Task 1 — Community module tests (AC1)**
  - [x] 1.1 Create `backend/modules/community/__tests__/clubController.test.mjs` — covers getClubs, createClub, getClub, joinClub, leaveClub
  - [x] 1.2 Create `backend/modules/community/__tests__/forumController.test.mjs` — covers getForums, createForum, getForum, getPosts, createPost
  - [x] 1.3 Create `backend/modules/community/__tests__/messageController.test.mjs` — covers getInbox, getSentMessages, sendMessage, getMessage, deleteMessage
- [x] **Task 2 — Trainers module tests (AC2)**
  - [x] 2.1 Create `backend/modules/trainers/__tests__/trainerController.test.mjs` — covers getUserTrainers, getTrainerAssignments, assignTrainer, deleteTrainerAssignment, dismissTrainer
- [x] **Task 3 — Riders module tests (AC3)**
  - [x] 3.1 Create `backend/modules/riders/__tests__/riderController.test.mjs` — covers getUserRiders, getRiderAssignments, assignRider, removeRiderAssignment, dismissRider
  - [x] 3.2 Create `backend/modules/riders/__tests__/riderMarketplaceController.test.mjs` — covers getAvailableRiders, hireRider
- [x] **Task 4 — Convention documentation (AC5)**
  - [x] 4.1 Confirm `CONTRIBUTING.md` in `.claude/rules/` documents the `backend/modules/<domain>/__tests__/` pattern with examples

---

## Dev Notes

### Architecture Requirements

- **Mock strategy:** `jest.unstable_mockModule` for `prismaClient.mjs` and `logger.mjs` only — balanced mocking (external deps only)
- **Import pattern:** `await import('../controllers/<name>.mjs')` after mock setup (ESM dynamic import required)
- **File convention:** `<controllerName>.test.mjs` co-located at `backend/modules/<domain>/__tests__/`
- **Test structure:** `mockReqRes()` helper for req/res mocks; `jest.clearAllMocks()` in `beforeEach`
- **Prohibited:** No tests placed in `backend/__tests__/` root for module-level coverage

### Pre-Sprint ATDD Context

Tests were written as failing acceptance tests first (TEA:AT step), then controllers were updated to make them pass. All 6 test files, 85 tests were passing green before this story was formally created.

### Controller Implementations Updated

The following controllers received updates to pass the new unit tests:
- `backend/modules/community/controllers/clubController.mjs` — added `_count` → `memberCount` shape, 409 on duplicate name, 404/400 guards
- `backend/modules/community/controllers/forumController.mjs` — response envelope standardized to `{ success, data }`
- `backend/modules/community/controllers/messageController.mjs` — 404/403 guards for getMessage/deleteMessage
- `backend/modules/trainers/controllers/trainerController.mjs` — ownership guards, name concatenation, 201 on create
- `backend/modules/riders/controllers/riderController.mjs` — ownership guards, 201 on assign
- `backend/modules/riders/controllers/riderMarketplaceController.mjs` — 404 on already-hired rider

---

## Dev Agent Record

### Implementation Plan

The implementation followed the ATDD → Dev cycle:
1. TEA:AT wrote failing acceptance tests for all 3 module groups (community, trainers, riders)
2. Controllers were updated to satisfy the test assertions
3. All 85 tests pass green; no regressions introduced in the full suite

### Debug Log

_No blocking issues encountered._

### Completion Notes

- ✅ AC1: 3 community controller test files created — 300 lines, 35+ assertions covering happy path, validation errors, 404/409 guards
- ✅ AC2: 1 trainer controller test file created — 309 lines, 17 assertions covering full CRUD + ownership validation
- ✅ AC3: 2 rider controller test files created — covering assignment lifecycle + marketplace hire flow
- ✅ AC4: 85/85 tests pass — `npm test -- --testPathPattern="modules/(community|trainers|riders)/__tests__"` green
- ✅ AC5: `.claude/rules/CONTRIBUTING.md` — "Test Co-location Convention (Story 21-1)" section present with pattern, examples, and rules

---

## File List

- `backend/modules/community/__tests__/clubController.test.mjs` — new
- `backend/modules/community/__tests__/forumController.test.mjs` — new
- `backend/modules/community/__tests__/messageController.test.mjs` — new
- `backend/modules/trainers/__tests__/trainerController.test.mjs` — new
- `backend/modules/riders/__tests__/riderController.test.mjs` — new
- `backend/modules/riders/__tests__/riderMarketplaceController.test.mjs` — new
- `backend/modules/community/controllers/clubController.mjs` — modified
- `backend/modules/community/controllers/forumController.mjs` — modified
- `backend/modules/community/controllers/messageController.mjs` — modified
- `backend/modules/trainers/controllers/trainerController.mjs` — modified
- `backend/modules/riders/controllers/riderController.mjs` — modified
- `backend/modules/riders/controllers/riderMarketplaceController.mjs` — modified
- `.claude/rules/CONTRIBUTING.md` — modified (convention documented)

---

## Change Log

| Date | Change |
|---|---|
| 2026-04-07 | Story created; all 6 test files implemented; 85/85 passing; controllers updated to match assertions; status set to review |
