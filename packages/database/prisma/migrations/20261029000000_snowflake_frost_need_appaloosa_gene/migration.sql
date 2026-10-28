-- Owner ruling 2026-10-28 (q252, Equoria-tcata): snowflake and frost spotting
-- appear only on horses that carry the appaloosa gene (LP at the
-- LP_LeopardComplex locus: "LP/lp" or "LP/LP"). The marking generator now
-- gates them on the genotype; this clears the flags on existing horses
-- without LP so no horse keeps a marking it cannot have.
--
-- Data only (phenotype JSONB, advancedMarkings.snowflakePresent /
-- frostPresent set to false). Idempotent: a second run matches no row.
-- A horse with no colour genotype cannot be shown to carry LP, so it is
-- cleared too.
UPDATE "horses"
SET "phenotype" = jsonb_set(
      jsonb_set("phenotype", '{advancedMarkings,snowflakePresent}', 'false'::jsonb, true),
      '{advancedMarkings,frostPresent}', 'false'::jsonb, true)
WHERE jsonb_typeof("phenotype") = 'object'
  AND jsonb_typeof("phenotype"->'advancedMarkings') = 'object'
  AND (
    ("phenotype"->'advancedMarkings'->>'snowflakePresent') = 'true'
    OR ("phenotype"->'advancedMarkings'->>'frostPresent') = 'true'
  )
  AND NOT (
    jsonb_typeof("colorGenotype") = 'object'
    AND COALESCE("colorGenotype"->>'LP_LeopardComplex', '') ~ '(^|/)LP(/|$)'
  );
