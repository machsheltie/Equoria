-- Equoria-576c0.5: make horses."temperament" and horses."gaitScores" required
-- (owner ruling 2026-10-19, decision 4 / O5, option A).
--
-- Every creation path writes both at insert, rolled from the horse's breed
-- (6c1c136a3 / d8d62cd20), and backend/scripts/backfill-horse-temperament-gaits.mjs
-- fills older rows from their breed. Run that backfill with --apply first; it must
-- report 0 NULL temperament and 0 NULL gaitScores.
--
-- This migration never guesses a value: if any NULL remains it aborts, naming the
-- counts, and nothing changes. Backward compatible with the previous application
-- release, which already writes both on every insert.

DO $$
DECLARE
  null_temperament integer;
  null_gaits integer;
BEGIN
  SELECT count(*) FILTER (WHERE "temperament" IS NULL),
         count(*) FILTER (WHERE "gaitScores" IS NULL)
    INTO null_temperament, null_gaits
    FROM "horses";
  IF null_temperament > 0 OR null_gaits > 0 THEN
    RAISE EXCEPTION 'horses still has % NULL temperament and % NULL gaitScores; run backfill-horse-temperament-gaits.mjs --apply first',
      null_temperament, null_gaits;
  END IF;
END $$;

ALTER TABLE "horses" ALTER COLUMN "temperament" SET NOT NULL;
ALTER TABLE "horses" ALTER COLUMN "gaitScores" SET NOT NULL;
