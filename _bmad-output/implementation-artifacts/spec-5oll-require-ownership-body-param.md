---
title: 'Equoria-5oll: requireOwnership body-param support'
type: 'feature'
created: '2026-05-13'
status: 'in-review'
baseline_commit: 'b3268367b9d927e124a0d68edf1458e70bf48d0a'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `requireOwnership` middleware reads the resource ID only from `req.params`, so POST/PUT endpoints that carry the resource ID in `req.body` (e.g. `POST /api/v1/marketplace/list { horseId, price }`) must inline `findOwnedResource` instead of using the middleware, producing ~40 scattered call-sites with duplicated ownership logic.

**Approach:** Add `from: 'params' | 'body'` to `requireOwnership`'s options object (default `'params'`, preserving all existing callers). Migrate the `POST /marketplace/list` route as the proof-of-concept; document the remaining body-param callers as deferred migration work.

## Boundaries & Constraints

**Always:**
- Backward-compatible: default `from: 'params'` — every existing `requireOwnership` call continues to work unchanged.
- ID validation logic stays identical whether sourced from params or body (`/^[0-9]+$/`, `parseInt`).
- Attach `req[resourceType]` and `req.validatedResources[resourceType]` exactly as the params path does.
- Existing tests must remain green; new tests must use real DB (no mocked Prisma), following project doctrine.
- ES modules only; `.mjs` extensions on all imports.

**Ask First:**
- If any other body-param caller has unusual logic that conflicts with the middleware pattern (e.g. the `personalityEvolutionController` dynamic `entityType`), stop and report before touching that file.

**Never:**
- Do not migrate multi-resource callers (those that call `findOwnedResource` twice in one handler for different resource types) — `findOwnedResource` is the correct primitive for those cases.
- Do not change the `findOwnedResource` or `validateBatchOwnership` helpers.
- Do not add body parsing middleware — `express.json()` is already global and `req.body` is populated before route middleware runs.
- Do not use `req.body` as the source when `from` is `'params'` (no mixing).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Body param, valid owned horse | `POST /marketplace/list`, `req.body.horseId = 42`, user owns horse 42 | middleware attaches `req.horse`, handler proceeds | N/A |
| Body param, missing field | `req.body.horseId` absent or empty string | 400 "Invalid horse ID" (same as params path) | stops, does not call next |
| Body param, non-numeric | `req.body.horseId = "abc"` | 400 "Invalid horse ID" | stops |
| Body param, not owned | `req.body.horseId = 99`, user does not own horse 99 | 404 "Horse not found" (CWE-639 safe) | stops |
| Params path unchanged | `requireOwnership('horse')` with no `from` option | reads `req.params.id`, behavior identical to pre-change | N/A |

</frozen-after-approval>

## Code Map

- `backend/middleware/ownership.mjs:84-183` — `requireOwnership` factory; `idParam` destructured at line 85; raw ID read at line 89
- `backend/modules/marketplace/routes/marketplaceRoutes.mjs:29` — `router.post('/list', listHorse)` — the route to gain middleware
- `backend/modules/marketplace/controllers/marketplaceController.mjs:144-185` — `listHorse` handler; inline `findOwnedResource` at line 167; comment at line 165 notes the body-param gap
- `backend/__tests__/middleware/ownership.test.mjs` — existing middleware tests; add `from: 'body'` suite here

**Deferred body-param callers (not in this spec):**
- `modules/competition/controllers/conformationShowController.mjs` (×3)
- `modules/competition/routes/competitionRoutes.mjs` (×1)
- `modules/grooms/routes/groomRoutes.mjs` (×4, multi-resource — keep `findOwnedResource`)
- `modules/horses/routes/horseRoutes.mjs` (×2, multi-resource — keep `findOwnedResource`)
- `modules/training/routes/trainingRoutes.mjs` (×2)
- `modules/traits/routes/epigeneticTraitRoutes.mjs` (×1)
- `modules/traits/routes/traitDiscoveryRoutes.mjs` (×1)

## Tasks & Acceptance

