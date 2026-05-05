-- Canonicalize horse.sex to Title Case (Equoria-duz2).
--
-- Historical drift: the marketplace store endpoint persisted lowercase
-- ('mare', 'stallion'); auth/foaling/breeding persisted Title Case
-- ('Mare', 'Stallion', 'Filly', 'Colt', 'Gelding'); some seeds and tests
-- used uppercase. This migration normalizes existing rows to a single
-- canonical Title Case form so horse-card displays are consistent and
-- the application layer's `canonicalizeHorseSex()` is the single source
-- of truth going forward.
--
-- The Prisma client's `$extends` interceptor in prismaClient.mjs guards
-- every future write, so the only thing left to clean up is legacy data.

-- Step 1 — normalize whitespace and capitalization for known canonical
-- values. Use explicit CASE so we never produce a value outside the
-- allow-list, even if INITCAP misbehaves on some PostgreSQL builds.
UPDATE "horses"
SET "sex" = CASE
  WHEN LOWER(TRIM(REGEXP_REPLACE("sex", '\s+', ' ', 'g'))) = 'stallion'    THEN 'Stallion'
  WHEN LOWER(TRIM(REGEXP_REPLACE("sex", '\s+', ' ', 'g'))) = 'mare'        THEN 'Mare'
  WHEN LOWER(TRIM(REGEXP_REPLACE("sex", '\s+', ' ', 'g'))) = 'gelding'     THEN 'Gelding'
  WHEN LOWER(TRIM(REGEXP_REPLACE("sex", '\s+', ' ', 'g'))) = 'colt'        THEN 'Colt'
  WHEN LOWER(TRIM(REGEXP_REPLACE("sex", '\s+', ' ', 'g'))) = 'filly'       THEN 'Filly'
  WHEN LOWER(TRIM(REGEXP_REPLACE("sex", '\s+', ' ', 'g'))) = 'rig'         THEN 'Rig'
  WHEN LOWER(TRIM(REGEXP_REPLACE("sex", '\s+', ' ', 'g'))) = 'spayed mare' THEN 'Spayed Mare'
  ELSE "sex"
END
WHERE "sex" IS NOT NULL
  AND "sex" NOT IN ('Stallion', 'Mare', 'Gelding', 'Colt', 'Filly', 'Rig', 'Spayed Mare');

-- Step 2 — fail loud if any rows still hold a value outside the canonical
-- set. The DO block raises an exception inside the migration's implicit
-- transaction; Prisma rolls everything back so we don't leave the DB in a
-- half-normalized state. If this fails, run:
--   SELECT DISTINCT "sex" FROM "horses" WHERE "sex" NOT IN (...);
-- against the real DB to see what unexpected value crept in, then extend
-- the CASE above.
DO $$
DECLARE
  bad_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM "horses"
  WHERE "sex" IS NOT NULL
    AND "sex" NOT IN ('Stallion', 'Mare', 'Gelding', 'Colt', 'Filly', 'Rig', 'Spayed Mare');
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'canonicalize_horse_sex: % row(s) hold non-canonical sex values; aborting', bad_count;
  END IF;
END $$;
