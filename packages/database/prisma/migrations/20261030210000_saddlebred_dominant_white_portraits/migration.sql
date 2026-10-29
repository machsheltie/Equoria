-- Owner added Dominant White Saddlebred portraits 2026-10-29 (Equoria-de7ts).
-- Data only; no schema change.
--
-- An existing Dominant White Saddlebred with no picture chosen gets one of the
-- two portraits (dominantwhite1/2.webp), picked at random once, in
-- horses."imageUrl". New horses roll it at creation
-- (backend/modules/horses/data/coatImages.mjs).
--
-- Idempotent: a horse that already has a picture is never touched.

BEGIN;

UPDATE "horses" AS h
SET "imageUrl" = '/images/breeds/american_saddlebred/dominantwhite'
  || (1 + floor(random() * 2))::int || '.webp'
FROM "breeds" AS b
WHERE h."breedId" = b.id
  AND b."name" = 'American Saddlebred'
  AND (h."imageUrl" IS NULL OR h."imageUrl" IN ('/images/samplehorse.JPG', '/images/samplehorse.jpg'))
  AND jsonb_typeof(h."phenotype") = 'object'
  AND h."phenotype"->>'colorName' = 'Dominant White';

COMMIT;
