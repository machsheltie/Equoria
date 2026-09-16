-- Equoria-bebob (2026-09-15): drop the six redundant `horses` indexes.
--
-- OWNER RULING 2026-09-14 10:23: "Prune the six redundant indexes.
-- AUTHORISED: drop the five exact duplicates and the one prefix-redundant
-- index, via a migration (not ad hoc DDL), with the before/after pg_indexes
-- recorded; keep the databaseOptimizationService naming defect (Equoria-9xa92)
-- in view so they do not come back."
--
-- MEASURED BEFORE (live `equoria`, 2026-09-15, `SELECT ... FROM pg_indexes`,
-- 210 indexes in `public`). Grouping by the index DEFINITION with the name
-- elided produced exactly three byte-identical groups on `horses`:
--
--   btree ("userId")            horses_userId_idx
--                               idx_horses_user_horse_lookup
--   gin   ("disciplineScores")  idx_horses_discipline_scores_filter
--                               idx_horses_discipline_scores_gin
--                               idx_horses_disciplinescores_gin
--   gin   ("epigeneticFlags")   idx_horses_epigenetic_flags_gin
--                               idx_horses_epigenetic_flags_search
--                               idx_horses_epigeneticflags_gin
--
-- Five of those eight rows are redundant copies. The sixth index dropped here
-- is not a duplicate but a strict leading PREFIX: idx_horses_userid_age
-- ("userId", age) is covered by idx_horses_userid_age_trainingcooldown
-- ("userId", age, "trainingCooldown") under the leading-column rule, so it
-- serves no query the longer index does not already serve.
--
-- SURVIVOR FOR EACH DROPPED NAME (the name kept is the one schema.prisma
-- declares, so the Prisma differ keeps proposing an empty migration):
--
--   idx_horses_user_horse_lookup       -> horses_userId_idx          (@@index([userId]))
--   idx_horses_discipline_scores_gin   -> idx_horses_discipline_scores_filter
--   idx_horses_disciplinescores_gin    -> idx_horses_discipline_scores_filter
--   idx_horses_epigenetic_flags_search -> idx_horses_epigenetic_flags_gin
--   idx_horses_epigeneticflags_gin     -> idx_horses_epigenetic_flags_gin
--   idx_horses_userid_age              -> idx_horses_userid_age_trainingcooldown
--
-- Five of the six were created by migration
-- 20260528120000_qh6jk_align_runtime_indexes, which recorded what
-- backend/services/databaseOptimizationService.mjs had been creating outside
-- migration history. The sixth, idx_horses_user_horse_lookup, appears in no
-- migration at all and exists only where that service has run; it is the one
-- name on RUNTIME_CREATED_INDEX_ALLOWLIST in scripts/preflight/schema-drift.mjs.
-- Dropping it here leaves the live catalog and the replayed catalog equal
-- either way, because the allow-list tolerates an EXTRA index, never a missing
-- one.
--
-- THIS DOES NOT END THE DRIFT (Equoria-9xa92). databaseOptimizationService
-- still names an index from the caller's LABEL while resolving the column
-- through an aliasing map, so two labels for one column manufacture two
-- identical indexes. Five of the six names dropped below are re-emitted with
-- `CREATE INDEX IF NOT EXISTS` by the service's only callers, which are tests
-- (backend/__tests__/databaseOptimization.test.mjs and
-- databaseOptimizationService.test.mjs) issuing DDL against the shared
-- development database. Until Equoria-9xa92 removes that runtime DDL, a run of
-- either file recreates them. That is a source defect, not a reason to keep
-- the duplicates.
--
-- IF EXISTS on every statement: idempotent, and a no-op on any database where
-- the runtime service never ran.

DROP INDEX IF EXISTS "idx_horses_user_horse_lookup";
DROP INDEX IF EXISTS "idx_horses_discipline_scores_gin";
DROP INDEX IF EXISTS "idx_horses_disciplinescores_gin";
DROP INDEX IF EXISTS "idx_horses_epigenetic_flags_search";
DROP INDEX IF EXISTS "idx_horses_epigeneticflags_gin";
DROP INDEX IF EXISTS "idx_horses_userid_age";
