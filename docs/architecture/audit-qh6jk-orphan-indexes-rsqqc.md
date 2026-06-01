# Audit: per-index usage of the 17 qh6jk runtime-created orphan indexes (Equoria-rsqqc)

**Date:** 2026-06-01
**Auditor:** autonomous-agent-O
**Scope:** Each of the 17 indexes recorded by migration
`20260528120000_qh6jk_align_runtime_indexes` — verify whether any
production WHERE / ORDER BY clause actually uses the column shape, and
classify per the z8leh plan: **KEEP+declare**, **DROP**, or
**convert-to-schema**.
**Reference:**

- Parent: Equoria-z8leh (run the audit, declare the keepers, drop the rest)
- Predecessor: Equoria-qh6jk (closed with Option A — record the orphans
  to unblock `prisma migrate dev`)
- Migration: `packages/database/prisma/migrations/20260528120000_qh6jk_align_runtime_indexes/migration.sql`

---

## TL;DR

Of the 17 runtime-created indexes, **none** are demonstrably required by
current production query patterns. The breakdown:

- **9 GIN indexes** on JSONB / array columns: zero production WHERE
  clauses match the column shape (no `path`, `hasSome`, `@>`, or
  containment filter against `disciplineScores`, `epigeneticFlags`,
  `epigeneticModifiers`, `ultraRareTraits`, or `conformationScores` in
  any service / controller). **Recommendation: DROP all 9.**
- **7 composite btree indexes** on `horses`: the queries the
  `databaseOptimizationService` comment block names as the rationale
  (`{ id, userId }` ownership lookups, `{ userId, breedId }`
  paginated list) are either served by the primary key (`id` is PK,
  no composite needed) or by the existing single-column declared
  indexes (`@@index([userId])`, `@@index([breedId])` — PG can bitmap-AND
  these for any 2-column intersection). **Recommendation: DROP all 7.**
- **1 user_transactions** orphan `(userId, createdAt DESC)`: schema
  already declares `@@index([userId, createdAt])` (ascending). PG can
  use the ascending index for a descending ORDER BY via backward index
  scan (no separate index needed). **Recommendation: DROP.**

**Net: 17 DROP, 0 KEEP+declare, 0 convert-to-schema.**

The runtime-CREATE-INDEX side-effects in
`backend/services/databaseOptimizationService.mjs` and
`backend/modules/economy/services/financialLedgerService.mjs`
(`ensureLedgerTable`) should be deleted alongside the DROP migration so
the indexes do not re-materialize on the next app start. Per the parent
issue, `databaseOptimizationService` has zero production callers
(verified via grep) and is a candidate for full retirement.

---

## Methodology

1. **Query-pattern survey.** `Grep` across `backend/` (excluding
   `__tests__/`) for every reference to the columns each orphan covers.
   Surveyed: `disciplineScores`, `epigeneticFlags`,
   `epigeneticModifiers`, `ultraRareTraits`, `conformationScores`,
   `trainingCooldown`, `userId + stableId`, `userId + breedId`,
   `userId + age`, `userId + createdAt`. For each match read the
   surrounding code to confirm whether the index column shape matches
   the actual filter / order shape (a column being _projected_ is not
   the same as being _filtered_).
