-- Owner ruling 2026-10-22 (Stacey): Mangalarga, National Show Horse and
-- Standardbred are gaited breeds. Data only; no schema change.
--
-- Sets each breed's "breedGeneticProfile".rating_profiles to gaited: a gaiting
-- score { mean, std_dev }, is_gaited_breed true, and its gait names (from the
-- canonical gait registry, samples/Breeds/_gait-registry.txt). The same values
-- are in backend/data/breeds/*.txt and backend/data/breedProfiles.json.
--
-- Idempotent: running it again writes the same values. A breed row without an
-- object profile is left alone.

BEGIN;

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set(
  jsonb_set(
    jsonb_set("breedGeneticProfile", '{rating_profiles,gaits,gaiting}', '{"mean": 82, "std_dev": 9}'::jsonb),
    '{rating_profiles,is_gaited_breed}', 'true'::jsonb
  ),
  '{rating_profiles,gaited_gait_registry}', '["Marcha Batida", "Marcha Picada"]'::jsonb
)
WHERE "name" = 'Mangalarga' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set(
  jsonb_set(
    jsonb_set("breedGeneticProfile", '{rating_profiles,gaits,gaiting}', '{"mean": 82, "std_dev": 5}'::jsonb),
    '{rating_profiles,is_gaited_breed}', 'true'::jsonb
  ),
  '{rating_profiles,gaited_gait_registry}', '["Slow Gait", "Rack"]'::jsonb
)
WHERE "name" = 'National Show Horse' AND jsonb_typeof("breedGeneticProfile") = 'object';

UPDATE "breeds"
SET "breedGeneticProfile" = jsonb_set(
  jsonb_set(
    jsonb_set("breedGeneticProfile", '{rating_profiles,gaits,gaiting}', '{"mean": 82, "std_dev": 9}'::jsonb),
    '{rating_profiles,is_gaited_breed}', 'true'::jsonb
  ),
  '{rating_profiles,gaited_gait_registry}', '["Pace"]'::jsonb
)
WHERE "name" = 'Standardbred' AND jsonb_typeof("breedGeneticProfile") = 'object';

COMMIT;
