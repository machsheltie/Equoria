-- Owner rulings 2026-10-28 (Equoria-de7ts), American Saddlebred. Data only; no
-- schema change.
--
-- 1. Coat genetics in breeds."breedGeneticProfile" (the same values are in
--    backend/data/breeds/American Saddlebred.txt):
--    - Dun does not exist in the breed: D_Dun allows only nd2/nd2 (weight 1.0).
--    - The seal agouti allele At, so about 7% of Saddlebreds are seal-based.
--    - Shades: Bay gains blood, copper, wild; Chestnut gains golden; Palomino
--      gains chocolate; Seal Brown has dark, light, sealskin. Every shade of a
--      color is equally likely until the owner picks weights (q270).
--    - "shadeSelection": "rolled": a new Saddlebred's shade is rolled by those
--      weights. (Other breeds keep the genotype-hash shade, which follows the
--      breed's few common genotypes rather than the weights.)
-- 2. Each existing Saddlebred with no picture chosen gets one portrait variant
--    of its coat (colorName + shade), picked at random once, in horses."imageUrl".
--    The color-to-portrait table is backend/modules/horses/data/coatImages.mjs
--    as of this migration (owner-approved mapping, q269). A coat with no
--    portrait keeps the column default, so the page shows the breed picture.
--
-- Idempotent: the profile writes set the same values again, and a horse that
-- already has a picture is never touched.

BEGIN;

UPDATE "breeds"
SET "breedGeneticProfile" =
  jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(
    "breedGeneticProfile",
    '{shadeSelection}', '"rolled"'::jsonb),
    '{allowedAlleles,A_Agouti}', '["a/a", "A/a", "A/A", "A/At", "At/At", "At/a"]'::jsonb),
    '{allowedAlleles,D_Dun}', '["nd2/nd2"]'::jsonb),
    '{alleleWeights,A_Agouti}', '{"a/a": 0.268, "A/a": 0.370, "A/A": 0.220, "A/At": 0.036, "At/At": 0.010, "At/a": 0.096}'::jsonb),
    '{alleleWeights,D_Dun}', '{"nd2/nd2": 1.0}'::jsonb),
    '{shadeBias,Chestnut}', '{"light": 0.25, "medium": 0.25, "dark": 0.25, "golden": 0.25}'::jsonb),
    '{shadeBias,Bay}', '{"light": 0.167, "standard": 0.167, "dark": 0.167, "blood": 0.167, "copper": 0.167, "wild": 0.167}'::jsonb),
    '{shadeBias,"Seal Brown"}', '{"dark": 0.333, "light": 0.333, "sealskin": 0.333}'::jsonb),
    '{shadeBias,Palomino}', '{"pale": 0.25, "golden": 0.25, "copper": 0.25, "chocolate": 0.25}'::jsonb)
WHERE "name" = 'American Saddlebred'
  AND jsonb_typeof("breedGeneticProfile") = 'object'
  AND jsonb_typeof("breedGeneticProfile"->'allowedAlleles') = 'object'
  AND jsonb_typeof("breedGeneticProfile"->'alleleWeights') = 'object'
  AND jsonb_typeof("breedGeneticProfile"->'shadeBias') = 'object';

