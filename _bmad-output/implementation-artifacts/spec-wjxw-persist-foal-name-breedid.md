---
title: 'Equoria-wjxw: persist pendingFoalName + pendingFoalBreedId at pregnancy start'
type: 'bugfix'
created: '2026-05-13'
status: 'done'
baseline_commit: '298cad4c3b83737c2b599d965a7a57f5939c8068'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `createFoal()` accepts `name` and `breedId` from the caller but never stores them — when the foaling job runs 7 days later it falls back to `"{dam.name} Foal"` and the dam's own breed, silently discarding the player's intent.

**Approach:** Add two nullable fields to the Horse schema (`pendingFoalName String?`, `pendingFoalBreedId Int?`), persist them on the dam at pregnancy-start in `createFoal`, have `runFoalingJob` pass them into `createFoalFromPregnancy` as options, and clear them from the dam after the foal is materialised.

## Boundaries & Constraints

**Always:**
- Both new fields are nullable — existing rows get `null`, no data migration needed.
- Clear `pendingFoalName` and `pendingFoalBreedId` on the dam in the same update that clears the other pregnancy fields after foaling.
- If either field is `null` on the dam when foaling runs, fall through to the existing defaults (`"{dam.name} Foal"` / dam's own breed) — no regression.
- Real DB tests only (no mocked Prisma); use `TestFixture-` prefix for fixture names.
- Remove the stale `// they will be persisted alongside pregnancy state once B5 lands` comment at `horseController.mjs:245`.

**Ask First:**
- If the foaling service's `createFoalFromPregnancy` clears pregnancy fields itself (rather than the job), stop and confirm before deciding where to add the pending-field clear.

**Never:**
- Do not change the `createFoalFromPregnancy` function signature or its existing fallback logic (`options.name || '{dam.name} Foal'`).
- Do not add required/non-null fields to the Horse schema.
- Do not touch the `breedId` FK on the Horse model itself — `pendingFoalBreedId` is a plain `Int?`, not a relation.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Name + breedId provided at breed | `createFoal` body: `{ name: "Starlight", breedId: 5, sireId, damId }` | Dam updated: `pendingFoalName = "Starlight"`, `pendingFoalBreedId = 5` | N/A |
| Foaling with pending values set | Dam has `pendingFoalName = "Starlight"`, `pendingFoalBreedId = 5` | Foal created: `name = "Starlight"`, `breedId = 5`; dam fields cleared to `null` | N/A |
| Foaling with no pending values | Dam has `pendingFoalName = null`, `pendingFoalBreedId = null` | Foal created: `name = "{dam.name} Foal"`, breedId = dam's breed — existing fallback unchanged | N/A |
| Only name provided, no breedId | `createFoal` body: `{ name: "Starlight", sireId, damId }` (no breedId) | `pendingFoalName = "Starlight"`, `pendingFoalBreedId = null`; foal gets name "Starlight", breed from dam | N/A |
| Only breedId provided, no name | `createFoal` body: `{ breedId: 5, sireId, damId }` (no name) | `pendingFoalBreedId = 5`, `pendingFoalName = null`; foal gets default name, breedId 5 | N/A |

</frozen-after-approval>

## Code Map

- `packages/database/prisma/schema.prisma:121` — Horse model; add `pendingFoalName String?` and `pendingFoalBreedId Int?` alongside existing pregnancy fields (~line 170–172)
- `backend/modules/horses/controllers/horseController.mjs:235–354` — `createFoal`; dam update at ~line 318–326; stale comment at ~line 245
- `backend/modules/horses/services/foalingService.mjs:412–522` — `runFoalingJob`; reads dam snapshot at ~line 489 to get breedId; does NOT read pendingFoal* yet
- `backend/modules/horses/services/foalingService.mjs:215–397` — `createFoalFromPregnancy`; reads `options.name` (line 332) and `options.breedId` (line 297); do NOT change this function
- `backend/tests/foalCreationIntegration.test.mjs` — existing integration tests for createFoal; add pending-field persistence and foaling-job honour-intent tests

## Tasks & Acceptance

**Execution:**
- [ ] `packages/database/prisma/schema.prisma` -- Add `pendingFoalName String?` and `pendingFoalBreedId Int?` to the Horse model after the existing `pregnancyFeedingsByTier` field
- [ ] Run `npx prisma migrate dev --name add-pending-foal-fields` from `packages/database/` -- generate and apply the migration
- [ ] `backend/modules/horses/controllers/horseController.mjs` -- In `createFoal`, add `pendingFoalName: name ?? null` and `pendingFoalBreedId: normalizedBreedId || null` to the dam update (~line 318–326); remove the stale B5 comment at ~line 245
- [ ] `backend/modules/horses/services/foalingService.mjs` -- In `runFoalingJob`, pass `name: dam.pendingFoalName ?? undefined` and `breedId: dam.pendingFoalBreedId ?? undefined` to `createFoalFromPregnancy` options; add `pendingFoalName: null, pendingFoalBreedId: null` to whichever `prisma.horse.update` clears pregnancy state after foaling
- [ ] `backend/tests/foalCreationIntegration.test.mjs` -- Add: (1) test asserting `pendingFoalName` and `pendingFoalBreedId` are persisted on the dam after `createFoal`; (2) test calling `createFoalFromPregnancy` directly with a dam that has pending fields set, asserting foal name and breedId match; (3) test calling with null pending fields, asserting fallback defaults apply

**Acceptance Criteria:**
- Given `createFoal` is called with `name` and `breedId` in the body, when the dam is updated, then `dam.pendingFoalName` and `dam.pendingFoalBreedId` are stored on the dam record
- Given the dam has `pendingFoalName = "Starlight"` and `pendingFoalBreedId = 5` when the foaling job runs, then the materialised foal has `name = "Starlight"` and `breedId = 5`
- Given the dam has `pendingFoalName = null` and `pendingFoalBreedId = null` when the foaling job runs, then the foal's name defaults to `"{dam.name} Foal"` and its breedId comes from the dam's own breed
- Given a foal is successfully materialised, then `dam.pendingFoalName` and `dam.pendingFoalBreedId` are both `null` afterwards
- All existing foal-creation integration tests pass

## Spec Change Log

## Design Notes

**Why `pendingFoalBreedId` as plain `Int?` not a relation:** The field mirrors the caller's intent, not a required FK. It may arrive with a value that's later validated by `createFoalFromPregnancy`. Keeping it a raw integer avoids cascade-delete complexity and matches how `pregnancySireId` is stored (also a plain `Int?`).

**Why clear in `runFoalingJob` not `createFoalFromPregnancy`:** The service function is called from both the job and potentially directly; clearing there would clear intent-fields even in direct test calls. The job is the authoritative "pregnancy is over" trigger.

## Verification

**Commands:**
- `cd packages/database && npx prisma migrate dev --name add-pending-foal-fields` -- expected: migration created and applied
- `cd backend && node --experimental-vm-modules node_modules/.bin/jest --testPathPattern="foalCreation" --no-coverage 2>&1 | tail -5` -- expected: all tests pass
- `cd backend && npx eslint modules/horses/controllers/horseController.mjs modules/horses/services/foalingService.mjs` -- expected: no errors
