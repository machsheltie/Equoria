-- Owner ruling 2026-10-26 (q65): the database tidy-up, all approved.
--   Equoria-e66h   drop horses.finalDisplayColor and horses.genotype
--   Equoria-97se   drop horses.rider (the JSON copy of the assigned rider)
--   Equoria-80as   drop horses.phenotypicMarkings, keeping phenotype
--   Equoria-cmw85.35  drop the redundant strict-prefix indexes
--
-- NOT backward compatible with the previous application release: the old code selects and
-- writes these columns. Deploy the new release and this migration together (migrate
-- deploy runs first on start; an old instance still running during the swap would error
-- on horse reads until it is replaced).
--
-- DATA IS COPIED BEFORE ANYTHING IS DROPPED. A development database holds none of it, but
-- production may. Each copy is guarded so it never overwrites a value that is already
-- there, and never touches a phenotype that is not a JSON object.

-- 1. finalDisplayColor -> phenotype.colorName, only where the phenotype has no colour name.
UPDATE "horses"
   SET "phenotype" = COALESCE(CASE WHEN jsonb_typeof("phenotype") = 'object' THEN "phenotype" END, '{}'::jsonb)
                     || jsonb_build_object('colorName', "finalDisplayColor")
 WHERE "finalDisplayColor" IS NOT NULL
   AND btrim("finalDisplayColor") <> ''
   AND ("phenotype" IS NULL
        OR (jsonb_typeof("phenotype") = 'object' AND COALESCE("phenotype" ->> 'colorName', '') = ''));

-- 2. phenotypicMarkings -> phenotype. The markings keys sit at the top level of the
--    phenotype object (that is how foaling writes it). The phenotype's own keys win over
--    the copied ones, so nothing already recorded is replaced.
UPDATE "horses"
   SET "phenotype" = "phenotypicMarkings"
                     || COALESCE(CASE WHEN jsonb_typeof("phenotype") = 'object' THEN "phenotype" END, '{}'::jsonb)
 WHERE jsonb_typeof("phenotypicMarkings") = 'object'
   AND "phenotypicMarkings" <> '{}'::jsonb
   AND ("phenotype" IS NULL OR jsonb_typeof("phenotype") = 'object');

-- 3. What is dropped without a copy, so the migration log shows it. genotype was never
--    written by the application (colorGenotype is the real column); rider is a copy of the
--    active RiderAssignment row, which stays.
DO $$
DECLARE
  riderRows integer;
  genotypeRows integer;
BEGIN
  SELECT count(*) INTO riderRows FROM "horses" WHERE "rider" IS NOT NULL;
  SELECT count(*) INTO genotypeRows FROM "horses" WHERE "genotype" IS NOT NULL;
  RAISE NOTICE 'dropping horses.rider (% non-null rows, a copy of the active rider assignment) and horses.genotype (% non-null rows)', riderRows, genotypeRows;
END
$$;

ALTER TABLE "horses" DROP COLUMN IF EXISTS "finalDisplayColor";
ALTER TABLE "horses" DROP COLUMN IF EXISTS "genotype";
ALTER TABLE "horses" DROP COLUMN IF EXISTS "phenotypicMarkings";
ALTER TABLE "horses" DROP COLUMN IF EXISTS "rider";

-- 4. Redundant strict-prefix indexes. Each is the leading column(s) of an index on the same
--    table that serves the same lookups, so the narrow one only adds write cost:
--      trait_history_logs (horseId)            covered by (horseId, timestamp)
--      milestone_trait_logs (horseId)          covered by (horseId, milestoneType)
--      ultra_rare_trait_events (horseId)       covered by (horseId, traitName)
--      groom_horse_synergies (groomId)         covered by the unique (groomId, horseId)
--      groom_assignment_logs (groomId)         covered by (groomId, assignedAt)
--      groom_talent_selections (groomId)       covered by the unique (groomId)
--      groom_metrics (groomId)                 covered by the unique (groomId)
--      show_entries (showId)                   covered by the unique (showId, horseId)
--      staff_marketplace_state (userId)        covered by the unique (userId, staffType)
--    Kept on purpose, although Equoria-cmw85.35 listed them: groom_assignments (foalId),
--    rider_assignments (riderId) and trainer_assignments (trainerId). The only longer index
--    that leads with those columns is the ACTIVE-only partial unique index
--    (WHERE "isActive"), which cannot answer a history read or a foreign-key cascade that
--    includes inactive rows. Dropping them would turn those into table scans.
DROP INDEX IF EXISTS "trait_history_logs_horseId_idx";
DROP INDEX IF EXISTS "milestone_trait_logs_horseId_idx";
DROP INDEX IF EXISTS "ultra_rare_trait_events_horseId_idx";
DROP INDEX IF EXISTS "groom_horse_synergies_groomId_idx";
DROP INDEX IF EXISTS "groom_assignment_logs_groomId_idx";
DROP INDEX IF EXISTS "groom_talent_selections_groomId_idx";
DROP INDEX IF EXISTS "groom_metrics_groomId_idx";
DROP INDEX IF EXISTS "show_entries_showId_idx";
DROP INDEX IF EXISTS "staff_marketplace_state_userId_idx";
