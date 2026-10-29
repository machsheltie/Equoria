-- Owner rulings 2026-10-29 (Equoria-de7ts), American Saddlebred. Data only;
-- no schema change.
--
-- 1. q296: every Saddlebred color rolls all its shades equally. Bay, Chestnut,
--    Palomino and Seal Brown already did (20261029100000); Buckskin, the three
--    Champagnes and the three Cream Champagnes move from 0.3/0.4/0.3 to 0.333
--    each. The same values are in backend/data/breeds/American Saddlebred.txt.
--    Existing horses keep the shade they have: only the breed profile changes.
-- 2. The owner added portraits for Amber, Classic and Gold Cream Champagne and
--    Ivory Champagne (two each, any shade). An existing Saddlebred of one of
--    those colors with no picture chosen gets one of its two, picked at random
--    once, in horses."imageUrl". New horses roll it at creation
--    (backend/modules/horses/data/coatImages.mjs).
--
-- Idempotent: the profile write sets the same values again, and a horse that
-- already has a picture is never touched.

BEGIN;

UPDATE "breeds"
SET "breedGeneticProfile" =
  jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(
    "breedGeneticProfile",
    '{shadeBias,Buckskin}', '{"cream": 0.333, "golden": 0.333, "burnished": 0.333}'::jsonb),
    '{shadeBias,"Gold Champagne"}', '{"pale": 0.333, "golden": 0.333, "dark": 0.333}'::jsonb),
    '{shadeBias,"Amber Champagne"}', '{"light": 0.333, "medium": 0.333, "deep": 0.333}'::jsonb),
    '{shadeBias,"Classic Champagne"}', '{"faded": 0.333, "standard": 0.333, "rich": 0.333}'::jsonb),
    '{shadeBias,"Gold Cream Champagne"}', '{"pale": 0.333, "golden": 0.333, "burnished": 0.333}'::jsonb),
    '{shadeBias,"Amber Cream Champagne"}', '{"light": 0.333, "rich": 0.333, "dark": 0.333}'::jsonb),
    '{shadeBias,"Classic Cream Champagne"}', '{"light": 0.333, "silver": 0.333, "charcoal": 0.333}'::jsonb)
WHERE "name" = 'American Saddlebred'
  AND jsonb_typeof("breedGeneticProfile") = 'object'
  AND jsonb_typeof("breedGeneticProfile"->'shadeBias') = 'object';

WITH portraits(color_name, image_name) AS (
  VALUES
    ('Amber Cream Champagne', 'ambercreamchampagne'),
    ('Classic Cream Champagne', 'classiccreamchampagne'),
    ('Gold Cream Champagne', 'goldcreamchampagne'),
    ('Ivory Champagne', 'ivorychampagne')
)
UPDATE "horses" AS h
SET "imageUrl" = '/images/breeds/american_saddlebred/' || p.image_name
  || (1 + floor(random() * 2))::int || '.webp'
FROM "breeds" AS b, portraits AS p
WHERE h."breedId" = b.id
  AND b."name" = 'American Saddlebred'
  AND (h."imageUrl" IS NULL OR h."imageUrl" IN ('/images/samplehorse.JPG', '/images/samplehorse.jpg'))
  AND jsonb_typeof(h."phenotype") = 'object'
  AND p.color_name = h."phenotype"->>'colorName';

COMMIT;
