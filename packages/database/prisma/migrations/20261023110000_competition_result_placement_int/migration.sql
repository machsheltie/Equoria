-- Equoria-f46tb: CompetitionResult.placement becomes an integer rank.
--
-- Owner ruling 2026-10-22 (Stacey), options A and C: migrate the column from
-- String to Int AND backfill the ordinal rows. The nightly executors stored the
-- rank as a number string ('1', '2', ...); older paths stored the ordinal
-- ('1st', '2nd', ...), and readers that matched one spelling missed the other.
--
-- 1. Backfill: every stored placement becomes the rank it records - '1st' -> '1',
--    ' 2nd ' -> '2', '1' stays '1'. A value with no leading rank (none is known to
--    exist; e.g. 'DQ' or '') becomes NULL, which every reader already treats as
--    "no placing".
-- 2. The type change. Its USING cast now sees only digits or NULL, so it cannot
--    fail on a stray spelling; if one survived, the cast would abort the whole
--    migration rather than guess.
--
-- No index, constraint or view references the column.

BEGIN;

UPDATE "competition_results"
SET "placement" = substring(btrim("placement") from '^([0-9]+)')
WHERE "placement" IS NOT NULL
  AND "placement" !~ '^[0-9]+$';

ALTER TABLE "competition_results"
  ALTER COLUMN "placement" TYPE INTEGER USING "placement"::integer;

COMMIT;