**Execution:**
- [x] `backend/middleware/ownership.mjs` -- Add `from: 'params' | 'body'` to destructured options (line 85); replace `req.params[idParam]` (line 89) with `from === 'body' ? req.body?.[idParam] : req.params[idParam]`; update JSDoc `@param` for `options.from`
- [x] `backend/modules/marketplace/routes/marketplaceRoutes.mjs` -- Add `requireOwnership('horse', { idParam: 'horseId', from: 'body' })` middleware to `router.post('/list', ...)` before `listHorse`
- [x] `backend/modules/marketplace/controllers/marketplaceController.mjs` -- Remove `findOwnedResource` import (if marketplace is the only caller) and its call at line 167; replace `horse` local variable with `req.horse`; remove now-redundant horseId null-check (middleware handles it); keep `price` validation
- [x] `backend/__tests__/middleware/ownership.test.mjs` -- Add `describe('from: body')` suite covering: happy path (valid owned resource from body), missing body field → 400, non-numeric body field → 400, unowned resource → 404, default `from` unchanged when not specified

**Acceptance Criteria:**
- Given `from: 'body'` is set, when `req.body[idParam]` is a valid integer and the user owns the resource, then the middleware calls `next()` and attaches `req[resourceType]`
- Given `from: 'body'` is set, when `req.body[idParam]` is absent, then the middleware returns 400 without calling `next()`
- Given `from: 'body'` is set, when the resource is not owned by the authenticated user, then the middleware returns 404 (CWE-639 safe — same message for not-found and not-owned)
- Given no `from` option is provided, when any existing caller uses `requireOwnership`, then behaviour is identical to before this change (params path)
- Given `POST /marketplace/list` with a valid owned `horseId` in the body, when the request reaches `listHorse`, then `req.horse` is populated and no second DB query runs for ownership
- All existing ownership middleware tests pass

## Spec Change Log

**2026-05-13 — review patch-up (step-04)**

Three review subagents (blind hunter, edge case hunter, acceptance auditor) ran against the diff since baseline commit `b3268367`.

Patched before shipping:
- `ownership.mjs:113` — log warning used `req.params[idParam]` (always `undefined` for body-path 400s); changed to `rawId` so the actual invalid value appears in logs.
- `ownership.test.mjs` — added test sending native integer `horse.id` (not `String(horse.id)`) to exercise the `typeof rawId === 'number'` branch — the entire new code path had zero test coverage.

Deferred issues (filed separately as needed):
- Very large integers (> PostgreSQL int4 max 2,147,483,647) reach Prisma and produce a 500 instead of 400; pre-existing for params path too — needs a separate issue.
- `req.validatedResources['horse']` not asserted in from:body happy-path test — minor gap, low priority.
- `req.horse` null-guard in controller — architectural choice; controller's invariant is middleware always runs before it.

False positives dismissed:
- `requireOwnership` import in routes already existed (for `DELETE /list/:horseId`).
- Marketplace "price below 100" horse cleanup — covered by existing `afterEach` `TestFixture-MPHorse*` deletion.
- Negative integers — caught by `resourceId < 0` guard already present in code.

## Design Notes

**Why `from` not `idSource`:** Mirrors the natural sentence "read from body / from params"; shorter; consistent with convention in similar middleware (e.g. express-rate-limit's `keyGenerator` options).

**Why only migrate marketplace (not all callers now):** Multi-resource callers (groomRoutes breeding, horseRoutes breeding, all dynamicCompatibilityController calls) need two ownership checks in one handler — chaining two `requireOwnership` calls on a route is possible but changes error semantics (first failure stops the chain, second resource is never validated). `findOwnedResource` is the correct primitive for those; they should not be migrated without a separate deliberate decision. Single-resource body-param callers (conformationShow, training, traits) are valid future migration targets but out of scope for the proof-of-concept.

## Verification

**Commands:**
- `cd backend && node --experimental-vm-modules node_modules/.bin/jest --testPathPattern="ownership.test" --no-coverage 2>&1 | tail -5` -- expected: all tests pass
- `cd backend && node --experimental-vm-modules node_modules/.bin/jest --testPathPattern="marketplace" --no-coverage 2>&1 | tail -5` -- expected: all tests pass
- `cd backend && npx eslint middleware/ownership.mjs modules/marketplace/routes/marketplaceRoutes.mjs modules/marketplace/controllers/marketplaceController.mjs` -- expected: no errors
