-- Owner ruling 2026-10-21 (Stacey): the Playful temperament is renamed Driven
-- and Willing is added, making 12 temperaments. Data only; no schema change.
--
-- 1. Every horse whose temperament is 'Playful' becomes 'Driven' (the owner's
--    ruling: existing Playful horses become Driven).
-- 2. Every breed's birth odds ("breedGeneticProfile".temperament_weights) are
--    replaced with the 12-key weights the owner set by hand in
--    backend/data/breedProfiles.json (the same values as
--    backend/data/breeds/*.txt). The game reads breed odds from this column
--    first (breedProfileLoader), so without this the new odds would never apply.
--
-- Idempotent: step 1 matches nothing on a second run; step 2 sets the same
-- values again. A breed row without an object profile is left alone.

BEGIN;

UPDATE "horses"
SET "temperament" = 'Driven'
WHERE "temperament" = 'Playful';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 10, "Bold": 14, "Steady": 12, "Willing": 4, "Independent": 16, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Abaga' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 11, "Nervous": 6, "Calm": 11, "Bold": 14, "Steady": 12, "Willing": 4, "Independent": 16, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Abyssinian' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 10, "Bold": 14, "Steady": 12, "Willing": 5, "Independent": 16, "Reactive": 5, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Adaev' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 16, "Nervous": 5, "Calm": 12, "Bold": 12, "Steady": 14, "Willing": 12, "Independent": 6, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Aegidienberger' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 20, "Nervous": 8, "Calm": 6, "Bold": 14, "Steady": 8, "Willing": 6, "Independent": 8, "Reactive": 8, "Stubborn": 4, "Driven": 16, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Akhal-Teke' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 8, "Nervous": 3, "Calm": 18, "Bold": 12, "Steady": 16, "Willing": 14, "Independent": 8, "Reactive": 3, "Stubborn": 6, "Driven": 8, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Albanian' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 10, "Bold": 14, "Steady": 12, "Willing": 4, "Independent": 17, "Reactive": 6, "Stubborn": 7, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Altai' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 16, "Nervous": 5, "Calm": 10, "Bold": 15, "Steady": 14, "Willing": 10, "Independent": 5, "Reactive": 6, "Stubborn": 4, "Driven": 13, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Alter Real' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 6, "Nervous": 3, "Calm": 18, "Bold": 14, "Steady": 18, "Willing": 12, "Independent": 6, "Reactive": 4, "Stubborn": 4, "Driven": 12, "Lazy": 2, "Aggressive": 1}'::jsonb)
WHERE "name" = 'American Bashkir Curly' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 4, "Nervous": 2, "Calm": 22, "Bold": 10, "Steady": 22, "Willing": 15, "Independent": 4, "Reactive": 2, "Stubborn": 6, "Driven": 8, "Lazy": 4, "Aggressive": 1}'::jsonb)
WHERE "name" = 'American Belgian Draft' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 4, "Nervous": 2, "Calm": 23, "Bold": 10, "Steady": 21, "Willing": 15, "Independent": 4, "Reactive": 2, "Stubborn": 6, "Driven": 8, "Lazy": 4, "Aggressive": 1}'::jsonb)
WHERE "name" = 'American Cream Draft' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 8, "Nervous": 3, "Calm": 16, "Bold": 14, "Steady": 18, "Willing": 10, "Independent": 8, "Reactive": 4, "Stubborn": 4, "Driven": 12, "Lazy": 2, "Aggressive": 1}'::jsonb)
WHERE "name" = 'American Indian Horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 8, "Nervous": 3, "Calm": 16, "Bold": 15, "Steady": 17, "Willing": 12, "Independent": 6, "Reactive": 4, "Stubborn": 4, "Driven": 12, "Lazy": 2, "Aggressive": 1}'::jsonb)
WHERE "name" = 'American Paint Horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 6, "Nervous": 3, "Calm": 16, "Bold": 14, "Steady": 18, "Willing": 12, "Independent": 6, "Reactive": 4, "Stubborn": 4, "Driven": 14, "Lazy": 2, "Aggressive": 1}'::jsonb)
WHERE "name" = 'American Quarter Horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 18, "Nervous": 5, "Calm": 10, "Bold": 12, "Steady": 14, "Willing": 12, "Independent": 6, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'American Saddlebred' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 14, "Nervous": 4, "Calm": 12, "Bold": 15, "Steady": 15, "Willing": 12, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'American Warmblood' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 16, "Nervous": 5, "Calm": 12, "Bold": 15, "Steady": 14, "Willing": 10, "Independent": 5, "Reactive": 6, "Stubborn": 4, "Driven": 11, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Andalusian' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 14, "Nervous": 4, "Calm": 12, "Bold": 15, "Steady": 15, "Willing": 11, "Independent": 6, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Andravida' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 20, "Nervous": 8, "Calm": 6, "Bold": 14, "Steady": 8, "Willing": 10, "Independent": 6, "Reactive": 6, "Stubborn": 4, "Driven": 16, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Anglo-Arabian' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 15, "Nervous": 4, "Calm": 11, "Bold": 15, "Steady": 15, "Willing": 12, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Anglo-Kabarda' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 8, "Nervous": 3, "Calm": 16, "Bold": 14, "Steady": 18, "Willing": 11, "Independent": 6, "Reactive": 4, "Stubborn": 5, "Driven": 12, "Lazy": 2, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Appaloosa' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 22, "Nervous": 6, "Calm": 6, "Bold": 14, "Steady": 8, "Willing": 8, "Independent": 6, "Reactive": 8, "Stubborn": 4, "Driven": 16, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Arabian' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 4, "Nervous": 2, "Calm": 20, "Bold": 10, "Steady": 22, "Willing": 15, "Independent": 4, "Reactive": 2, "Stubborn": 6, "Driven": 10, "Lazy": 4, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Ardennais' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 9, "Nervous": 3, "Calm": 17, "Bold": 12, "Steady": 16, "Willing": 14, "Independent": 8, "Reactive": 3, "Stubborn": 6, "Driven": 8, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Arenberg-Nordkirchen' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 10, "Nervous": 4, "Calm": 16, "Bold": 12, "Steady": 15, "Willing": 7, "Independent": 10, "Reactive": 4, "Stubborn": 10, "Driven": 6, "Lazy": 5, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Asturcón' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 6, "Nervous": 3, "Calm": 20, "Bold": 10, "Steady": 20, "Willing": 14, "Independent": 5, "Reactive": 3, "Stubborn": 5, "Driven": 10, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Australian Draught' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 8, "Nervous": 3, "Calm": 16, "Bold": 14, "Steady": 17, "Willing": 12, "Independent": 7, "Reactive": 4, "Stubborn": 4, "Driven": 12, "Lazy": 2, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Australian Stock Horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 14, "Nervous": 4, "Calm": 13, "Bold": 14, "Steady": 16, "Willing": 12, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 10, "Lazy": 2, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Austrian Warmblood' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 6, "Nervous": 3, "Calm": 21, "Bold": 10, "Steady": 20, "Willing": 14, "Independent": 5, "Reactive": 3, "Stubborn": 5, "Driven": 9, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Auvergne' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 4, "Nervous": 2, "Calm": 22, "Bold": 10, "Steady": 22, "Willing": 14, "Independent": 4, "Reactive": 2, "Stubborn": 7, "Driven": 8, "Lazy": 4, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Auxois' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 10, "Bold": 15, "Steady": 11, "Willing": 4, "Independent": 16, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Axios' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 10, "Bold": 14, "Steady": 12, "Willing": 5, "Independent": 16, "Reactive": 5, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Azerbaijan' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 9, "Nervous": 3, "Calm": 15, "Bold": 14, "Steady": 18, "Willing": 12, "Independent": 6, "Reactive": 4, "Stubborn": 4, "Driven": 12, "Lazy": 2, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Azteca' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 10, "Nervous": 4, "Calm": 16, "Bold": 12, "Steady": 15, "Willing": 7, "Independent": 11, "Reactive": 4, "Stubborn": 9, "Driven": 6, "Lazy": 5, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Baise horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 5, "Calm": 11, "Bold": 14, "Steady": 12, "Willing": 4, "Independent": 16, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Bale' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 10, "Bold": 14, "Steady": 12, "Willing": 2, "Independent": 18, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Balikun horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 13, "Nervous": 5, "Calm": 10, "Bold": 14, "Steady": 12, "Willing": 4, "Independent": 16, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Baluchi' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 10, "Bold": 14, "Steady": 12, "Willing": 3, "Independent": 17, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Banker horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 20, "Nervous": 8, "Calm": 6, "Bold": 14, "Steady": 8, "Willing": 6, "Independent": 8, "Reactive": 8, "Stubborn": 4, "Driven": 16, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Barb horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 10, "Nervous": 4, "Calm": 16, "Bold": 11, "Steady": 16, "Willing": 7, "Independent": 10, "Reactive": 4, "Stubborn": 10, "Driven": 6, "Lazy": 5, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Bardigiano' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 12, "Bold": 14, "Steady": 12, "Willing": 4, "Independent": 14, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Bashkir horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 8, "Nervous": 3, "Calm": 18, "Bold": 13, "Steady": 15, "Willing": 14, "Independent": 8, "Reactive": 3, "Stubborn": 6, "Driven": 8, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Basque Mountain Horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 15, "Nervous": 4, "Calm": 11, "Bold": 15, "Steady": 15, "Willing": 12, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Bavarian Warmblood' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 4, "Nervous": 2, "Calm": 22, "Bold": 10, "Steady": 22, "Willing": 16, "Independent": 4, "Reactive": 2, "Stubborn": 6, "Driven": 8, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Belgian Draft' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 13, "Nervous": 4, "Calm": 12, "Bold": 15, "Steady": 15, "Willing": 13, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Belgian Sport Horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 18, "Nervous": 8, "Calm": 8, "Bold": 14, "Steady": 8, "Willing": 8, "Independent": 6, "Reactive": 8, "Stubborn": 4, "Driven": 16, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Belgian Trotter' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 14, "Nervous": 4, "Calm": 11, "Bold": 15, "Steady": 15, "Willing": 12, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 13, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Belgian Warmblood' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 10, "Nervous": 4, "Calm": 16, "Bold": 12, "Steady": 15, "Willing": 6, "Independent": 10, "Reactive": 4, "Stubborn": 11, "Driven": 6, "Lazy": 5, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Bhutia Horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 4, "Nervous": 3, "Calm": 22, "Bold": 10, "Steady": 20, "Willing": 14, "Independent": 5, "Reactive": 3, "Stubborn": 5, "Driven": 10, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Black Forest Horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 8, "Nervous": 3, "Calm": 16, "Bold": 14, "Steady": 18, "Willing": 13, "Independent": 5, "Reactive": 4, "Stubborn": 4, "Driven": 12, "Lazy": 2, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Blazer horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 17, "Nervous": 5, "Calm": 11, "Bold": 12, "Steady": 14, "Willing": 12, "Independent": 6, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Boerperd' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 10, "Bold": 15, "Steady": 12, "Willing": 4, "Independent": 15, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Borana' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 10, "Nervous": 3, "Calm": 17, "Bold": 12, "Steady": 15, "Willing": 7, "Independent": 10, "Reactive": 4, "Stubborn": 10, "Driven": 6, "Lazy": 5, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Bosnian Mountain Horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 6, "Nervous": 3, "Calm": 20, "Bold": 10, "Steady": 19, "Willing": 14, "Independent": 5, "Reactive": 3, "Stubborn": 5, "Driven": 11, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Boulonnais' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 14, "Nervous": 3, "Calm": 12, "Bold": 15, "Steady": 15, "Willing": 13, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Brandenburger' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 16, "Nervous": 4, "Calm": 12, "Bold": 15, "Steady": 15, "Willing": 10, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Brazilian Sport Horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 6, "Nervous": 3, "Calm": 19, "Bold": 11, "Steady": 20, "Willing": 14, "Independent": 5, "Reactive": 3, "Stubborn": 5, "Driven": 10, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Breton horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 13, "Nervous": 4, "Calm": 12, "Bold": 16, "Steady": 15, "Willing": 12, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'British Warmblood' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 10, "Bold": 14, "Steady": 12, "Willing": 2, "Independent": 18, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Brumby' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 16, "Nervous": 5, "Calm": 10, "Bold": 15, "Steady": 14, "Willing": 9, "Independent": 5, "Reactive": 6, "Stubborn": 4, "Driven": 14, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Budyonny' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 6, "Nervous": 3, "Calm": 20, "Bold": 10, "Steady": 21, "Willing": 14, "Independent": 5, "Reactive": 3, "Stubborn": 5, "Driven": 9, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Burguete horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 10, "Nervous": 4, "Calm": 16, "Bold": 12, "Steady": 15, "Willing": 6, "Independent": 10, "Reactive": 4, "Stubborn": 11, "Driven": 6, "Lazy": 5, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Burmese Horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 14, "Nervous": 5, "Calm": 12, "Bold": 12, "Steady": 14, "Willing": 12, "Independent": 6, "Reactive": 5, "Stubborn": 4, "Driven": 14, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Canadian Pacer' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 5, "Nervous": 3, "Calm": 20, "Bold": 10, "Steady": 20, "Willing": 15, "Independent": 5, "Reactive": 3, "Stubborn": 5, "Driven": 10, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Canadian horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 16, "Nervous": 5, "Calm": 12, "Bold": 12, "Steady": 14, "Willing": 10, "Independent": 8, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Carolina Marsh Tacky' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 15, "Nervous": 5, "Calm": 11, "Bold": 15, "Steady": 14, "Willing": 10, "Independent": 5, "Reactive": 6, "Stubborn": 4, "Driven": 13, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Cartujano' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 9, "Nervous": 3, "Calm": 17, "Bold": 12, "Steady": 16, "Willing": 14, "Independent": 8, "Reactive": 3, "Stubborn": 6, "Driven": 8, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Caspian horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 11, "Bold": 14, "Steady": 12, "Willing": 4, "Independent": 16, "Reactive": 5, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Castillonnais' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 7, "Nervous": 3, "Calm": 20, "Bold": 10, "Steady": 20, "Willing": 13, "Independent": 5, "Reactive": 3, "Stubborn": 5, "Driven": 10, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Catria' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 5, "Calm": 10, "Bold": 14, "Steady": 12, "Willing": 4, "Independent": 16, "Reactive": 7, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Cerbat Mustang' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 10, "Bold": 15, "Steady": 11, "Willing": 4, "Independent": 16, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Chaidamu horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 15, "Nervous": 5, "Calm": 13, "Bold": 12, "Steady": 14, "Willing": 12, "Independent": 6, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Chakouyi' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 13, "Nervous": 6, "Calm": 9, "Bold": 14, "Steady": 12, "Willing": 4, "Independent": 16, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Chernomor horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 8, "Nervous": 3, "Calm": 16, "Bold": 14, "Steady": 18, "Willing": 11, "Independent": 7, "Reactive": 4, "Stubborn": 4, "Driven": 12, "Lazy": 2, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Chilean horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 9, "Bold": 14, "Steady": 12, "Willing": 4, "Independent": 17, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Chinese Mongolian' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 16, "Nervous": 5, "Calm": 12, "Bold": 12, "Steady": 14, "Willing": 11, "Independent": 7, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Choctaw horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 6, "Nervous": 3, "Calm": 20, "Bold": 10, "Steady": 20, "Willing": 15, "Independent": 5, "Reactive": 3, "Stubborn": 4, "Driven": 10, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Cleveland Bay' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 4, "Nervous": 2, "Calm": 22, "Bold": 10, "Steady": 22, "Willing": 16, "Independent": 4, "Reactive": 2, "Stubborn": 6, "Driven": 8, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Clydesdale' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 18, "Nervous": 8, "Calm": 8, "Bold": 14, "Steady": 8, "Willing": 8, "Independent": 6, "Reactive": 8, "Stubborn": 4, "Driven": 16, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Coldblood Trotter' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 7, "Nervous": 3, "Calm": 16, "Bold": 15, "Steady": 18, "Willing": 12, "Independent": 6, "Reactive": 4, "Stubborn": 4, "Driven": 12, "Lazy": 2, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Colorado Ranger' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 5, "Nervous": 2, "Calm": 21, "Bold": 10, "Steady": 22, "Willing": 15, "Independent": 4, "Reactive": 2, "Stubborn": 6, "Driven": 8, "Lazy": 4, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Comtois horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 10, "Nervous": 4, "Calm": 16, "Bold": 12, "Steady": 15, "Willing": 6, "Independent": 11, "Reactive": 4, "Stubborn": 10, "Driven": 6, "Lazy": 5, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Corsican horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 16, "Nervous": 5, "Calm": 12, "Bold": 12, "Steady": 14, "Willing": 13, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Costa Rican Saddle Horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 10, "Nervous": 6, "Calm": 10, "Bold": 14, "Steady": 14, "Willing": 4, "Independent": 16, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Criollo' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 4, "Nervous": 2, "Calm": 22, "Bold": 10, "Steady": 22, "Willing": 14, "Independent": 4, "Reactive": 2, "Stubborn": 6, "Driven": 9, "Lazy": 4, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Croatian Coldblood' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 16, "Nervous": 5, "Calm": 12, "Bold": 11, "Steady": 15, "Willing": 12, "Independent": 6, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Cuban Criollo' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 10, "Bold": 14, "Steady": 12, "Willing": 2, "Independent": 18, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Cumberland Island' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 14, "Nervous": 3, "Calm": 13, "Bold": 15, "Steady": 15, "Willing": 12, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Czech Warmblood' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 13, "Nervous": 4, "Calm": 12, "Bold": 15, "Steady": 15, "Willing": 13, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Danish Warmblood' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 9, "Bold": 14, "Steady": 12, "Willing": 4, "Independent": 16, "Reactive": 7, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Danube Delta' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 16, "Nervous": 6, "Calm": 10, "Bold": 15, "Steady": 14, "Willing": 10, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 13, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Dareshuri' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 17, "Nervous": 5, "Calm": 11, "Bold": 12, "Steady": 14, "Willing": 12, "Independent": 6, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Datong horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 6, "Nervous": 3, "Calm": 20, "Bold": 10, "Steady": 20, "Willing": 13, "Independent": 5, "Reactive": 3, "Stubborn": 5, "Driven": 11, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Dolehest' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 20, "Nervous": 8, "Calm": 6, "Bold": 14, "Steady": 8, "Willing": 7, "Independent": 7, "Reactive": 8, "Stubborn": 4, "Driven": 16, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Dongola horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 3, "Nervous": 2, "Calm": 22, "Bold": 10, "Steady": 22, "Willing": 16, "Independent": 4, "Reactive": 2, "Stubborn": 6, "Driven": 8, "Lazy": 4, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Dutch Draft' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 18, "Nervous": 5, "Calm": 10, "Bold": 15, "Steady": 14, "Willing": 8, "Independent": 5, "Reactive": 6, "Stubborn": 4, "Driven": 13, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Dutch Harness' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 13, "Nervous": 4, "Calm": 12, "Bold": 15, "Steady": 15, "Willing": 12, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 13, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Dutch Warmblood' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 14, "Nervous": 5, "Calm": 11, "Bold": 15, "Steady": 15, "Willing": 12, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'East Bulgarian' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 4, "Nervous": 2, "Calm": 22, "Bold": 9, "Steady": 23, "Willing": 15, "Independent": 4, "Reactive": 2, "Stubborn": 6, "Driven": 8, "Lazy": 4, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Estonian Draft' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 7, "Nervous": 3, "Calm": 19, "Bold": 12, "Steady": 16, "Willing": 14, "Independent": 8, "Reactive": 3, "Stubborn": 6, "Driven": 8, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Estonian Native' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 9, "Bold": 15, "Steady": 12, "Willing": 4, "Independent": 16, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Ethiopian Horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 9, "Nervous": 3, "Calm": 18, "Bold": 12, "Steady": 16, "Willing": 14, "Independent": 8, "Reactive": 3, "Stubborn": 6, "Driven": 7, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Falabella' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 4, "Nervous": 3, "Calm": 20, "Bold": 10, "Steady": 20, "Willing": 14, "Independent": 5, "Reactive": 3, "Stubborn": 5, "Driven": 12, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Finnhorse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 8, "Nervous": 3, "Calm": 18, "Bold": 12, "Steady": 16, "Willing": 16, "Independent": 8, "Reactive": 3, "Stubborn": 4, "Driven": 8, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Fjord horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 3, "Nervous": 2, "Calm": 22, "Bold": 10, "Steady": 22, "Willing": 16, "Independent": 4, "Reactive": 2, "Stubborn": 6, "Driven": 8, "Lazy": 4, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Flemish' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 10, "Bold": 14, "Steady": 12, "Willing": 3, "Independent": 17, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Fleuve' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 15, "Nervous": 5, "Calm": 12, "Bold": 15, "Steady": 13, "Willing": 12, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Florida Cracker Horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 5, "Calm": 10, "Bold": 14, "Steady": 12, "Willing": 4, "Independent": 16, "Reactive": 7, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Foutanké' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 13, "Nervous": 4, "Calm": 13, "Bold": 15, "Steady": 15, "Willing": 12, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Frederiksborger' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 6, "Nervous": 3, "Calm": 21, "Bold": 10, "Steady": 20, "Willing": 14, "Independent": 5, "Reactive": 3, "Stubborn": 5, "Driven": 9, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Freiberger' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 19, "Nervous": 8, "Calm": 6, "Bold": 14, "Steady": 8, "Willing": 8, "Independent": 6, "Reactive": 8, "Stubborn": 4, "Driven": 17, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'French Trotter' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 4, "Calm": 14, "Bold": 15, "Steady": 15, "Willing": 12, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Friesian' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 14, "Nervous": 4, "Calm": 12, "Bold": 16, "Steady": 14, "Willing": 12, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Furioso-North Star' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 16, "Nervous": 5, "Calm": 11, "Bold": 12, "Steady": 14, "Willing": 12, "Independent": 6, "Reactive": 5, "Stubborn": 4, "Driven": 13, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Galiceno' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 15, "Nervous": 5, "Calm": 11, "Bold": 15, "Steady": 14, "Willing": 10, "Independent": 5, "Reactive": 6, "Stubborn": 4, "Driven": 13, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Gelderland' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 10, "Nervous": 4, "Calm": 16, "Bold": 12, "Steady": 15, "Willing": 6, "Independent": 10, "Reactive": 4, "Stubborn": 11, "Driven": 6, "Lazy": 5, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Giara Horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 16, "Nervous": 6, "Calm": 10, "Bold": 15, "Steady": 14, "Willing": 10, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 13, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Gidran' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 7, "Nervous": 3, "Calm": 20, "Bold": 10, "Steady": 20, "Willing": 13, "Independent": 5, "Reactive": 3, "Stubborn": 5, "Driven": 10, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Groningen Horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 18, "Nervous": 5, "Calm": 10, "Bold": 15, "Steady": 14, "Willing": 8, "Independent": 5, "Reactive": 6, "Stubborn": 4, "Driven": 13, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Hackney Horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 8, "Nervous": 4, "Calm": 16, "Bold": 12, "Steady": 15, "Willing": 7, "Independent": 10, "Reactive": 4, "Stubborn": 12, "Driven": 6, "Lazy": 5, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Haflinger' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 4, "Calm": 12, "Bold": 15, "Steady": 15, "Willing": 14, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Hanoverian horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 8, "Bold": 14, "Steady": 12, "Willing": 4, "Independent": 18, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Heck horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 10, "Bold": 15, "Steady": 11, "Willing": 4, "Independent": 16, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Heihe horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 7, "Nervous": 3, "Calm": 19, "Bold": 12, "Steady": 16, "Willing": 14, "Independent": 8, "Reactive": 3, "Stubborn": 6, "Driven": 8, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Henson horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 10, "Bold": 13, "Steady": 13, "Willing": 4, "Independent": 16, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Hequ horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 13, "Nervous": 6, "Calm": 9, "Bold": 14, "Steady": 12, "Willing": 4, "Independent": 16, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Hirzai' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 6, "Nervous": 3, "Calm": 20, "Bold": 10, "Steady": 21, "Willing": 14, "Independent": 5, "Reactive": 3, "Stubborn": 5, "Driven": 9, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Hispano-Bretón' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 16, "Nervous": 4, "Calm": 10, "Bold": 15, "Steady": 14, "Willing": 10, "Independent": 5, "Reactive": 7, "Stubborn": 4, "Driven": 13, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Hispano-Árabe' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 14, "Nervous": 4, "Calm": 12, "Bold": 15, "Steady": 15, "Willing": 11, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 13, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Holsteiner' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 5, "Calm": 11, "Bold": 14, "Steady": 12, "Willing": 4, "Independent": 16, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Horro' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 15, "Nervous": 4, "Calm": 12, "Bold": 15, "Steady": 15, "Willing": 11, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Hungarian Warmblood' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 14, "Nervous": 5, "Calm": 14, "Bold": 12, "Steady": 14, "Willing": 12, "Independent": 6, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Icelandic horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 11, "Nervous": 4, "Calm": 15, "Bold": 12, "Steady": 15, "Willing": 7, "Independent": 10, "Reactive": 4, "Stubborn": 10, "Driven": 6, "Lazy": 5, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Indian Country-bred' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 20, "Nervous": 8, "Calm": 6, "Bold": 14, "Steady": 8, "Willing": 7, "Independent": 7, "Reactive": 8, "Stubborn": 4, "Driven": 16, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Iomud' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 4, "Nervous": 3, "Calm": 20, "Bold": 12, "Steady": 20, "Willing": 14, "Independent": 5, "Reactive": 3, "Stubborn": 5, "Driven": 10, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Irish Draught' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 14, "Nervous": 4, "Calm": 11, "Bold": 16, "Steady": 15, "Willing": 12, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Irish Sport (Hunter)' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 4, "Nervous": 2, "Calm": 22, "Bold": 10, "Steady": 22, "Willing": 14, "Independent": 4, "Reactive": 2, "Stubborn": 6, "Driven": 9, "Lazy": 4, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Italian Heavy Draft' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 19, "Nervous": 8, "Calm": 6, "Bold": 14, "Steady": 8, "Willing": 8, "Independent": 6, "Reactive": 8, "Stubborn": 4, "Driven": 17, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Italian Trotter' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 10, "Nervous": 4, "Calm": 16, "Bold": 12, "Steady": 15, "Willing": 7, "Independent": 11, "Reactive": 4, "Stubborn": 9, "Driven": 6, "Lazy": 5, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Jaca Navarra' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 11, "Nervous": 4, "Calm": 15, "Bold": 12, "Steady": 15, "Willing": 7, "Independent": 10, "Reactive": 4, "Stubborn": 10, "Driven": 6, "Lazy": 5, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Jeju horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 3, "Nervous": 2, "Calm": 22, "Bold": 10, "Steady": 22, "Willing": 16, "Independent": 4, "Reactive": 2, "Stubborn": 6, "Driven": 8, "Lazy": 4, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Jutland horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 10, "Bold": 15, "Steady": 11, "Willing": 4, "Independent": 16, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Kabarda (Kabardin)' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 5, "Calm": 11, "Bold": 14, "Steady": 12, "Willing": 4, "Independent": 16, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Kafa' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 10, "Bold": 14, "Steady": 12, "Willing": 2, "Independent": 18, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Kaimanawa' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 9, "Bold": 14, "Steady": 12, "Willing": 4, "Independent": 17, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Kalmyk horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 20, "Nervous": 8, "Calm": 6, "Bold": 14, "Steady": 8, "Willing": 7, "Independent": 7, "Reactive": 8, "Stubborn": 4, "Driven": 16, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Karabair' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 21, "Nervous": 8, "Calm": 5, "Bold": 14, "Steady": 8, "Willing": 8, "Independent": 6, "Reactive": 8, "Stubborn": 4, "Driven": 16, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Karabakh (Azer At)' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 10, "Bold": 15, "Steady": 11, "Willing": 4, "Independent": 16, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Karachai horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 16, "Nervous": 4, "Calm": 12, "Bold": 12, "Steady": 14, "Willing": 12, "Independent": 6, "Reactive": 6, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Kathiawari horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 9, "Bold": 14, "Steady": 12, "Willing": 4, "Independent": 17, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Kazakh Horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 15, "Nervous": 5, "Calm": 13, "Bold": 12, "Steady": 14, "Willing": 12, "Independent": 6, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Kentucky Mountain Saddle' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 10, "Bold": 14, "Steady": 12, "Willing": 2, "Independent": 18, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Kiger Mustang' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 13, "Nervous": 4, "Calm": 13, "Bold": 15, "Steady": 15, "Willing": 12, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Kinsky horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 14, "Nervous": 4, "Calm": 12, "Bold": 15, "Steady": 15, "Willing": 11, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 13, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Kisber Felver' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 10, "Nervous": 4, "Calm": 16, "Bold": 12, "Steady": 15, "Willing": 6, "Independent": 10, "Reactive": 4, "Stubborn": 11, "Driven": 6, "Lazy": 5, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Kiso horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 4, "Nervous": 3, "Calm": 22, "Bold": 10, "Steady": 20, "Willing": 14, "Independent": 5, "Reactive": 3, "Stubborn": 5, "Driven": 10, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Kladruber' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 13, "Nervous": 4, "Calm": 13, "Bold": 15, "Steady": 15, "Willing": 12, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Knabstrupper' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 10, "Nervous": 4, "Calm": 16, "Bold": 12, "Steady": 15, "Willing": 5, "Independent": 12, "Reactive": 4, "Stubborn": 10, "Driven": 6, "Lazy": 5, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Konik' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 5, "Calm": 11, "Bold": 14, "Steady": 12, "Willing": 4, "Independent": 16, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Kundudo horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 13, "Nervous": 6, "Calm": 9, "Bold": 14, "Steady": 12, "Willing": 4, "Independent": 16, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Kurdish horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 16, "Nervous": 6, "Calm": 10, "Bold": 15, "Steady": 14, "Willing": 10, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 13, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Kustanai' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 9, "Bold": 14, "Steady": 12, "Willing": 4, "Independent": 17, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Kyrgyz Horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 5, "Nervous": 3, "Calm": 20, "Bold": 10, "Steady": 20, "Willing": 15, "Independent": 5, "Reactive": 3, "Stubborn": 5, "Driven": 10, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Latvian horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 4, "Calm": 14, "Bold": 15, "Steady": 15, "Willing": 12, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Lipizzan' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 4, "Nervous": 2, "Calm": 22, "Bold": 10, "Steady": 22, "Willing": 14, "Independent": 4, "Reactive": 2, "Stubborn": 6, "Driven": 9, "Lazy": 4, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Lithuanian Heavy Draft' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 19, "Nervous": 8, "Calm": 6, "Bold": 14, "Steady": 8, "Willing": 8, "Independent": 6, "Reactive": 8, "Stubborn": 4, "Driven": 17, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Ljutomer Trotter' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 9, "Bold": 14, "Steady": 12, "Willing": 4, "Independent": 17, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Lokai' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 10, "Nervous": 4, "Calm": 16, "Bold": 12, "Steady": 15, "Willing": 7, "Independent": 11, "Reactive": 4, "Stubborn": 9, "Driven": 6, "Lazy": 5, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Losino horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 16, "Nervous": 5, "Calm": 10, "Bold": 16, "Steady": 13, "Willing": 10, "Independent": 5, "Reactive": 6, "Stubborn": 4, "Driven": 13, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Lusitano' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 14, "Nervous": 3, "Calm": 13, "Bold": 15, "Steady": 15, "Willing": 12, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Luxembourg Warmblood' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 13, "Nervous": 5, "Calm": 10, "Bold": 14, "Steady": 12, "Willing": 4, "Independent": 16, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'M''Bayar' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 11, "Bold": 14, "Steady": 12, "Willing": 4, "Independent": 16, "Reactive": 5, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'M''Par' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 7, "Nervous": 3, "Calm": 20, "Bold": 10, "Steady": 20, "Willing": 13, "Independent": 5, "Reactive": 3, "Stubborn": 5, "Driven": 10, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Mallorquín horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 14, "Nervous": 5, "Calm": 11, "Bold": 15, "Steady": 15, "Willing": 12, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Malopolski' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 17, "Nervous": 5, "Calm": 11, "Bold": 12, "Steady": 14, "Willing": 12, "Independent": 6, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Mangalarga' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 15, "Nervous": 5, "Calm": 13, "Bold": 12, "Steady": 14, "Willing": 12, "Independent": 6, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Mangalarga Marchador' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 9, "Nervous": 3, "Calm": 15, "Bold": 14, "Steady": 18, "Willing": 12, "Independent": 6, "Reactive": 4, "Stubborn": 4, "Driven": 12, "Lazy": 2, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Maremmano' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 8, "Nervous": 3, "Calm": 16, "Bold": 15, "Steady": 17, "Willing": 12, "Independent": 6, "Reactive": 4, "Stubborn": 4, "Driven": 12, "Lazy": 2, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Marismeño' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 16, "Nervous": 4, "Calm": 12, "Bold": 12, "Steady": 14, "Willing": 12, "Independent": 6, "Reactive": 6, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Marwari horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 14, "Nervous": 3, "Calm": 13, "Bold": 15, "Steady": 15, "Willing": 12, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Mecklenburger' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 6, "Nervous": 3, "Calm": 20, "Bold": 10, "Steady": 20, "Willing": 13, "Independent": 5, "Reactive": 3, "Stubborn": 5, "Driven": 11, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Medimurje' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 15, "Nervous": 5, "Calm": 11, "Bold": 15, "Steady": 14, "Willing": 10, "Independent": 5, "Reactive": 6, "Stubborn": 4, "Driven": 13, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Menorquín horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 7, "Nervous": 3, "Calm": 19, "Bold": 12, "Steady": 16, "Willing": 14, "Independent": 8, "Reactive": 3, "Stubborn": 6, "Driven": 8, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Merens (Merens horse)' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 16, "Nervous": 5, "Calm": 12, "Bold": 12, "Steady": 14, "Willing": 11, "Independent": 7, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Messara horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 10, "Nervous": 3, "Calm": 17, "Bold": 12, "Steady": 15, "Willing": 7, "Independent": 10, "Reactive": 4, "Stubborn": 10, "Driven": 6, "Lazy": 5, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Miquelon horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 10, "Nervous": 4, "Calm": 16, "Bold": 12, "Steady": 15, "Willing": 6, "Independent": 10, "Reactive": 4, "Stubborn": 11, "Driven": 6, "Lazy": 5, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Monterufolino' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 18, "Nervous": 8, "Calm": 8, "Bold": 14, "Steady": 8, "Willing": 8, "Independent": 6, "Reactive": 8, "Stubborn": 4, "Driven": 16, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Morab' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 4, "Calm": 14, "Bold": 15, "Steady": 15, "Willing": 12, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Morgan USA' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 15, "Nervous": 5, "Calm": 13, "Bold": 12, "Steady": 14, "Willing": 12, "Independent": 6, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Mountain Pleasure' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 9, "Bold": 14, "Steady": 12, "Willing": 4, "Independent": 17, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Moyle horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 7, "Nervous": 3, "Calm": 20, "Bold": 10, "Steady": 20, "Willing": 13, "Independent": 5, "Reactive": 3, "Stubborn": 5, "Driven": 10, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Murgese' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 10, "Bold": 14, "Steady": 12, "Willing": 2, "Independent": 18, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Mustang' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 9, "Bold": 15, "Steady": 12, "Willing": 4, "Independent": 16, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Namib Desert Horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 10, "Bold": 13, "Steady": 13, "Willing": 4, "Independent": 16, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Nangchen horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 18, "Nervous": 5, "Calm": 12, "Bold": 12, "Steady": 14, "Willing": 10, "Independent": 6, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'National Show Horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 10, "Bold": 14, "Steady": 12, "Willing": 4, "Independent": 17, "Reactive": 6, "Stubborn": 7, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'New Altai' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 16, "Nervous": 5, "Calm": 12, "Bold": 12, "Steady": 14, "Willing": 11, "Independent": 7, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Nez Perce' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 3, "Nervous": 2, "Calm": 22, "Bold": 10, "Steady": 22, "Willing": 16, "Independent": 4, "Reactive": 2, "Stubborn": 6, "Driven": 8, "Lazy": 4, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Nivernais' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 10, "Bold": 14, "Steady": 12, "Willing": 2, "Independent": 18, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Nokota horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 10, "Nervous": 4, "Calm": 16, "Bold": 12, "Steady": 15, "Willing": 6, "Independent": 10, "Reactive": 4, "Stubborn": 11, "Driven": 6, "Lazy": 5, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Noma horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 6, "Nervous": 3, "Calm": 20, "Bold": 10, "Steady": 20, "Willing": 13, "Independent": 5, "Reactive": 3, "Stubborn": 5, "Driven": 11, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Nonius' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 15, "Nervous": 5, "Calm": 13, "Bold": 12, "Steady": 14, "Willing": 12, "Independent": 6, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Nooitgedachter' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 8, "Nervous": 3, "Calm": 18, "Bold": 12, "Steady": 16, "Willing": 15, "Independent": 8, "Reactive": 3, "Stubborn": 5, "Driven": 8, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Nordlandshest' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 4, "Nervous": 2, "Calm": 22, "Bold": 10, "Steady": 22, "Willing": 16, "Independent": 4, "Reactive": 2, "Stubborn": 6, "Driven": 8, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Noriker horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 6, "Nervous": 3, "Calm": 20, "Bold": 10, "Steady": 19, "Willing": 14, "Independent": 5, "Reactive": 3, "Stubborn": 5, "Driven": 11, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Norman Cob' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 3, "Nervous": 2, "Calm": 23, "Bold": 10, "Steady": 22, "Willing": 15, "Independent": 4, "Reactive": 2, "Stubborn": 6, "Driven": 8, "Lazy": 4, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Novoalexandrian Draft' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 9, "Bold": 14, "Steady": 12, "Willing": 4, "Independent": 17, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Novokirghiz' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 5, "Nervous": 3, "Calm": 20, "Bold": 10, "Steady": 20, "Willing": 15, "Independent": 5, "Reactive": 3, "Stubborn": 5, "Driven": 10, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Oberlander Horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 10, "Bold": 15, "Steady": 12, "Willing": 4, "Independent": 15, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Ogaden' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 14, "Nervous": 3, "Calm": 13, "Bold": 15, "Steady": 15, "Willing": 12, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Oldenburger' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 19, "Nervous": 8, "Calm": 7, "Bold": 14, "Steady": 8, "Willing": 8, "Independent": 6, "Reactive": 8, "Stubborn": 4, "Driven": 16, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Orlov Trotter' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 7, "Nervous": 3, "Calm": 20, "Bold": 10, "Steady": 20, "Willing": 13, "Independent": 5, "Reactive": 3, "Stubborn": 5, "Driven": 10, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Ostfriesen' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 8, "Nervous": 3, "Calm": 16, "Bold": 15, "Steady": 17, "Willing": 12, "Independent": 6, "Reactive": 4, "Stubborn": 4, "Driven": 12, "Lazy": 2, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Paint Horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 17, "Nervous": 5, "Calm": 11, "Bold": 12, "Steady": 14, "Willing": 12, "Independent": 6, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Pampa horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 18, "Nervous": 5, "Calm": 10, "Bold": 12, "Steady": 14, "Willing": 12, "Independent": 6, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Paso Fino' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 6, "Nervous": 3, "Calm": 20, "Bold": 10, "Steady": 20, "Willing": 13, "Independent": 5, "Reactive": 3, "Stubborn": 5, "Driven": 11, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Pentro horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 4, "Nervous": 2, "Calm": 20, "Bold": 10, "Steady": 22, "Willing": 15, "Independent": 4, "Reactive": 2, "Stubborn": 6, "Driven": 10, "Lazy": 4, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Percheron' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 16, "Nervous": 6, "Calm": 10, "Bold": 15, "Steady": 14, "Willing": 10, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 13, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Persano' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 14, "Nervous": 5, "Calm": 14, "Bold": 12, "Steady": 14, "Willing": 12, "Independent": 6, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Peruvian Paso' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 3, "Nervous": 2, "Calm": 22, "Bold": 10, "Steady": 22, "Willing": 16, "Independent": 4, "Reactive": 2, "Stubborn": 6, "Driven": 8, "Lazy": 4, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Pfalz Ardenner' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 18, "Nervous": 8, "Calm": 8, "Bold": 14, "Steady": 8, "Willing": 8, "Independent": 6, "Reactive": 8, "Stubborn": 4, "Driven": 16, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Pintabian' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 14, "Nervous": 5, "Calm": 11, "Bold": 15, "Steady": 15, "Willing": 12, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Pleven' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 4, "Nervous": 2, "Calm": 22, "Bold": 10, "Steady": 22, "Willing": 14, "Independent": 4, "Reactive": 2, "Stubborn": 7, "Driven": 8, "Lazy": 4, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Poitevin' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 8, "Nervous": 3, "Calm": 16, "Bold": 14, "Steady": 18, "Willing": 13, "Independent": 5, "Reactive": 4, "Stubborn": 4, "Driven": 12, "Lazy": 2, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Pony Of The Americas' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 6, "Nervous": 3, "Calm": 20, "Bold": 10, "Steady": 20, "Willing": 13, "Independent": 5, "Reactive": 3, "Stubborn": 5, "Driven": 11, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Posavac' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 10, "Nervous": 4, "Calm": 16, "Bold": 12, "Steady": 15, "Willing": 7, "Independent": 11, "Reactive": 4, "Stubborn": 9, "Driven": 6, "Lazy": 5, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Pottok' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 11, "Bold": 14, "Steady": 12, "Willing": 4, "Independent": 16, "Reactive": 5, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Priob' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 10, "Bold": 14, "Steady": 12, "Willing": 2, "Independent": 18, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Pryor Mountain Mustang' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 21, "Nervous": 8, "Calm": 5, "Bold": 14, "Steady": 8, "Willing": 8, "Independent": 6, "Reactive": 8, "Stubborn": 4, "Driven": 16, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Purosangue Orientale' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 10, "Bold": 15, "Steady": 12, "Willing": 4, "Independent": 15, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Qatgani' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 9, "Nervous": 3, "Calm": 15, "Bold": 14, "Steady": 18, "Willing": 12, "Independent": 6, "Reactive": 4, "Stubborn": 4, "Driven": 12, "Lazy": 2, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Quarab' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 18, "Nervous": 5, "Calm": 10, "Bold": 12, "Steady": 14, "Willing": 12, "Independent": 6, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Racking' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 10, "Bold": 14, "Steady": 12, "Willing": 3, "Independent": 17, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Retuerta horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 4, "Nervous": 2, "Calm": 22, "Bold": 10, "Steady": 22, "Willing": 14, "Independent": 4, "Reactive": 2, "Stubborn": 6, "Driven": 9, "Lazy": 4, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Rhenish German Coldblood' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 13, "Nervous": 4, "Calm": 12, "Bold": 15, "Steady": 15, "Willing": 13, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Rhinelander horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 10, "Nervous": 4, "Calm": 16, "Bold": 12, "Steady": 15, "Willing": 6, "Independent": 10, "Reactive": 4, "Stubborn": 11, "Driven": 6, "Lazy": 5, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Riwoche horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 14, "Nervous": 5, "Calm": 14, "Bold": 12, "Steady": 14, "Willing": 12, "Independent": 6, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Rocky Mountain' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 14, "Nervous": 4, "Calm": 12, "Bold": 15, "Steady": 15, "Willing": 11, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 13, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Romanian Sport Horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 16, "Nervous": 5, "Calm": 10, "Bold": 14, "Steady": 15, "Willing": 10, "Independent": 5, "Reactive": 6, "Stubborn": 4, "Driven": 13, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Russian Don' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 3, "Nervous": 2, "Calm": 23, "Bold": 10, "Steady": 22, "Willing": 15, "Independent": 4, "Reactive": 2, "Stubborn": 6, "Driven": 8, "Lazy": 4, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Russian Heavy Draft' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 19, "Nervous": 8, "Calm": 6, "Bold": 14, "Steady": 8, "Willing": 8, "Independent": 6, "Reactive": 8, "Stubborn": 4, "Driven": 17, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Russian Trotter' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 15, "Nervous": 4, "Calm": 11, "Bold": 15, "Steady": 15, "Willing": 12, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Salernitano' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 10, "Nervous": 3, "Calm": 17, "Bold": 12, "Steady": 15, "Willing": 7, "Independent": 10, "Reactive": 4, "Stubborn": 10, "Driven": 6, "Lazy": 5, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Samolaco horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 6, "Nervous": 3, "Calm": 20, "Bold": 10, "Steady": 20, "Willing": 13, "Independent": 5, "Reactive": 3, "Stubborn": 5, "Driven": 11, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Sanfratellano' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 10, "Bold": 14, "Steady": 12, "Willing": 2, "Independent": 18, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Santa Cruz Island' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 10, "Nervous": 4, "Calm": 16, "Bold": 12, "Steady": 15, "Willing": 7, "Independent": 11, "Reactive": 4, "Stubborn": 9, "Driven": 6, "Lazy": 5, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Sarcidano horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 16, "Nervous": 4, "Calm": 10, "Bold": 15, "Steady": 14, "Willing": 10, "Independent": 5, "Reactive": 7, "Stubborn": 4, "Driven": 13, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Sardinian Anglo-Arab' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 4, "Nervous": 2, "Calm": 22, "Bold": 10, "Steady": 22, "Willing": 14, "Independent": 4, "Reactive": 2, "Stubborn": 6, "Driven": 9, "Lazy": 4, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Schleswig Coldblood' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 9, "Bold": 15, "Steady": 12, "Willing": 4, "Independent": 16, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Selale' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 14, "Nervous": 4, "Calm": 12, "Bold": 15, "Steady": 15, "Willing": 11, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 13, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Sella Italiano' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 15, "Nervous": 4, "Calm": 11, "Bold": 15, "Steady": 15, "Willing": 12, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Selle Français' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 17, "Nervous": 5, "Calm": 9, "Bold": 15, "Steady": 14, "Willing": 10, "Independent": 5, "Reactive": 6, "Stubborn": 4, "Driven": 13, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Senner' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 18, "Nervous": 8, "Calm": 8, "Bold": 14, "Steady": 8, "Willing": 8, "Independent": 6, "Reactive": 8, "Stubborn": 4, "Driven": 16, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Shagya Arabian' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 10, "Nervous": 4, "Calm": 16, "Bold": 12, "Steady": 15, "Willing": 6, "Independent": 10, "Reactive": 4, "Stubborn": 11, "Driven": 6, "Lazy": 5, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Shan Horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 2, "Nervous": 2, "Calm": 24, "Bold": 10, "Steady": 22, "Willing": 15, "Independent": 4, "Reactive": 2, "Stubborn": 6, "Driven": 8, "Lazy": 4, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Shire horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 6, "Nervous": 3, "Calm": 20, "Bold": 10, "Steady": 20, "Willing": 13, "Independent": 5, "Reactive": 3, "Stubborn": 5, "Driven": 11, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Siciliano indigeno' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 7, "Nervous": 3, "Calm": 20, "Bold": 10, "Steady": 20, "Willing": 13, "Independent": 5, "Reactive": 3, "Stubborn": 5, "Driven": 10, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Silesian horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 16, "Nervous": 4, "Calm": 12, "Bold": 12, "Steady": 14, "Willing": 12, "Independent": 6, "Reactive": 6, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Sindhi horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 4, "Nervous": 2, "Calm": 22, "Bold": 10, "Steady": 22, "Willing": 14, "Independent": 4, "Reactive": 2, "Stubborn": 6, "Driven": 9, "Lazy": 4, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Slovenian Coldblood' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 3, "Nervous": 2, "Calm": 22, "Bold": 10, "Steady": 22, "Willing": 16, "Independent": 4, "Reactive": 2, "Stubborn": 6, "Driven": 8, "Lazy": 4, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Sokolski horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 10, "Bold": 14, "Steady": 12, "Willing": 2, "Independent": 18, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Sorraia' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 4, "Nervous": 2, "Calm": 22, "Bold": 10, "Steady": 22, "Willing": 14, "Independent": 4, "Reactive": 2, "Stubborn": 6, "Driven": 9, "Lazy": 4, "Aggressive": 1}'::jsonb)
WHERE "name" = 'South German Coldblood' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 3, "Nervous": 2, "Calm": 23, "Bold": 10, "Steady": 22, "Willing": 15, "Independent": 4, "Reactive": 2, "Stubborn": 6, "Driven": 8, "Lazy": 4, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Soviet Heavy Draft' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 20, "Nervous": 8, "Calm": 6, "Bold": 14, "Steady": 8, "Willing": 7, "Independent": 7, "Reactive": 8, "Stubborn": 4, "Driven": 16, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Spanish Barb' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 15, "Nervous": 5, "Calm": 13, "Bold": 12, "Steady": 14, "Willing": 12, "Independent": 6, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Spanish Jennet' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 10, "Bold": 14, "Steady": 12, "Willing": 2, "Independent": 18, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Spanish Mustang' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 19, "Nervous": 8, "Calm": 6, "Bold": 14, "Steady": 8, "Willing": 8, "Independent": 6, "Reactive": 8, "Stubborn": 4, "Driven": 17, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Spanish Trotter' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 14, "Nervous": 5, "Calm": 14, "Bold": 12, "Steady": 14, "Willing": 12, "Independent": 6, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Spiti Horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 17, "Nervous": 5, "Calm": 11, "Bold": 12, "Steady": 14, "Willing": 12, "Independent": 6, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Spotted Saddle horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 14, "Nervous": 5, "Calm": 12, "Bold": 12, "Steady": 14, "Willing": 12, "Independent": 6, "Reactive": 5, "Stubborn": 4, "Driven": 14, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Standardbred' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 2, "Nervous": 2, "Calm": 22, "Bold": 10, "Steady": 22, "Willing": 17, "Independent": 4, "Reactive": 2, "Stubborn": 6, "Driven": 8, "Lazy": 4, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Suffolk Punch' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 4, "Nervous": 2, "Calm": 22, "Bold": 10, "Steady": 22, "Willing": 14, "Independent": 4, "Reactive": 2, "Stubborn": 6, "Driven": 9, "Lazy": 4, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Swedish Ardennes' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 13, "Nervous": 4, "Calm": 12, "Bold": 15, "Steady": 15, "Willing": 13, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Swedish Warmblood' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 14, "Nervous": 4, "Calm": 12, "Bold": 15, "Steady": 15, "Willing": 11, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 13, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Swiss Warmblood' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 10, "Nervous": 4, "Calm": 16, "Bold": 12, "Steady": 15, "Willing": 6, "Independent": 10, "Reactive": 4, "Stubborn": 11, "Driven": 6, "Lazy": 5, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Taishū horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 16, "Nervous": 6, "Calm": 8, "Bold": 14, "Steady": 10, "Willing": 10, "Independent": 7, "Reactive": 7, "Stubborn": 4, "Driven": 14, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Tawleed' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 8, "Nervous": 2, "Calm": 22, "Bold": 10, "Steady": 22, "Willing": 14, "Independent": 4, "Reactive": 2, "Stubborn": 4, "Driven": 8, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Tennessee Walking' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 8, "Nervous": 2, "Calm": 22, "Bold": 10, "Steady": 22, "Willing": 14, "Independent": 4, "Reactive": 2, "Stubborn": 4, "Driven": 8, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Tennessee Walking Horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 14, "Nervous": 5, "Calm": 12, "Bold": 14, "Steady": 12, "Willing": 12, "Independent": 6, "Reactive": 5, "Stubborn": 4, "Driven": 13, "Lazy": 2, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Tersk horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 25, "Nervous": 10, "Calm": 4, "Bold": 15, "Steady": 6, "Willing": 3, "Independent": 5, "Reactive": 10, "Stubborn": 4, "Driven": 16, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Thoroughbred' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 10, "Nervous": 3, "Calm": 18, "Bold": 12, "Steady": 18, "Willing": 12, "Independent": 6, "Reactive": 4, "Stubborn": 5, "Driven": 8, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Tiger Horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 10, "Nervous": 5, "Calm": 15, "Bold": 10, "Steady": 15, "Willing": 6, "Independent": 12, "Reactive": 5, "Stubborn": 10, "Driven": 6, "Lazy": 4, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Tokara horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 8, "Nervous": 3, "Calm": 20, "Bold": 12, "Steady": 18, "Willing": 12, "Independent": 6, "Reactive": 3, "Stubborn": 5, "Driven": 8, "Lazy": 4, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Tolfetano' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 10, "Nervous": 3, "Calm": 18, "Bold": 12, "Steady": 18, "Willing": 12, "Independent": 5, "Reactive": 4, "Stubborn": 4, "Driven": 10, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Tori horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 4, "Nervous": 2, "Calm": 24, "Bold": 10, "Steady": 22, "Willing": 13, "Independent": 4, "Reactive": 2, "Stubborn": 6, "Driven": 8, "Lazy": 4, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Trait du Nord' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 16, "Nervous": 6, "Calm": 10, "Bold": 15, "Steady": 12, "Willing": 11, "Independent": 5, "Reactive": 6, "Stubborn": 4, "Driven": 13, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Trakehner' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 10, "Nervous": 5, "Calm": 15, "Bold": 12, "Steady": 15, "Willing": 10, "Independent": 10, "Reactive": 5, "Stubborn": 6, "Driven": 8, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Tushetian horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 6, "Calm": 12, "Bold": 12, "Steady": 12, "Willing": 3, "Independent": 16, "Reactive": 6, "Stubborn": 8, "Driven": 8, "Lazy": 3, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Tuva horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 14, "Nervous": 5, "Calm": 12, "Bold": 14, "Steady": 14, "Willing": 12, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 2, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Ukrainian Riding' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 16, "Nervous": 6, "Calm": 10, "Bold": 15, "Steady": 10, "Willing": 7, "Independent": 8, "Reactive": 6, "Stubborn": 6, "Driven": 12, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Unmol Horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 5, "Calm": 14, "Bold": 12, "Steady": 14, "Willing": 10, "Independent": 10, "Reactive": 5, "Stubborn": 6, "Driven": 8, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Uzunyayla' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 10, "Nervous": 3, "Calm": 18, "Bold": 12, "Steady": 16, "Willing": 11, "Independent": 8, "Reactive": 4, "Stubborn": 5, "Driven": 9, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Ventasso' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 8, "Nervous": 3, "Calm": 18, "Bold": 10, "Steady": 18, "Willing": 15, "Independent": 6, "Reactive": 3, "Stubborn": 6, "Driven": 8, "Lazy": 4, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Virginia Highlander' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 4, "Calm": 16, "Bold": 12, "Steady": 16, "Willing": 12, "Independent": 5, "Reactive": 4, "Stubborn": 5, "Driven": 10, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Vlaamperd' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 6, "Nervous": 2, "Calm": 20, "Bold": 12, "Steady": 20, "Willing": 14, "Independent": 4, "Reactive": 3, "Stubborn": 5, "Driven": 10, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Vladimir Heavy Draft' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 8, "Nervous": 4, "Calm": 18, "Bold": 12, "Steady": 16, "Willing": 10, "Independent": 10, "Reactive": 4, "Stubborn": 6, "Driven": 8, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Vyatka horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 4, "Calm": 14, "Bold": 18, "Steady": 15, "Willing": 9, "Independent": 8, "Reactive": 4, "Stubborn": 4, "Driven": 10, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Waler' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 10, "Nervous": 3, "Calm": 18, "Bold": 12, "Steady": 18, "Willing": 14, "Independent": 6, "Reactive": 3, "Stubborn": 4, "Driven": 8, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Walkaloosa' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 14, "Nervous": 4, "Calm": 14, "Bold": 14, "Steady": 14, "Willing": 13, "Independent": 5, "Reactive": 4, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Warlander' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 16, "Nervous": 5, "Calm": 10, "Bold": 16, "Steady": 12, "Willing": 9, "Independent": 6, "Reactive": 5, "Stubborn": 6, "Driven": 12, "Lazy": 2, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Welsh Cob Section D' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 14, "Nervous": 4, "Calm": 12, "Bold": 14, "Steady": 16, "Willing": 12, "Independent": 4, "Reactive": 4, "Stubborn": 4, "Driven": 13, "Lazy": 2, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Westphalian horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 4, "Calm": 15, "Bold": 14, "Steady": 16, "Willing": 11, "Independent": 5, "Reactive": 4, "Stubborn": 4, "Driven": 12, "Lazy": 2, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Wielkopolski' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 13, "Nervous": 4, "Calm": 14, "Bold": 14, "Steady": 16, "Willing": 12, "Independent": 4, "Reactive": 4, "Stubborn": 4, "Driven": 12, "Lazy": 2, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Württemberger' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 5, "Calm": 12, "Bold": 12, "Steady": 12, "Willing": 7, "Independent": 14, "Reactive": 5, "Stubborn": 8, "Driven": 8, "Lazy": 3, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Xilingol horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 10, "Nervous": 6, "Calm": 14, "Bold": 12, "Steady": 12, "Willing": 1, "Independent": 20, "Reactive": 5, "Stubborn": 10, "Driven": 6, "Lazy": 2, "Aggressive": 2}'::jsonb)
WHERE "name" = 'Yakutian horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 12, "Nervous": 5, "Calm": 14, "Bold": 12, "Steady": 14, "Willing": 10, "Independent": 8, "Reactive": 5, "Stubborn": 6, "Driven": 10, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Yili horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 8, "Nervous": 4, "Calm": 20, "Bold": 10, "Steady": 18, "Willing": 11, "Independent": 8, "Reactive": 4, "Stubborn": 6, "Driven": 6, "Lazy": 4, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Yonaguni horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 10, "Nervous": 5, "Calm": 16, "Bold": 12, "Steady": 16, "Willing": 9, "Independent": 10, "Reactive": 4, "Stubborn": 6, "Driven": 8, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Zakynthos horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 18, "Nervous": 6, "Calm": 8, "Bold": 18, "Steady": 10, "Willing": 9, "Independent": 5, "Reactive": 6, "Stubborn": 4, "Driven": 14, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Zangersheide' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 8, "Nervous": 4, "Calm": 18, "Bold": 14, "Steady": 16, "Willing": 8, "Independent": 10, "Reactive": 4, "Stubborn": 6, "Driven": 8, "Lazy": 3, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Zaniskari' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 14, "Nervous": 4, "Calm": 13, "Bold": 14, "Steady": 15, "Willing": 12, "Independent": 5, "Reactive": 5, "Stubborn": 4, "Driven": 12, "Lazy": 1, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Zweibrücker' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set("breedGeneticProfile", '{temperament_weights}', '{"Spirited": 14, "Nervous": 5, "Calm": 12, "Bold": 14, "Steady": 14, "Willing": 9, "Independent": 8, "Reactive": 5, "Stubborn": 6, "Driven": 10, "Lazy": 2, "Aggressive": 1}'::jsonb)
WHERE "name" = 'Žemaitukas' AND jsonb_typeof("breedGeneticProfile") = 'object';

COMMIT;
