-- Dead columns and one dead table, dropped in one migration.
--   Equoria-ry8lk  horses."pendingFoalBreedId" (owner ruling 2026-10-21, Q17). Nobody
--                  chooses a foal's breed (Equoria-5nwwf, ruling 2026-10-20): the foal is
--                  its parents' breed, so the column was only ever cleared.
--   Equoria-efs4j  horses."temporaryEpigeneticFlags". No code has written it since
--                  Equoria-kqdde and nothing reads it. (horses."epigeneticFlags" is NOT
--                  dropped here: several live readers remain.)
--   Equoria-qfho0  horses."ultraRareTraits", grooms."rareTraitPerks" and the
--                  ultra_rare_trait_events table (owner q148 2026-10-28: the rarity words
--                  are Common/Uncommon/Rare/Ultra Rare/Legendary only, no "exotic"). No
--                  production code reads or writes any of them.
--
-- NOT backward compatible with the previous application release: its generated Prisma
-- client lists these columns, so a bare horse/groom read from an old instance would fail
-- once they are gone. Deploy the new release and this migration together.
--
-- No data is copied. The 2026-10-27 trait roster migration already emptied every
-- horse's ultraRareTraits; the other stores hold nothing the game uses. The counts are
-- logged so the migration output shows what went.

DO $$
DECLARE
  pendingBreedRows integer;
  temporaryFlagRows integer;
  ultraRareRows integer;
  perkRows integer;
  eventRows integer;
BEGIN
  SELECT count(*) INTO pendingBreedRows FROM "horses" WHERE "pendingFoalBreedId" IS NOT NULL;
  SELECT count(*) INTO temporaryFlagRows FROM "horses"
   WHERE "temporaryEpigeneticFlags" IS NOT NULL AND "temporaryEpigeneticFlags" <> '[]'::jsonb;
  SELECT count(*) INTO ultraRareRows FROM "horses"
   WHERE "ultraRareTraits" IS NOT NULL
     AND "ultraRareTraits" <> '{"ultraRare": [], "exotic": []}'::jsonb;
  SELECT count(*) INTO perkRows FROM "grooms"
   WHERE "rareTraitPerks" IS NOT NULL AND "rareTraitPerks" <> '{}'::jsonb;
  SELECT count(*) INTO eventRows FROM "ultra_rare_trait_events";
  RAISE NOTICE 'dropping horses.pendingFoalBreedId (% set), horses.temporaryEpigeneticFlags (% non-empty), horses.ultraRareTraits (% non-empty), grooms.rareTraitPerks (% non-empty), ultra_rare_trait_events (% rows)',
    pendingBreedRows, temporaryFlagRows, ultraRareRows, perkRows, eventRows;
END
$$;

DROP TABLE IF EXISTS "ultra_rare_trait_events";

ALTER TABLE "horses" DROP COLUMN IF EXISTS "pendingFoalBreedId";
ALTER TABLE "horses" DROP COLUMN IF EXISTS "temporaryEpigeneticFlags";
ALTER TABLE "horses" DROP COLUMN IF EXISTS "ultraRareTraits";
ALTER TABLE "grooms" DROP COLUMN IF EXISTS "rareTraitPerks";
