# ADR-012: Backend Jest `testMatch` and the Legacy `backend/tests/` Suite

**Status:** Proposed (recommendation only — no config change applied)
**Date:** 2026-05-22
**Deciders:** Backend Team (pending user/lead approval)
**Tracking:** bd `Equoria-oehh1`
**Scope of decision:** Whether the default backend Jest run (`npm test`,
which is also the pre-push full-suite hook) should keep matching the legacy
tests under `backend/tests/`, exclude them, or migrate them.

> This ADR is **analysis + recommendation**. Per the issue's constraints, the
> Jest config is **not** modified here (changing `testMatch` has test-suite
> blast radius and is the lead/user's call). The exact diff that would
> implement the recommendation is provided at the end.

---

## Context

### Current configuration

`backend/jest.config.mjs`:

```javascript
testMatch: ['**/*.test.mjs', '**/*.test.js'],
testPathIgnorePatterns: [
  '/node_modules/',
  '/coverage/',
  '/dist/',
  '/build/',
  '/tests/load/',
  '[Pp]erformance.*\\.test\\.mjs$',
],
```

`testMatch` is a recursive glob, so it picks up **every** `*.test.mjs` /
`*.test.js` in the backend tree, including:

- `backend/modules/<domain>/__tests__/*.test.mjs` — the canonical, co-located
  module tests (per `CONTRIBUTING.md` § "Backend Module Conventions" and
  CLAUDE.md project structure).
- `backend/__tests__/**` — cross-module integration + middleware sentinels.
- **`backend/tests/*.test.mjs`** — a large legacy directory of ~95 test files
  predating the Epic 20/21 module restructure (e.g. `competition.test.mjs`,
  `groomSystem.test.mjs`, `traitEvaluation.test.mjs`, the foal-task suites,
  and two misleadingly-named `*.integration.test.mjs` files).

### What the issue framing undercounts

The issue asks specifically about `tests/*.integration.test.mjs`. There are
only **two** such files:

- `backend/tests/foalTaskExclusivity.integration.test.mjs`
- `backend/tests/taskTraitInfluence.integration.test.mjs`

Both were read for this analysis. Despite the `.integration` suffix, **neither
is a DB-integration test and neither mocks anything**. They import config and
pure utility modules (`taskInfluenceConfig.mjs`, `groomConfig.mjs`,
`groomSystem.mjs`, `traitEvaluation.mjs`) and assert cross-config consistency
(e.g. "the task→trait influence map covers exactly the foal task arrays").
They are real, fast, no-mock unit tests of configuration invariants. They do
**not** duplicate any module-owned test and they do **not** touch the database.

The broader and more meaningful question is therefore about the **whole
`backend/tests/` legacy directory** (~95 files), not those two files.

### Relevant project rules

- **Real DB only / no mocks** (CLAUDE.md Testing Philosophy + Non-Negotiable
  Rule 2): backend tests run against the canonical Equoria DB; cleanup must be
  scoped. Many legacy `backend/tests/` suites predate this doctrine.
- **Module-test co-location** (CONTRIBUTING.md): new module tests belong in
  `backend/modules/<domain>/__tests__/`; `backend/__tests__/` is reserved for
  cross-module/middleware tests. `backend/tests/` is _neither_ of the
  sanctioned locations — it is legacy.
- **Pre-push hook = full Jest suite** (CLAUDE.md Rule 4): the default config is
  what runs on every push (~10 min). Anything `testMatch` includes is on the
  critical path to landing work.

---

## Options

### Option A — Keep matching `backend/tests/` (status quo)

- **Pro:** No behavior change; no risk of silently dropping coverage. Some
  legacy suites still exercise real algorithms (competition scoring, trait
  evaluation, foal task logic) that have no equivalent module-co-located test.
- **Pro:** The two `.integration.test.mjs` files are cheap, correct, and
  guard genuine config invariants — losing them would be a real coverage loss.
- **Con:** `backend/tests/` is an unsanctioned third test location, muddying
  the "where does a test live?" convention. New contributors may add tests
  there by mimicry.
- **Con:** Some legacy suites may use patterns the current doctrine forbids
  (mocks, unscoped cleanup) — but that is a per-file defect, not a reason to
  exclude the whole directory.

### Option B — Exclude `backend/tests/` from the default run

Add `'/tests/'` (or a more targeted pattern) to `testPathIgnorePatterns`.

- **Pro:** Pre-push suite shrinks; the only sanctioned locations
  (`modules/**/__tests__`, `__tests__`) run.
- **Con (decisive):** Blanket exclusion **drops ~95 suites of real coverage**
  with no migration. This is exactly the kind of "make the gate quieter"
  move that `EDGE_CASE_FIX_DISCIPLINE.md` §2 and `OPTIMAL_FIX_DISCIPLINE.md`
  warn against — it would hide, not fix. Several of these suites have no
  module-located replacement, so the net effect is reduced confidence on
  scoring/trait/foal logic with a green board.
- **Con:** `setupFilesAfterEnv`/`globalSetup` still point at `tests/setup.mjs`,
  `tests/globalSetup.mjs`, `tests/teardown.mjs` — `backend/tests/` is load-
  bearing infrastructure, not purely legacy cruft. Excluding the directory
  wholesale would need care to avoid implying the setup files are dead too.

### Option C — Migrate legacy `backend/tests/` into sanctioned locations

Move each `backend/tests/<x>.test.mjs` to the owning module's `__tests__/`
(or to `backend/__tests__/integration/` if cross-module), updating imports,
modernizing any forbidden mocks to real-DB, and scoping cleanup. Then the
directory holds only shared setup infra.

- **Pro:** Ends with one clean convention, zero coverage loss, doctrine-
  compliant suites.
- **Con:** Large, mechanical, high-blast-radius effort (~95 files, many with
  import-depth and fixture changes). Must be done in small same-session
  commits per CLAUDE.md Rule 1 — i.e. as its own tracked migration epic, not
  bundled into this decision (`EDGE_CASE_FIX_DISCIPLINE.md` §7).

---

## Recommendation

**Keep matching `backend/tests/` for now (Option A), and open a separate,
incremental migration track toward Option C.** Do **not** adopt Option B.

Rationale:

1. **Coverage is the priority, not directory tidiness.** The legacy suites
   carry real, non-duplicated coverage of core game math (competition,
   traits, foal tasks). Excluding them trades a true signal for a faster
   green — the precise anti-pattern the fix-discipline rules forbid.
2. **The two `.integration.test.mjs` files named in the issue are healthy.**
   They are no-mock, no-DB config-invariant tests with no module-located
   equivalent. There is no case for excluding them.
3. **`backend/tests/` is load-bearing.** The Jest `setupFilesAfterEnv`,
   `globalSetup`, and `globalTeardown` live there. The directory is not going
   away regardless; the right end-state is "infra + migrated tests gradually
   relocated," reached by a deliberate migration, not a `testPathIgnorePatterns`
   one-liner.
4. **Migration is the correct long-term fix** but is a multi-commit epic with
   real blast radius. It should be tracked and executed file-by-file (each move
   verified against the real DB), never as a single bulk change to land on
   master in one session.

### What WOULD change if the lead instead chose Option B (exclude)

For completeness, the precise config change to exclude the legacy directory
(NOT recommended) would be:

```diff
   testPathIgnorePatterns: [
     '/node_modules/',
     '/coverage/',
     '/dist/',
     '/build/',
     '/tests/load/',
+    // Legacy pre-Epic-20 suite location. NOTE: tests/setup.mjs,
+    // tests/globalSetup.mjs, tests/teardown.mjs are Jest infra (referenced by
+    // setupFilesAfterEnv/globalSetup/globalTeardown) and are NOT test files,
+    // so this pattern (which only filters *test* file paths) does not disable
+    // them. This DROPS ~95 real-coverage suites — see ADR-012 for why this is
+    // discouraged without a migration.
+    '<rootDir>/tests/[^/]+\\.test\\.mjs$',
     '[Pp]erformance.*\\.test\\.mjs$',
   ],
```

(A bare `'/tests/'` entry is rejected because it would also match
`backend/tests/load/` — already covered — and risks over-matching any nested
`tests/` segment; the anchored `<rootDir>/tests/[^/]+\.test\.mjs$` limits the
exclusion to top-level files in `backend/tests/`. Even so: not recommended.)

### Recommended config change

**None at this time.** Leave `backend/jest.config.mjs` `testMatch` /
`testPathIgnorePatterns` unchanged. Track the migration as a separate epic.

---

## Consequences

- The pre-push full suite continues to include the legacy directory (the ~10-
  min cost is accepted per CLAUDE.md Rule 4).
- A follow-up migration epic should relocate legacy suites into
  `backend/modules/<domain>/__tests__/` (module-owned) or
  `backend/__tests__/integration/` (cross-module), one verified commit at a
  time, modernizing any forbidden mocks/unscoped cleanup encountered.
- Until migration completes, `backend/tests/` remains a documented exception:
  legacy test location + shared Jest setup infrastructure.