-- shade NULL: every shade of that color uses the same portraits.
WITH portraits(color_name, shade, files) AS (
  VALUES
    ('Bay', 'standard', ARRAY['standardbay1.png', 'standardbay2.png']),
    ('Bay', 'dark', ARRAY['mahoganybay1.png', 'mahoganybay2.png']),
    ('Bay', 'light', ARRAY['goldenbay1.png', 'goldenbay2.png']),
    ('Bay', 'blood', ARRAY['bloodbay1.png', 'bloodbay2.png']),
    ('Bay', 'copper', ARRAY['copperbay1.png', 'copperbay2.png']),
    ('Bay', 'wild', ARRAY['wildbay1.png', 'wildbay2.png']),
    ('Chestnut', 'medium', ARRAY['redchestnut1.png', 'redchestnut2.png']),
    ('Chestnut', 'dark', ARRAY['darkchestnut1.png', 'darkchestnut2.png', 'liverchestnut1.png', 'liverchestnut2.png']),
    ('Chestnut', 'light', ARRAY['lightchestnut1.png', 'lightchestnut2.png']),
    ('Chestnut', 'golden', ARRAY['goldenchestnut1.png', 'goldenchestnut2.png']),
    ('Black', 'standard', ARRAY['nonfadingblack1.png', 'nonfadingblack2.png']),
    ('Black', 'faded', ARRAY['fadingblack1.png', 'fadingblack2.png']),
    ('Smoky Black', NULL, ARRAY['smokyblack1.jpg', 'smokyblack2.png']),
    ('Buckskin', 'golden', ARRAY['goldenbuckskin1.png', 'goldenbuckskin2.png']),
    ('Buckskin', 'burnished', ARRAY['classicbuckskin1.jpg', 'classicbuckskin2.png']),
    ('Buckskin', 'cream', ARRAY['buttermilkbuckskin1.png', 'buttermilkbuckskin2.png']),
    ('Palomino', 'golden', ARRAY['goldenpalomino1.png', 'goldenpalomino2.png']),
    ('Palomino', 'pale', ARRAY['lightpalomino1.png', 'lightpalomino2.png']),
    ('Palomino', 'copper', ARRAY['darkpalomino1.png', 'darkpalomino2.png']),
    ('Palomino', 'chocolate', ARRAY['chocolatepalomino1.png', 'chocolatepalomino2.png']),
    ('Cremello', NULL, ARRAY['cremello1.png', 'cremello2.png']),
    ('Perlino', NULL, ARRAY['perlino1.png', 'perlino2.png']),
    ('Smoky Cream', NULL, ARRAY['smokycream1.png', 'smokycream2.png']),
    ('Seal Perlino', NULL, ARRAY['sealperlino1.png', 'sealperlino2.png']),
    ('Seal Brown', 'dark', ARRAY['darksealbrown1.png', 'darksealbrown2.png']),
    ('Seal Brown', 'light', ARRAY['lightsealbrown1.png', 'lightsealbrown2.png']),
    ('Seal Brown', 'sealskin', ARRAY['sealskin1.png', 'sealskin2.png']),
    ('Gold Champagne', NULL, ARRAY['goldchampagne1.png', 'goldchampagne2.png']),
    ('Classic Champagne', NULL, ARRAY['classsicchampagne1.png', 'classsicchampagne2.png']),
    ('Amber Champagne', NULL, ARRAY['sablechampagne1.png', 'sablechampagne2.png']),
    ('Sable Champagne', NULL, ARRAY['sablechampagne1.png', 'sablechampagne2.png']),
    ('Gray', NULL, ARRAY['dapplegrey1.png', 'dapplegrey2.png']),
    ('Steel Dark Dapple Gray', NULL, ARRAY['dapplegrey1.png', 'dapplegrey2.png']),
    ('Steel Light Dapple Gray', NULL, ARRAY['lightdapplegrey1.png', 'lightdapplegrey2.png']),
    ('Steel Gray', NULL, ARRAY['steelgrey1.png', 'steelgrey2.png']),
    ('Rose Gray', NULL, ARRAY['rosegrey1.png', 'rosegrey2.jpg', 'rosegrey2.png', 'rosegrey3.jpeg', 'rosegrey4.jpeg']),
    ('Rose Dark Dapple Gray', NULL, ARRAY['rosegrey1.png', 'rosegrey2.jpg', 'rosegrey2.png', 'rosegrey3.jpeg', 'rosegrey4.jpeg']),
    ('Rose Light Dapple Gray', NULL, ARRAY['rosegrey1.png', 'rosegrey2.jpg', 'rosegrey2.png', 'rosegrey3.jpeg', 'rosegrey4.jpeg']),
    ('White Gray', NULL, ARRAY['whitegrey1.png', 'whitegrey2.png']),
    ('Fleabitten Gray', NULL, ARRAY['fleabittengrey1.jpg', 'fleabittengrey2.jpg'])
)
UPDATE "horses" AS h
SET "imageUrl" = '/images/breeds/american_saddlebred/'
  || p.files[1 + floor(random() * array_length(p.files, 1))::int]
FROM "breeds" AS b, portraits AS p
WHERE h."breedId" = b.id
  AND b."name" = 'American Saddlebred'
  AND (h."imageUrl" IS NULL OR h."imageUrl" IN ('/images/samplehorse.JPG', '/images/samplehorse.jpg'))
  AND jsonb_typeof(h."phenotype") = 'object'
  AND p.color_name = h."phenotype"->>'colorName'
  AND (p.shade IS NULL OR p.shade = COALESCE(h."phenotype"->>'shade', 'standard'));

COMMIT;
