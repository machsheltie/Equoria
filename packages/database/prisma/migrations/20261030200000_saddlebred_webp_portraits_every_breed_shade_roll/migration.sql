-- Owner rulings 2026-10-29 (Equoria-de7ts). Data only; no schema change.
--
-- 1. q277: every breed rolls a new horse's shade by its stated odds, so the
--    Saddlebred-only "shadeSelection" profile switch (added by
--    20261029100000_saddlebred_coat_colors_and_portraits) is gone. The breed
--    seed file no longer carries it either.
-- 2. q275: the game uses ~1024px WebP copies of the owner's portraits; her
--    PNG/JPG originals stay out of the repository. A Saddlebred portrait stored
--    by the earlier migration is moved to its WebP copy. The two originals
--    named rosegrey2 (.jpg and .png) became rosegrey2.webp and rosegrey5.webp
--    (q276: all five rose grey portraits are used).
-- 3. q276: Amber Champagne has its own portraits (amberchampagne1/2); an Amber
--    Champagne Saddlebred that was given a sablechampagne portrait gets one of
--    them, picked at random once. Sable Champagne (seal brown + champagne)
--    keeps the sablechampagne portraits.
--
-- Idempotent: a second run finds no shadeSelection key, no .png/.jpg/.jpeg
-- Saddlebred portrait and no Amber Champagne horse with a sablechampagne one.

BEGIN;

UPDATE "breeds"
SET "breedGeneticProfile" = "breedGeneticProfile" - 'shadeSelection'
WHERE jsonb_typeof("breedGeneticProfile") = 'object'
  AND "breedGeneticProfile" ? 'shadeSelection';

UPDATE "horses"
SET "imageUrl" = '/images/breeds/american_saddlebred/rosegrey5.webp'
WHERE "imageUrl" = '/images/breeds/american_saddlebred/rosegrey2.png';

UPDATE "horses"
SET "imageUrl" = regexp_replace("imageUrl", '\.(png|jpg|jpeg)$', '.webp')
WHERE "imageUrl" ~ '^/images/breeds/american_saddlebred/[a-z]+[0-9]+\.(png|jpg|jpeg)$';

UPDATE "horses"
SET "imageUrl" = '/images/breeds/american_saddlebred/amberchampagne'
  || (1 + floor(random() * 2))::int || '.webp'
WHERE "imageUrl" ~ '^/images/breeds/american_saddlebred/sablechampagne[0-9]+\.webp$'
  AND jsonb_typeof("phenotype") = 'object'
  AND "phenotype"->>'colorName' = 'Amber Champagne';

COMMIT;
