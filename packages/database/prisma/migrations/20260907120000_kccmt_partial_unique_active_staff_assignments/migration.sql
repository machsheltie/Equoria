-- Equoria-kccmt (2026-09-07), closing the owner decision Equoria-6p398.10:
-- scope the staff-assignment uniqueness to ACTIVE rows only.
--
-- WHAT WAS WRONG
--   rider_assignments  UNIQUE ("riderId",  "horseId", "isActive")
--   trainer_assignments UNIQUE ("trainerId","horseId", "isActive")
--   groom_assignments   UNIQUE ("foalId",  "groomId", "isActive")
--
--   Because "isActive" is part of the key, each of these enforced TWO rules:
--     (1) at most one ACTIVE row per (staff, horse) pair  -- wanted; and
--     (2) at most one INACTIVE row per (staff, horse) pair -- a cap on HISTORY,
--         which is the defect.
--
--   Rule (2) meant that flipping an active row to inactive raised P2002 the
--   moment the pair already held an inactive row. Reachable in four ordinary
--   player actions:
--     * assignRider  (backend/modules/riders/controllers/riderController.mjs)
--       and assignTrainer (…/trainers/controllers/trainerController.mjs) both
--       end with an unguarded
--       `updateMany({ horseId, isActive: true } -> isActive: false)`, so the
--       sequence assign R -> assign R2 -> assign R -> assign R3 answered
--       HTTP 500; and
--     * the horse-sale reconciliation
--       (marketplace/services/horseTransferReconciliation.mjs) had to DELETE
--       the superseded inactive row before deactivating, destroying one real
--       assignment row per re-assigned pair on every sale. That interim guard
--       is removed in the same change as this migration.
--
-- WHAT THIS DOES
--   Replaces each composite unique with a PARTIAL unique index over the same
--   (staff, horse) columns, restricted to `WHERE "isActive"`. Rule (1) survives
--   unchanged and stays enforced by the database — the only thing that can stop
--   two racing writers leaving two active assignments on one pair. Rule (2) is
--   deliberately gone: inactive rows are history and history must accumulate.
--
-- SAFETY ON EXISTING DATA
--   Creating a unique index over active rows can only fail if duplicate ACTIVE
--   rows already exist. The index being dropped ALREADY forbids exactly that,
--   so the new index accepts a strict superset of the row sets the old one
--   accepted and the failure mode is impossible by construction. Measured
--   read-only on the local canonical database before writing this file
--   (2026-09-07): rider_assignments 0 rows, trainer_assignments 0 rows,
--   groom_assignments 13 rows (13 active) — and ZERO pairs with more than one
--   active row in any of the three tables.
--   Consequently this migration performs NO repair and contains NO DELETE, no
--   UPDATE and no TRUNCATE. It is pure DDL. No player row is transformed.
--
-- PRISMA NOTE FOR WHOEVER TOUCHES THIS NEXT
--   Prisma cannot express a partial index in `@@unique`/`@@index`, so the three
--   `@@unique(... isActive)` attributes were REMOVED from schema.prisma (with a
--   comment on each model pointing here) and the partial indexes live only in
--   this raw SQL. A later `prisma migrate dev` may therefore propose a
--   migration that DROPs these three indexes. Edit that DROP out. This is the
--   same posture 20260528120000_qh6jk_align_runtime_indexes already took for
--   the runtime-created indexes; there is no Prisma-native alternative.
--
--   Nothing in the codebase used the generated compound-unique input names
--   (`riderId_horseId_isActive`, `trainerId_horseId_isActive`,
--   `foalId_groomId_isActive`), so removing the attributes breaks no query.
--   The per-column indexes (riderId / trainerId / foalId / groomId / horseId /
--   userId) are untouched.
--
--   CONCURRENTLY is not used: Prisma wraps each migration in BEGIN/COMMIT and
--   CREATE INDEX CONCURRENTLY is illegal inside a transaction. These tables are
--   at single-replica scale where the brief lock is acceptable.

-- ── rider_assignments ───────────────────────────────────────────────────────
DROP INDEX IF EXISTS "rider_assignments_riderId_horseId_isActive_key";

CREATE UNIQUE INDEX "rider_assignments_active_riderId_horseId_key"
  ON "rider_assignments" ("riderId", "horseId")
  WHERE "isActive";

-- ── trainer_assignments ─────────────────────────────────────────────────────
DROP INDEX IF EXISTS "trainer_assignments_trainerId_horseId_isActive_key";

CREATE UNIQUE INDEX "trainer_assignments_active_trainerId_horseId_key"
  ON "trainer_assignments" ("trainerId", "horseId")
  WHERE "isActive";

-- ── groom_assignments ───────────────────────────────────────────────────────
DROP INDEX IF EXISTS "groom_assignments_foalId_groomId_isActive_key";

CREATE UNIQUE INDEX "groom_assignments_active_foalId_groomId_key"
  ON "groom_assignments" ("foalId", "groomId")
  WHERE "isActive";