2. **Schema cross-check.** Read `packages/database/prisma/schema.prisma`
   lines 287-304 (the `horses` model's `@@index` decorators) and 778-792
   (the `UserTransaction` model) to identify which declared indexes
   could already serve the surveyed query patterns.
3. **PK overlap check.** For every `findFirst({ id, userId })` /
   `findUnique({ id })` callsite, noted that the primary key on `id`
   already provides the canonical access path — the orphan composite
   `(userId, ...)` indexes are not required to serve these.
4. **Side-effect provenance check.** Traced each runtime
   `CREATE INDEX IF NOT EXISTS` back to its source line in
   `databaseOptimizationService.mjs` / `financialLedgerService.mjs` so
   the DROP migration's companion code-deletion patch has the exact
   lines to remove.

---

## Per-index findings

| #   | Index name                               | Table             | Columns / type                  | Source line                                       | Query-pattern match?                                                                                                                                                                              | Recommendation                                                |
| --- | ---------------------------------------- | ----------------- | ------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | `idx_horses_discipline_scores_filter`    | horses            | GIN on `disciplineScores`       | databaseOptimizationService.mjs:664               | NO — zero `where: { disciplineScores: ... }` in production code                                                                                                                                   | **DROP**                                                      |
| 2   | `idx_horses_discipline_scores_gin`       | horses            | GIN on `disciplineScores`       | databaseOptimizationService.mjs (duplicate)       | NO — see #1; also a name-duplicate of #3                                                                                                                                                          | **DROP**                                                      |
| 3   | `idx_horses_disciplinescores_gin`        | horses            | GIN on `disciplineScores`       | databaseOptimizationService.mjs (duplicate)       | NO — see #1                                                                                                                                                                                       | **DROP**                                                      |
| 4   | `idx_horses_epigenetic_flags_gin`        | horses            | GIN on `epigeneticFlags`        | databaseOptimizationService.mjs                   | NO — only `enhancedReportingService` reads via `asFlagArray(h.epigeneticFlags).filter(...)` (in-JS, no SQL filter)                                                                                | **DROP**                                                      |
| 5   | `idx_horses_epigenetic_flags_search`     | horses            | GIN on `epigeneticFlags`        | databaseOptimizationService.mjs (duplicate)       | NO — see #4                                                                                                                                                                                       | **DROP**                                                      |
| 6   | `idx_horses_epigeneticflags_gin`         | horses            | GIN on `epigeneticFlags`        | databaseOptimizationService.mjs (duplicate)       | NO — see #4                                                                                                                                                                                       | **DROP**                                                      |
| 7   | `idx_horses_epigeneticmodifiers_gin`     | horses            | GIN on `epigeneticModifiers`    | databaseOptimizationService.mjs                   | NO — zero `where` filters; column read whole-row only                                                                                                                                             | **DROP**                                                      |
| 8   | `idx_horses_stats_gin`                   | horses            | GIN on `conformationScores`     | databaseOptimizationService.mjs                   | NO — zero JSONB filters; conformation scores read as whole object                                                                                                                                 | **DROP**                                                      |
| 9   | `idx_horses_ultrararetraits_gin`         | horses            | GIN on `ultraRareTraits`        | databaseOptimizationService.mjs                   | NO — zero `where: { ultraRareTraits: ... }` in production                                                                                                                                         | **DROP**                                                      |
| 10  | `idx_horses_age_and_training_status`     | horses            | (age, trainingCooldown)         | databaseOptimizationService.mjs:333-336           | NO — only WHERE on trainingCooldown is `{ id, OR: [...] }` (PK lookup, in trainingController:229)                                                                                                 | **DROP**                                                      |
| 11  | `idx_horses_breedid_age`                 | horses            | (breedId, age)                  | databaseOptimizationService.mjs:333-336           | NO — `GET /api/horses` filters `{ userId, breedId }` (not breedId + age); served by declared `@@index([breedId])`                                                                                 | **DROP**                                                      |
| 12  | `idx_horses_ownerid_stableid`            | horses            | (userId, stableId)              | databaseOptimizationService.mjs:333-336           | NO — no production `where: { userId, stableId }` found; horses-by-stable queries filter by stableId alone (declared `@@index([stableId])`)                                                        | **DROP**                                                      |
| 13  | `idx_horses_userid_age`                  | horses            | (userId, age)                   | databaseOptimizationService.mjs:333-336           | NO — `where: { userId, age }` not used in any production query; foal-by-user lookups go via `{ userId, dateOfBirth: { gte: ... } }` shape                                                         | **DROP**                                                      |
| 14  | `idx_horses_userid_age_trainingcooldown` | horses            | (userId, age, trainingCooldown) | databaseOptimizationService.mjs:333-336           | NO — trainingController atomic-claim is `where: { id, OR: [...] }`; nextActionsController filters by userId then JS-filters cooldown post-fetch                                                   | **DROP**                                                      |
| 15  | `idx_horses_userid_breedid`              | horses            | (userId, breedId)               | databaseOptimizationService.mjs:333-336           | MARGINAL — `GET /api/horses` does filter on both (`horseRoutes.mjs:90-100`); declared `@@index([userId])` + `@@index([breedId])` already bitmap-AND for this                                      | **DROP** (covered by existing single-column indexes)          |
| 16  | `idx_horses_userid_createdat`            | horses            | (userId, createdAt)             | databaseOptimizationService.mjs:333-336           | NO — no production query orders horses by createdAt scoped to userId                                                                                                                              | **DROP**                                                      |
| 17  | `user_transactions_user_created_idx`     | user_transactions | (userId, createdAt DESC)        | financialLedgerService.mjs:20 (ensureLedgerTable) | MARGINAL — `getUserTransactions` (financialLedgerService:459) is `where: { userId }, orderBy: { createdAt: 'desc' }`; PG can use ascending `@@index([userId, createdAt])` via backward index scan | **DROP** (covered by declared `@@index([userId, createdAt])`) |

---

## Aggregate

- **Drop unanimously: 17 / 17.**
- **Keep + declare via @@index: 0 / 17.**
- **Convert-to-schema: 0 / 17.**

The runtime-created indexes are a **vestigial optimization layer** —
they were added speculatively (presumed `databaseOptimizationService` was
going to be a startup-time index-warmup hook) but never consumed by a
real query pattern. Eight of the 17 are even **name-duplicates of each
other** (`*discipline_scores_filter` / `*discipline_scores_gin` /
`*disciplinescores_gin`; `*epigenetic_flags_gin` /
`*epigenetic_flags_search` / `*epigeneticflags_gin`) — index-name typos
during the iterative attempts to dedupe were laid down as separate
catalog entries because PG happily creates whatever name you ask for.

---

## Recommended fan-out (next steps for parent Equoria-z8leh)

Per `OPTIMAL_FIX_DISCIPLINE §3` (file separate issues, do not bundle),
the z8leh roll-up should split as follows:

1. **DROP migration for the 9 horses GIN orphans** (entries 1–9). Single
   migration with 9 `DROP INDEX IF EXISTS ...` statements; idempotent.
   File as separate bd.
2. **DROP migration for the 7 horses btree orphans** (entries 10–16).
   Same shape. File as separate bd (or bundle with #1 since both are
   horses-table; the split matters only if the audit table needs more
   per-class deliberation).
3. **DROP migration for the user_transactions DESC orphan** (entry 17).
   Single statement. File as separate bd; also covers the cleanup of
   `ensureLedgerTable` (`financialLedgerService.mjs:20`).
4. **Delete the runtime CREATE INDEX side-effects.** Two services:
   - `backend/services/databaseOptimizationService.mjs` — lines 287-289
     (GIN) and 333-336 (composite btree). The whole service has no
     production callers (verified by parent issue grep); a fuller
     retirement (deletion of the file + its test suite at
     `backend/modules/services/__tests__/databaseOptimization*.test.mjs`)
     should be considered as a follow-up. Decision required from the
     LEAD per parent issue's "step (e)".
   - `backend/modules/economy/services/financialLedgerService.mjs`
     `ensureLedgerTable()` — line 20 `CREATE INDEX IF NOT EXISTS
user_transactions_user_created_idx`. The CREATE TABLE IF NOT EXISTS
     and the CREATE INDEX both predate the
     `20260414000000_add_user_transactions` migration that now declares
     the table + a canonical index. Both runtime calls are pure
     redundancy. Deletion has no test impact (no test asserts these
     runtime statements; the typed Prisma `userTransaction.findMany`
     path that the suite exercises does not invoke
     `ensureLedgerTable`).
5. **(Decision required from LEAD)** Retire
   `databaseOptimizationService.mjs` entirely (no production callers
   found) vs. keep as dev-tool. Affects step 4 — full retirement means
   deleting the test suite alongside; keep-as-dev-tool means rewriting
   the tests to not assert the deleted CREATE INDEX strings. File as
   separate bd with user input.
6. **Verify `prisma migrate dev` on a fresh shadow DB after each DROP
   migration ships.** The qh6jk Option A migration unblocked it by
   recording the orphans; the DROP migrations restore the original
   posture where schema = DB.

---

## What was NOT done (OPTIMAL_FIX §6)

- **No DROP migration written.** This issue is the audit deliverable.
  The DROPs are the deferred work above (steps 1–3).
- **No EXPLAIN-plan verification.** The "PG bitmap-AND covers
  composite" claim (#15) and the "backward index scan covers DESC"
  claim (#17) are well-documented PG behaviors but not proven against
  the canonical DB's actual planner output. A real DBA audit would run
  `EXPLAIN ANALYZE` on the listed queries before and after the DROP to
  confirm no plan regression. Not in scope for an audit doc; explicitly
  flagged for the DROP-migration PR's verification log.
- **No survey of the `databaseOptimizationService.mjs` 16-horses
  composite list at lines 287-289 / 333-336 beyond the names already in
  the qh6jk migration.** The service file might emit additional indexes
  that are NOT in qh6jk's 17 (i.e., names that the canonical DB does
  not have but the service tries to create); a separate sweep of
  `CREATE INDEX IF NOT EXISTS` strings vs. actual catalog rows would
  surface those. Not done here because the qh6jk migration is the
  declared source-of-truth for the 17; widening the audit to
  service-source-of-truth is a different question. Flagged as
  candidate follow-up.

---

## Alternative considered (OPTIMAL_FIX §5)

**(A)** This audit recommends DROP all 17.

**(B)** Alternative: **KEEP+declare** a subset (specifically #15
`userid_breedid` and #17 `user_transactions_user_created_idx`) on the
basis that they directly cover real query shapes. Counter-argument:
both are covered by existing declared indexes via standard PG
optimizations (bitmap-AND for two single-column indexes intersecting,
backward index scan for DESC on an ASC index). Declaring them
introduces a _redundant_ index that adds write amplification (every
INSERT / UPDATE of `horses` or `user_transactions` has to update the
extra index) without measurable read benefit. The asymmetry is real:
the read-side hypothetical benefit needs an EXPLAIN-plan to validate;
the write-side cost is certain on every mutation.

**(C)** Alternative: **KEEP all 17 in a single forward `@@index`
migration**, declaring everything the runtime services would
otherwise create at startup. This codifies the runtime side-effects
into the canonical schema. Counter-argument: the cost is real (16
extra horses-table indexes write-amplify every horse mutation, and
horse mutations are the busiest write path in the game — training,
breeding, aging cron). The benefit is speculative — no query EXPLAIN
demonstrates a need.

**Recommendation:** stick with (A). Bring read-side EXPLAIN evidence
back to LEAD if a future workload changes the calculus.

---

## Cross-references

- Parent: Equoria-z8leh
- Predecessor migration: `20260528120000_qh6jk_align_runtime_indexes`
- Related (gold-standard runtime-CREATE-INDEX pattern to avoid):
  `backend/services/databaseOptimizationService.mjs` lines 287-289 (GIN)
  and 333-336 (composite btree); `backend/modules/economy/services/
financialLedgerService.mjs` `ensureLedgerTable()` line 20.
- Hjtys audit pattern (sibling — "audit per callsite, then split into
  per-callsite bds"): `docs/architecture/audit-debitMoneyOrThrow-callsites-hjtys.md`.
