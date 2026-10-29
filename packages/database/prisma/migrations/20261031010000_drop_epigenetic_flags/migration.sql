-- Equoria-efs4j: drop horses."epigeneticFlags" (owner ruling 2026-10-29, q300: remove
-- every remaining reader of the old flag store and drop the column).
--
-- Nothing has written the store since the flag engine and its admin batch route were
-- removed (Equoria-1vep2); traits live in "epigeneticModifiers" and change only through
-- the grooming-day reveal ladder. The application release that ships with this
-- migration no longer reads the column (show scoring, groom compatibility, temperament
-- analysis, foal milestones, the foal view and the flag/trait-interaction routes).
--
-- NOT backward compatible with the previous application release: its generated Prisma
-- client lists this column, so a bare horse read from an old instance would fail once it
-- is gone. Deploy the new release and this migration together.
--
-- No data is copied: real horses hold an empty list. The count of non-empty rows is
-- logged so the migration output shows what went. Dropping the column drops its GIN
-- index idx_horses_epigenetic_flags_gin with it; the explicit DROP INDEX makes that
-- visible and is a no-op afterwards.

DO $$
DECLARE
  flaggedRows integer;
BEGIN
  SELECT count(*) INTO flaggedRows FROM "horses"
   WHERE "epigeneticFlags" IS NOT NULL AND cardinality("epigeneticFlags") > 0;
  RAISE NOTICE 'dropping horses.epigeneticFlags (% non-empty)', flaggedRows;
END
$$;

DROP INDEX IF EXISTS "idx_horses_epigenetic_flags_gin";

ALTER TABLE "horses" DROP COLUMN IF EXISTS "epigeneticFlags";
