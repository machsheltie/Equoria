---
title: 'Fix healthStatus schema default and worseOf free-form string bug'
slug: 'fix-healthstatus-schema-default-and-worseof'
created: '2026-05-08'
status: 'in-progress'
stepsCompleted: [1, 2]
tech_stack: ['Node.js', 'Prisma', 'PostgreSQL']
files_to_modify:
  - 'packages/database/prisma/schema.prisma'
  - 'backend/utils/horseHealth.mjs'
  - 'backend/__tests__/utils/horseHealth.test.mjs'
  - 'packages/database/prisma/migrations/<timestamp>_fix_healthstatus_default/migration.sql'
code_patterns: ['ES Modules', 'Prisma migration', 'Jest TDD']
test_patterns: ['failing test first', 'sentinel-positive test']
---

# Tech-Spec: Fix healthStatus schema default and worseOf free-form string bug

**Created:** 2026-05-08
**Issue:** Equoria-va1v

## Overview

### Problem Statement

Two related bugs in the horse health system:

1. **`worseOf()` silently masks free-form vet findings.** When `getVetHealth()` returns a free-form string like `'Lameness'` (not a recognized band), `BAND_ORDER.indexOf('Lameness')` returns `-1`. `Math.max(-1, bi)` returns `bi`, so `getDisplayedHealth()` ignores the vet finding entirely and returns the feed-derived band. A horse with a serious vet condition shows as 'excellent'.

2. **Schema default `'Excellent'` is semantically wrong.** `healthStatus` is a vet-finding override field: `null` means "no override, use date-based decay." The schema defaults it to `'Excellent'` instead of `null`. Every freshly-created horse has a non-null `healthStatus`, so `getVetHealth()` always hits the override branch — masking the date-decay path entirely. The `normalizeHealthOverride()` mitigation in A11 converts `'Excellent'` → `'excellent'` so the wrong band is returned, but the semantic contract is still violated: a horse with no vet finding should use date-based decay, not be pinned to 'excellent'.

### Solution

1. Fix `worseOf()` to treat any unrecognized band string as `'critical'` (worst live band) so free-form vet findings gate correctly rather than being silently ignored.

2. Change schema `healthStatus` default from `'Excellent'` to `null`. Migrate all existing rows where `healthStatus = 'Excellent'` → `null` (these are schema-default values, not real vet findings). Update the two `authController.mjs` call sites that explicitly pass `healthStatus: 'Excellent'` to omit the field (let the schema null default apply).

3. Add sentinel-positive tests for both bug paths: one proving `worseOf` with a free-form string returned 'critical' (not 'excellent'), one proving freshly-created horses (null healthStatus, recent lastVettedDate) compute correct vetHealth via date-decay.

### Scope

**In Scope:**

- `worseOf()` unknown-string handling → treat as critical
- Schema migration: change `healthStatus` default `'Excellent'` → `null`
- Data migration: `UPDATE Horse SET healthStatus = NULL WHERE healthStatus = 'Excellent'`
- `authController.mjs` two call sites: remove explicit `healthStatus: 'Excellent'`
- Tests: failing-first sentinel tests for both bugs

**Out of Scope:**

