# Story 31E-4: Color Genetics API Endpoints

**Epic:** 31E — Coat Color Genetics
**Story Key:** 31e-4-color-genetics-api-endpoints
**Status:** done

---

## Story

As a player (or frontend developer),
I want two read-only endpoints for horse color genetics,
So that the UI can display genotype data to breeders and color data to all players.

---

## Acceptance Criteria

**AC1 — GET /horses/:id/genetics**
Given an authenticated user who owns horse :id,
When they request GET /horses/:id/genetics,
Then the response is 200 with `{ success: true, data: { horseId, horseName, colorGenotype, phenotype } }`.

**AC2 — GET /horses/:id/color**
Given an authenticated user who owns horse :id,
When they request GET /horses/:id/color,
Then the response is 200 with `{ success: true, data: { horseId, horseName, colorName, shade, faceMarking, legMarkings, advancedMarkings, modifiers } }`.
The response does NOT include `colorGenotype` (player-safe).

**AC3 — Legacy horse handling**
Given a horse created before the color genetics system (no colorGenotype or phenotype),
When either endpoint is called,
Then it returns 200 with `{ success: true, data: null, message: 'No genetics/color data available for this horse' }`.

**AC4 — Partial phenotype**
Given a horse with phenotype containing colorName and shade but no markings,
When GET /horses/:id/color is called,
Then missing fields (faceMarking, legMarkings, advancedMarkings, modifiers) are null.

**AC5 — Ownership enforcement**
Given a user who does not own horse :id,
When either endpoint is called,
Then it returns 404 (ownership disclosure prevention — same as "not found").

**AC6 — No additional DB queries**
Both endpoints are pure pass-through — they read from `req.horse` set by `requireOwnership` middleware.
No additional Prisma queries are made.

**AC7 — Route ordering**
Both routes are registered BEFORE `GET /:id` to prevent Express from matching the catch-all first.

**AC8 — Tests**

- Unit tests for getGenetics and getColor using mock req/res pattern
- JSONB type guard tests (array/string stored in column)
- req.horse null guard tests (middleware contract violation)
- Legacy null path tests
- 19 tests total

---

## Tasks / Subtasks

- [x] T1: Add getGenetics controller function to horseController.mjs
- [x] T2: Add getColor controller function to horseController.mjs
- [x] T3: Wire routes into horseRoutes.mjs (before /:id catch-all)
- [x] T4: Write tests — colorGeneticsApi.test.mjs (19 tests)

---

## File List

- `backend/modules/horses/controllers/horseController.mjs` — modified
- `backend/modules/horses/routes/horseRoutes.mjs` — modified
- `backend/__tests__/colorGeneticsApi.test.mjs` — new

---

## Change Log

| Date       | Change                                      |
| ---------- | ------------------------------------------- |
| 2026-04-02 | Story created and implemented — status done |
