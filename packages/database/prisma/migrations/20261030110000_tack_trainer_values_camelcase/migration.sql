-- Owner ruling 2026-10-21 (Stacey): Equoria names are camelCase, stored game
-- values included.
--
-- Tack categories saddle_pad, leg_wraps -> saddlePad, legWraps in:
--   horses."tack": the slot keys (the value, an item id, is kept). A horse that
--     already holds the camelCase key keeps both and the closing check aborts.
--   "User"."settings"->'inventory': each record's "category" (every other key
--     of the record and of settings is kept).
--   user_transactions."metadata": "category" and "itemCategory" (tack purchase
--     rows; every other key kept).
-- Trainer discovery slot categories discipline_specialization, training_method,
-- horse_compatibility -> disciplineSpecialization, trainingMethod,
-- horseCompatibility in trainers."discovery_slots"[*]."category" (every other
-- key of a slot kept, slot order kept).
--
-- Only these five exact values change; any other value is left as stored.
-- Idempotent: a second run matches no row. The closing check aborts the whole
-- migration if any of the five old spellings survives.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.camel_value(v TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT CASE v
    WHEN 'saddle_pad' THEN 'saddlePad'
    WHEN 'leg_wraps' THEN 'legWraps'
    WHEN 'discipline_specialization' THEN 'disciplineSpecialization'
    WHEN 'training_method' THEN 'trainingMethod'
    WHEN 'horse_compatibility' THEN 'horseCompatibility'
    ELSE v
  END
$fn$;

-- A JSON array of objects with each object's "category" converted; other
-- elements and keys kept in place.
CREATE OR REPLACE FUNCTION pg_temp.camel_category_array(arr JSONB) RETURNS JSONB
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT COALESCE(jsonb_agg(
    CASE
      WHEN jsonb_typeof(e.x) = 'object' AND jsonb_typeof(e.x -> 'category') = 'string'
        THEN jsonb_set(e.x, '{category}', to_jsonb(pg_temp.camel_value(e.x ->> 'category')))
      ELSE e.x
    END ORDER BY e.o), '[]'::jsonb)
  FROM jsonb_array_elements(arr) WITH ORDINALITY AS e(x, o)
$fn$;

UPDATE "horses"
SET "tack" = (
  SELECT jsonb_object_agg(pg_temp.camel_value(j.k), j.val)
  FROM jsonb_each("tack") j(k, val))
WHERE jsonb_typeof("tack") = 'object'
  AND ("tack" ?| ARRAY['saddle_pad', 'leg_wraps'])
  AND NOT ("tack" ?& ARRAY['saddle_pad', 'saddlePad'])
  AND NOT ("tack" ?& ARRAY['leg_wraps', 'legWraps']);

UPDATE "User"
SET "settings" = jsonb_set("settings", '{inventory}',
  pg_temp.camel_category_array("settings" -> 'inventory'))
WHERE jsonb_typeof("settings" -> 'inventory') = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements("settings" -> 'inventory') e(x)
    WHERE jsonb_typeof(e.x) = 'object' AND e.x ->> 'category' IN ('saddle_pad', 'leg_wraps'));

UPDATE "user_transactions"
SET "metadata" = "metadata"
  || CASE WHEN "metadata" ->> 'category' IN ('saddle_pad', 'leg_wraps')
       THEN jsonb_build_object('category', pg_temp.camel_value("metadata" ->> 'category'))
       ELSE '{}'::jsonb END
  || CASE WHEN "metadata" ->> 'itemCategory' IN ('saddle_pad', 'leg_wraps')
       THEN jsonb_build_object('itemCategory', pg_temp.camel_value("metadata" ->> 'itemCategory'))
       ELSE '{}'::jsonb END
WHERE jsonb_typeof("metadata") = 'object'
  AND ("metadata" ->> 'category' IN ('saddle_pad', 'leg_wraps')
    OR "metadata" ->> 'itemCategory' IN ('saddle_pad', 'leg_wraps'));

UPDATE "trainers"
SET "discovery_slots" = pg_temp.camel_category_array("discovery_slots")
WHERE jsonb_typeof("discovery_slots") = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements("discovery_slots") e(x)
    WHERE jsonb_typeof(e.x) = 'object'
      AND e.x ->> 'category' IN ('discipline_specialization', 'training_method', 'horse_compatibility'));

DO $$
DECLARE
  leftover INTEGER;
BEGIN
  SELECT
    (SELECT COUNT(*) FROM "horses"
     WHERE jsonb_typeof("tack") = 'object' AND "tack" ?| ARRAY['saddle_pad', 'leg_wraps'])
    + (SELECT COUNT(*) FROM "User"
       WHERE jsonb_typeof("settings" -> 'inventory') = 'array' AND EXISTS (
         SELECT 1 FROM jsonb_array_elements("settings" -> 'inventory') e(x)
         WHERE jsonb_typeof(e.x) = 'object' AND e.x ->> 'category' IN ('saddle_pad', 'leg_wraps')))
    + (SELECT COUNT(*) FROM "user_transactions"
       WHERE jsonb_typeof("metadata") = 'object'
         AND ("metadata" ->> 'category' IN ('saddle_pad', 'leg_wraps')
           OR "metadata" ->> 'itemCategory' IN ('saddle_pad', 'leg_wraps')))
    + (SELECT COUNT(*) FROM "trainers"
       WHERE jsonb_typeof("discovery_slots") = 'array' AND EXISTS (
         SELECT 1 FROM jsonb_array_elements("discovery_slots") e(x)
         WHERE jsonb_typeof(e.x) = 'object'
           AND e.x ->> 'category' IN ('discipline_specialization', 'training_method', 'horse_compatibility')))
  INTO leftover;
  IF leftover > 0 THEN
    RAISE EXCEPTION 'tack_trainer_values_camelcase: % row(s) still hold a snake_case tack or discovery category; aborting', leftover;
  END IF;
END $$;

COMMIT;
