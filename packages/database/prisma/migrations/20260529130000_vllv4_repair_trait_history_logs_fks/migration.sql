-- Equoria-vllv4: repair the trait_history_logs FK damage from the
-- Equoria-c3kb6 Supabase production restore. pg_restore reported 4 FK
-- constraint violations during the restore; the workaround at the time was
-- to skip those constraints, leaving the table without FKs in the canonical
-- DB even though schema.prisma declares them with onDelete: Cascade
-- (horseId) and onDelete: SetNull (groomId).
--
-- Measured at 2026-05-29:
--   - 57 rows with horseId referencing a horse that no longer exists
--   - 21 rows with groomId referencing a groom that no longer exists
--   - ultra_rare_trait_events (which the AC #5 also asked to audit) is
--     CLEAN — 0 orphans of either kind. No repair needed for that table;
--     its FK constraints exist and enforce.
--
-- This migration:
--   1) Reconciles the data with the schema's stated intent (deletes orphan
--      horseId rows — matches Cascade; nulls orphan groomId rows — matches
--      SetNull).
--   2) Re-creates the FK constraints that the c3kb6 restore dropped.
--
-- Order matters: the ALTER TABLE ... ADD CONSTRAINT calls would reject if
-- run before the data repair, because PostgreSQL refuses to add a FK
-- against rows that violate it.

BEGIN;

-- Step 1: data repair — matches the onDelete intent declared in schema.prisma.

-- DELETE 57 rows where horseId references a horse that no longer exists.
-- Matches `onDelete: Cascade` from schema.prisma.
DELETE FROM trait_history_logs
WHERE "horseId" NOT IN (SELECT id FROM horses);

-- NULL out 21 rows where groomId references a groom that no longer exists.
-- Matches `onDelete: SetNull` from schema.prisma.
UPDATE trait_history_logs
SET "groomId" = NULL
WHERE "groomId" IS NOT NULL
  AND "groomId" NOT IN (SELECT id FROM grooms);

-- Step 2: re-create the FK constraints the c3kb6 restore dropped.

ALTER TABLE trait_history_logs
  ADD CONSTRAINT trait_history_logs_horseId_fkey
  FOREIGN KEY ("horseId") REFERENCES horses(id)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE trait_history_logs
  ADD CONSTRAINT trait_history_logs_groomId_fkey
  FOREIGN KEY ("groomId") REFERENCES grooms(id)
  ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
