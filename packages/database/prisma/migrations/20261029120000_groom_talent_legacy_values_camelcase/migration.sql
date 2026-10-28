-- Owner ruling 2026-10-21 (Stacey): Equoria names are camelCase, stored game
-- values included.
--
-- Groom talent ids and legacy perk ids (gentle_hands, empathic_sync,
-- patience_mastery, ...) -> gentleHands, empathicSync, patienceMastery, in:
--   groom_talent_selections."tier1", "tier2", "tier3"
--   groom_legacy_logs."inheritedPerk"
--   grooms."bonusTraitMap"->'legacyPerk' (written for a legacy protégé)
-- The authored names players see (Gentle Hands, ...) are unchanged.
--
-- Only the 15 ids the game defines are mapped. Idempotent: a second run
-- matches no row. The closing check aborts the whole migration if any of
-- these columns still holds a value with an underscore.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.groom_talent_camel(v TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT CASE v
    WHEN 'gentle_hands' THEN 'gentleHands'
    WHEN 'patience_virtue' THEN 'patienceVirtue'
    WHEN 'patience_mastery' THEN 'patienceMastery'
    WHEN 'empathic_sync' THEN 'empathicSync'
    WHEN 'master_bonding' THEN 'masterBonding'
    WHEN 'playtime_pro' THEN 'playtimePro'
    WHEN 'enthusiasm_boost' THEN 'enthusiasmBoost'
    WHEN 'fear_buster' THEN 'fearBuster'
    WHEN 'energy_channeling' THEN 'energyChanneling'
    WHEN 'inspiration_master' THEN 'inspirationMaster'
    WHEN 'data_driven' THEN 'dataDriven'
    WHEN 'systematic_approach' THEN 'systematicApproach'
    WHEN 'memory_builder' THEN 'memoryBuilder'
    WHEN 'precision_training' THEN 'precisionTraining'
    WHEN 'analytical_mastery' THEN 'analyticalMastery'
    ELSE v
  END
$fn$;

UPDATE "groom_talent_selections"
SET "tier1" = pg_temp.groom_talent_camel("tier1"),
    "tier2" = pg_temp.groom_talent_camel("tier2"),
    "tier3" = pg_temp.groom_talent_camel("tier3")
WHERE "tier1" IS DISTINCT FROM pg_temp.groom_talent_camel("tier1")
   OR "tier2" IS DISTINCT FROM pg_temp.groom_talent_camel("tier2")
   OR "tier3" IS DISTINCT FROM pg_temp.groom_talent_camel("tier3");

UPDATE "groom_legacy_logs"
SET "inheritedPerk" = pg_temp.groom_talent_camel("inheritedPerk")
WHERE "inheritedPerk" <> pg_temp.groom_talent_camel("inheritedPerk");

UPDATE "grooms"
SET "bonusTraitMap" = jsonb_set(
  "bonusTraitMap", '{legacyPerk}',
  to_jsonb(pg_temp.groom_talent_camel("bonusTraitMap"->>'legacyPerk')))
WHERE jsonb_typeof("bonusTraitMap") = 'object'
  AND jsonb_typeof("bonusTraitMap"->'legacyPerk') = 'string'
  AND "bonusTraitMap"->>'legacyPerk' <> pg_temp.groom_talent_camel("bonusTraitMap"->>'legacyPerk');

DO $$
DECLARE
  leftover INTEGER;
BEGIN
  SELECT
    (SELECT COUNT(*) FROM "groom_talent_selections"
     WHERE "tier1" LIKE '%\_%' OR "tier2" LIKE '%\_%' OR "tier3" LIKE '%\_%')
    + (SELECT COUNT(*) FROM "groom_legacy_logs" WHERE "inheritedPerk" LIKE '%\_%')
    + (SELECT COUNT(*) FROM "grooms"
       WHERE jsonb_typeof("bonusTraitMap") = 'object'
         AND jsonb_typeof("bonusTraitMap"->'legacyPerk') = 'string'
         AND "bonusTraitMap"->>'legacyPerk' LIKE '%\_%')
  INTO leftover;
  IF leftover > 0 THEN
    RAISE EXCEPTION 'groom_talent_legacy_values_camelcase: % row(s) still hold a snake_case talent or perk id; aborting', leftover;
  END IF;
END $$;

COMMIT;
