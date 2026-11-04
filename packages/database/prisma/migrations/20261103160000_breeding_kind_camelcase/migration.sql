-- Owner ruling 2026-10-21 (Stacey): Equoria names are camelCase, stored game
-- values included (phase 7, owner ruling q351, Equoria-pjvp8.9).
--
-- The BreedingKind enum values OWN_PAIR, PUBLIC_STUD, PRIVATE_STUD ->
-- ownPair, publicStud, privateStud. RENAME VALUE relabels each value in place,
-- so every breeding_records."kind" row follows without an UPDATE and no row is
-- rewritten.
--
-- Idempotent: each rename runs only while its old label exists. The closing
-- check aborts the whole migration if any old label survives or a new one is
-- missing.

BEGIN;

DO $$
DECLARE
  pair TEXT[];
BEGIN
  FOREACH pair SLICE 1 IN ARRAY ARRAY[
    ARRAY['OWN_PAIR', 'ownPair'],
    ARRAY['PUBLIC_STUD', 'publicStud'],
    ARRAY['PRIVATE_STUD', 'privateStud']
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'BreedingKind' AND e.enumlabel = pair[1]
    ) THEN
      EXECUTE format('ALTER TYPE "BreedingKind" RENAME VALUE %L TO %L', pair[1], pair[2]);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  labels TEXT[];
BEGIN
  SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder) INTO labels
  FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
  WHERE t.typname = 'BreedingKind';
  IF labels IS DISTINCT FROM ARRAY['ownPair', 'publicStud', 'privateStud'] THEN
    RAISE EXCEPTION 'breeding_kind_camelcase: BreedingKind labels are %, expected {ownPair,publicStud,privateStud}; aborting', labels;
  END IF;
END $$;

COMMIT;