- Broader `healthStatus` semantic cleanup for legacy controllers using `'Good'`/`'injured'`/`'Unknown'` (separate backlog issue)
- Free-form finding display in UI (the finding text itself isn't currently shown anywhere — follow-up)
- `foalingService.mjs` which uses `'Good'` as a default — different semantic layer, separate issue

## Context for Development

### Codebase Patterns

- All files use ES Modules (`import`/`export`). No `require`.
- Prisma migrations: timestamped folders under `packages/database/prisma/migrations/`. Run `cd packages/database && npx prisma migrate dev --name <name>` to create.
- Tests: Jest, `.test.mjs`, real DB (CLAUDE.md rule: no mocks for DB calls). Unit tests for pure functions like `worseOf` are fine without DB.
- Commit discipline: one small commit per fix, pushed same-session to master.

### Files to Reference

| File                                                  | Purpose                                                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `backend/utils/horseHealth.mjs`                       | `BAND_ORDER`, `worseOf()`, `normalizeHealthOverride()`, `getVetHealth()`, `getDisplayedHealth()` |
| `backend/__tests__/utils/horseHealth.test.mjs`        | Existing unit tests — add new cases here                                                         |
| `packages/database/prisma/schema.prisma`              | Line 162: `healthStatus String? @default("Excellent")`                                           |
| `backend/modules/auth/controllers/authController.mjs` | Lines 148, 1203: sets `healthStatus: 'Excellent'` explicitly                                     |

### Technical Decisions

**D1: Unknown string in `worseOf` → treat as 'critical' (index 4), not undefined.**
Rationale: Any unrecognized vet finding is a signal of a real health problem. Treating it as 'critical' ensures the horse cannot enter competitions or breed, which is the safe/conservative gate behavior. The alternative (return `undefined`) would propagate a `NaN`-adjacent bug through callers.

**D2: Migrate `'Excellent'` rows → `null`, not → `'excellent'`.**
Rationale: 'Excellent' was the schema default, not a real vet finding. Setting to `null` correctly triggers date-based decay in `getVetHealth()`, which is the intended behavior for "no vet override."

**D3: Remove `healthStatus: 'Excellent'` from `authController.mjs` call sites.**
Rationale: Once schema default is `null`, starter horses will have `null` healthStatus and use date-based vet decay — correct. No need for an explicit override. Omit entirely.

**D4: Keep `normalizeHealthOverride()` as-is.**
Rationale: It still serves a useful defensive role if any legacy data or external input sends a capitalized band name. Removing it would be a separate cleanup with no benefit right now.

## Implementation Plan

### Tasks

**T1 (test-first): Write failing test for `worseOf` free-form string bug**

- File: `backend/__tests__/utils/horseHealth.test.mjs`
- Add to the `describe('worseOf')` block:
  ```js
  it('treats unknown free-form vet findings as critical', () => {
    expect(worseOf('excellent', 'Lameness')).toBe('critical');
    expect(worseOf('Lameness', 'excellent')).toBe('critical');
    expect(worseOf('Lameness', 'Lameness')).toBe('critical');
  });
  ```
- Run: confirm FAIL.

**T2: Fix `worseOf()` in `backend/utils/horseHealth.mjs`**

- Current (lines 106-113):
  ```js
  export function worseOf(a, b) {
    if (a === 'retired' || b === 'retired') {
      return 'retired';
    }
    const ai = BAND_ORDER.indexOf(a);
    const bi = BAND_ORDER.indexOf(b);
    return BAND_ORDER[Math.max(ai, bi)];
  }
  ```
- Change `-1` sentinel behavior: if either index is `-1`, treat it as `BAND_ORDER.length - 1` (index 4, 'critical'):
  ```js
  export function worseOf(a, b) {
    if (a === 'retired' || b === 'retired') {
      return 'retired';
    }
    const lastIdx = BAND_ORDER.length - 1;
    const ai = BAND_ORDER.indexOf(a);
    const bi = BAND_ORDER.indexOf(b);
    return BAND_ORDER[Math.max(ai === -1 ? lastIdx : ai, bi === -1 ? lastIdx : bi)];
  }
  ```
- Run T1 test: confirm PASS.

**T3 (test-first): Write failing test for schema-default / date-decay path**

- File: `backend/__tests__/utils/horseHealth.test.mjs`
- Add to `describe('getVetHealth')` block:
  ```js
  it('uses date-decay when healthStatus is null (no vet override)', () => {
    const now = new Date();
    const recentVet = new Date(now.getTime() - 3 * 86_400_000); // 3 days ago
    expect(getVetHealth({ healthStatus: null, lastVettedDate: recentVet })).toBe('excellent');
  });
  it('returns critical for null healthStatus and null lastVettedDate', () => {
    expect(getVetHealth({ healthStatus: null, lastVettedDate: null })).toBe('critical');
  });
  ```
- These should already PASS (getVetHealth already handles null). Confirm green.

**T4: Schema migration**

- Run: `cd packages/database && npx prisma migrate dev --name fix_healthstatus_default`
- Edit the generated `migration.sql` to include:

  ```sql
  -- Migrate existing schema-default rows to null before changing the default
  UPDATE "Horse" SET "healthStatus" = NULL WHERE "healthStatus" = 'Excellent';

  -- Change column default from 'Excellent' to null
  ALTER TABLE "Horse" ALTER COLUMN "healthStatus" DROP DEFAULT;
  ```

- Edit `schema.prisma` line 162: remove `@default("Excellent")` from `healthStatus`
  - Before: `healthStatus  String?  @default("Excellent")`
  - After: `healthStatus  String?`
- Run `npx prisma migrate dev` again to apply.

**T5: Remove explicit `healthStatus: 'Excellent'` from authController**

- File: `backend/modules/auth/controllers/authController.mjs`
- Line 148: Remove `healthStatus: 'Excellent',` from the horse create call
- Line 1203: Remove `healthStatus: 'Excellent',` from the horse create call

**T6: Run test suite**

- `cd backend && npm test -- horseHealth`
- Confirm all tests pass including new T1 cases.

### Acceptance Criteria

**AC1 (worseOf free-form):**
Given `worseOf('excellent', 'Lameness')` is called,
When executed,
Then returns `'critical'`.

**AC2 (worseOf symmetry):**
Given `worseOf('Lameness', 'excellent')` is called,
Then returns `'critical'`.

**AC3 (worseOf both unknown):**
Given `worseOf('Lameness', 'Lameness')` is called,
Then returns `'critical'`.

**AC4 (schema null default — code):**
Given `schema.prisma` healthStatus field,
When read,
Then has no `@default(...)` annotation.

**AC5 (schema null default — migration):**
Given migration SQL,
When read,
Then contains `UPDATE "Horse" SET "healthStatus" = NULL WHERE "healthStatus" = 'Excellent'`.

**AC6 (authController cleanup):**
Given `authController.mjs`,
When grepped for `healthStatus: 'Excellent'`,
Then returns zero matches.

**AC7 (date-decay path):**
Given a horse with `{ healthStatus: null, lastVettedDate: <3 days ago> }`,
When `getVetHealth(horse)` is called,
Then returns `'excellent'` (date-decay, not override).

## Additional Context

### Dependencies

None. This is a self-contained fix to one utility file, one schema field, one migration, and two authController call sites.

### Testing Strategy

- TDD: write failing tests for T1 BEFORE fixing code (EDGE_CASE_FIX_DISCIPLINE §1)
- Unit tests only for `worseOf` — pure function, no DB needed
- Date-decay tests (T3) confirm existing behavior isn't regressed
- After all changes: run `npm test -- horseHealth` and confirm full suite still passes

### Notes

- `worseOf` returning `BAND_ORDER[Math.max(-1, bi)]` currently equals `BAND_ORDER[bi]` — it silently picks the feed-derived band as the displayed health, which is the real manifestation: a lame horse shows as 'excellent' if well-fed.
- `normalizeHealthOverride` is retained as-is — useful defensive coding, no harm.
- The `getVetHealth` date-decay tests (T3) should already pass, confirming that path was never broken — the A11 mitigation handled the `'Excellent'` case.
- Related controllers using `healthStatus` as `'Good'`/`'injured'` are NOT touched — they are a separate semantic layer from the feed-system bands. Filed follow-up in the bd issue.
