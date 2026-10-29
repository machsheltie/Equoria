-- Owner ruling 2026-10-21 (Stacey): Equoria names are camelCase, stored game
-- values included.
--
-- The AgeStage enum value two_year_old -> twoYearOld. RENAME VALUE relabels
-- the value in place, so every foal_development."ageStage" row that holds it
-- follows without an UPDATE. (The column is no longer written or read: the
-- named life stages were removed by the owner ruling 2026-10-15, Equoria-fr2kg
-- Q5. Its values still follow the naming rule.)
--
-- Idempotent: the rename runs only while the old label exists. The closing
-- check aborts if the old label survives or the new one is missing.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'AgeStage' AND e.enumlabel = 'two_year_old'
  ) THEN
    ALTER TYPE "AgeStage" RENAME VALUE 'two_year_old' TO 'twoYearOld';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'AgeStage' AND e.enumlabel = 'two_year_old'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'AgeStage' AND e.enumlabel = 'twoYearOld'
  ) THEN
    RAISE EXCEPTION 'age_stage_camelcase: AgeStage still holds two_year_old or lacks twoYearOld; aborting';
  END IF;
END $$;

COMMIT;
