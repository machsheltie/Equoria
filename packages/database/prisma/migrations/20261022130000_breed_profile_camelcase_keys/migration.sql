-- Owner ruling 2026-10-21 (Stacey): Equoria names are camelCase. The keys
-- inside every breed's "breedGeneticProfile" are renamed to match the seed
-- files (backend/data/breeds/*.txt) and backend/data/breedProfiles.json:
--
--   rating_profiles -> ratingProfiles, std_dev -> stdDev,
--   is_gaited_breed -> isGaitedBreed, gaited_gait_registry -> gaitedGaitRegistry,
--   temperament_weights -> temperamentWeights, starter_stats -> starterStats,
--   allowed_alleles -> allowedAlleles,
--   disallowed_combinations -> disallowedCombinations,
--   allele_weights -> alleleWeights, marking_bias -> markingBias,
--   boolean_modifiers_prevalence -> booleanModifiersPrevalence,
--   shade_bias -> shadeBias, advanced_markings_bias -> advancedMarkingsBias,
--   legs_general_probability -> legsGeneralProbability,
--   leg_specific_probabilities -> legSpecificProbabilities,
--   max_legs_marked -> maxLegsMarked,
--   bloody_shoulder_probability_multiplier -> bloodyShoulderProbabilityMultiplier,
--   snowflake_probability_multiplier -> snowflakeProbabilityMultiplier,
--   frost_probability_multiplier -> frostProbabilityMultiplier
--
-- Keys only: every value is kept exactly. Locus keys such as "E_Extension" are
-- genetic nomenclature and are not touched. jsonb's text form always writes an
-- object key as "key": (quote, colon, space), and a string value is never
-- followed by a colon, so each replace() matches keys and nothing else.
--
-- Idempotent: a second run matches no row. The closing check aborts the whole
-- migration if any old key survives. Read-only check afterwards:
--   SELECT COUNT(*) FROM "breeds"
--   WHERE "breedGeneticProfile"::text ~ '"[a-z]+(_[a-z]+)+": ';

BEGIN;

UPDATE "breeds"
SET "breedGeneticProfile" = (
  replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
  replace(replace(replace(replace(replace(replace(replace(replace(replace(
    "breedGeneticProfile"::text,
    '"rating_profiles": ', '"ratingProfiles": '),
    '"std_dev": ', '"stdDev": '),
    '"is_gaited_breed": ', '"isGaitedBreed": '),
    '"gaited_gait_registry": ', '"gaitedGaitRegistry": '),
    '"temperament_weights": ', '"temperamentWeights": '),
    '"starter_stats": ', '"starterStats": '),
    '"allowed_alleles": ', '"allowedAlleles": '),
    '"disallowed_combinations": ', '"disallowedCombinations": '),
    '"allele_weights": ', '"alleleWeights": '),
    '"marking_bias": ', '"markingBias": '),
    '"boolean_modifiers_prevalence": ', '"booleanModifiersPrevalence": '),
    '"shade_bias": ', '"shadeBias": '),
    '"advanced_markings_bias": ', '"advancedMarkingsBias": '),
    '"legs_general_probability": ', '"legsGeneralProbability": '),
    '"leg_specific_probabilities": ', '"legSpecificProbabilities": '),
    '"max_legs_marked": ', '"maxLegsMarked": '),
    '"bloody_shoulder_probability_multiplier": ', '"bloodyShoulderProbabilityMultiplier": '),
    '"snowflake_probability_multiplier": ', '"snowflakeProbabilityMultiplier": '),
    '"frost_probability_multiplier": ', '"frostProbabilityMultiplier": ')
)::jsonb
WHERE "breedGeneticProfile" IS NOT NULL
  AND "breedGeneticProfile"::text ~ '"(rating_profiles|std_dev|is_gaited_breed|gaited_gait_registry|temperament_weights|starter_stats|allowed_alleles|disallowed_combinations|allele_weights|marking_bias|boolean_modifiers_prevalence|shade_bias|advanced_markings_bias|legs_general_probability|leg_specific_probabilities|max_legs_marked|bloody_shoulder_probability_multiplier|snowflake_probability_multiplier|frost_probability_multiplier)": ';

DO $$
DECLARE
  leftover INTEGER;
BEGIN
  SELECT COUNT(*) INTO leftover
  FROM "breeds"
  WHERE "breedGeneticProfile"::text ~ '"(rating_profiles|std_dev|is_gaited_breed|gaited_gait_registry|temperament_weights|starter_stats|allowed_alleles|disallowed_combinations|allele_weights|marking_bias|boolean_modifiers_prevalence|shade_bias|advanced_markings_bias|legs_general_probability|leg_specific_probabilities|max_legs_marked|bloody_shoulder_probability_multiplier|snowflake_probability_multiplier|frost_probability_multiplier)": ';
  IF leftover > 0 THEN
    RAISE EXCEPTION 'breed_profile_camelcase_keys: % breed row(s) still hold a snake_case profile key; aborting', leftover;
  END IF;
END $$;

COMMIT;
