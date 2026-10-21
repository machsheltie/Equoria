-- Owner rulings 2026-10-21 (Pleasure Driving discipline work). Data only; no
-- schema change.
--
-- 1. All-purpose tack is +2 in every discipline (was +5).
--    resolveTackBonus (economy/tackShop/services/tackInventory.mjs) returns a
--    horse's stored tack.saddleBonus / tack.bridleBonus before it looks at the
--    item catalog, so changing the catalog alone would leave every horse already
--    wearing all-purpose tack at +5. This sets the stored mirror to 2 for those
--    horses, and the "+5 all disciplines" label on all-purpose items already in
--    players' inventories to "+2 all disciplines".
--    Ids: all-purpose-saddle and its legacy alias basic-all-purpose-saddle;
--    all-purpose-bridle and its legacy alias standard-bridle.
--
-- 2. The game's discipline name is "Cross Country". "Cross-Country" was a
--    misspelling in the rider/trainer specialty list and the dev seed, so
--    stored rows carrying it are renamed.
--
-- Idempotent: every UPDATE is filtered to rows still holding the old value, so
-- a second run matches nothing.

BEGIN;

UPDATE "horses"
SET "tack" = jsonb_set("tack", '{saddleBonus}', '2'::jsonb)
WHERE jsonb_typeof("tack") = 'object'
  AND "tack" ->> 'saddle' IN ('all-purpose-saddle', 'basic-all-purpose-saddle')
  AND "tack" -> 'saddleBonus' = '5'::jsonb;

UPDATE "horses"
SET "tack" = jsonb_set("tack", '{bridleBonus}', '2'::jsonb)
WHERE jsonb_typeof("tack") = 'object'
  AND "tack" ->> 'bridle' IN ('all-purpose-bridle', 'standard-bridle')
  AND "tack" -> 'bridleBonus' = '5'::jsonb;

UPDATE "User"
SET "settings" = jsonb_set(
  "settings",
  '{inventory}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN item ->> 'itemId' IN (
          'all-purpose-saddle', 'basic-all-purpose-saddle', 'all-purpose-bridle', 'standard-bridle'
        ) AND item ->> 'bonus' = '+5 all disciplines'
        THEN jsonb_set(item, '{bonus}', '"+2 all disciplines"'::jsonb)
        ELSE item
      END
      ORDER BY position
    )
    FROM jsonb_array_elements("settings" -> 'inventory') WITH ORDINALITY AS entries(item, position)
  )
)
WHERE jsonb_typeof("settings" -> 'inventory') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements("settings" -> 'inventory') AS entries(item)
    WHERE item ->> 'itemId' IN (
      'all-purpose-saddle', 'basic-all-purpose-saddle', 'all-purpose-bridle', 'standard-bridle'
    ) AND item ->> 'bonus' = '+5 all disciplines'
  );

UPDATE "riders" SET "speciality" = 'Cross Country' WHERE "speciality" = 'Cross-Country';
UPDATE "trainers" SET "speciality" = 'Cross Country' WHERE "speciality" = 'Cross-Country';
UPDATE "shows" SET "discipline" = 'Cross Country' WHERE "discipline" = 'Cross-Country';
UPDATE "competition_results" SET "discipline" = 'Cross Country' WHERE "discipline" = 'Cross-Country';
UPDATE "training_logs" SET "discipline" = 'Cross Country' WHERE "discipline" = 'Cross-Country';

COMMIT;
