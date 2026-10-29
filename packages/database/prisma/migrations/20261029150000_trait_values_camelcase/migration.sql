-- Owner ruling 2026-10-21 (Stacey): Equoria names are camelCase, stored game
-- values included.
--
-- Trait-domain values written with underscores -> camelCase, in:
--   horses."epigeneticModifiers": every trait id inside an array value
--     (positive, negative, hidden, dormant), e.g. eager_learner -> eagerLearner,
--     discipline_affinity_show_jumping -> disciplineAffinityShowJumping. Every
--     other key (revealEvaluatedThroughDay, ...) is kept exactly as stored, and
--     an id that appears twice after converting is kept once (first place).
--   horses."epigeneticFlags" (text[]) and horses."trait"
--   trait_history_logs."traitName", "sourceType" (daily_evaluation ->
--     dailyEvaluation), "sourceId"
--   milestone_trait_logs."milestoneType" (curiosity_play, trust_handling,
--     confidence_reactivity -> curiosityPlay, trustHandling,
--     confidenceReactivity), "finalTrait"
--   groom_interactions."milestoneWindowId" (older rows hold the same milestone
--     types; the groom care path now writes camelCase band ids)
--   ultra_rare_trait_events."traitName", "traitTier", "eventType" (rows left by
--     retired code: _lineage_analysis / lineage_analysis -> lineageAnalysis)
-- The authored names players see (Eager Learner, ...) are unchanged.
--
-- A value is converted when it contains an underscore: leading/trailing
-- underscores are dropped, the first word is kept, every later word gets a
-- capital first letter (the same result as normalizeTraitKey in
-- backend/utils/epigeneticTraitKeyMap.mjs for every legacy id).
--
-- NOT touched: epigeneticModifiers object keys (all already camelCase; the
-- closing check aborts if one is not), milestone_trait_logs."reasoning" (prose),
-- "modifiersApplied", ultra-rare "appliedPerks"/"triggerConditions",
-- audit_logs (raw request bodies).
--
-- Idempotent: a second run matches no row. The closing check aborts the whole
-- migration if any of these values still holds an underscore.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.trait_camel(v TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT CASE
    WHEN v IS NULL OR position('_' IN v) = 0 THEN v
    ELSE (
      SELECT string_agg(
        CASE WHEN t.o = 1 THEN t.w ELSE upper(left(t.w, 1)) || substr(t.w, 2) END,
        '' ORDER BY t.o)
      FROM unnest(array_remove(string_to_array(v, '_'), '')) WITH ORDINALITY AS t(w, o)
    )
  END
$fn$;

-- A JSON array of trait ids with every string converted, duplicates dropped
-- (first occurrence kept), non-strings kept in place.
CREATE OR REPLACE FUNCTION pg_temp.trait_camel_array(arr JSONB) RETURNS JSONB
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT COALESCE(jsonb_agg(x.v ORDER BY x.first_o), '[]'::jsonb)
  FROM (
    SELECT c.v, min(c.o) AS first_o
    FROM (
      SELECT CASE WHEN jsonb_typeof(e.x) = 'string'
               THEN to_jsonb(pg_temp.trait_camel(e.x #>> '{}')) ELSE e.x END AS v,
             e.o
      FROM jsonb_array_elements(arr) WITH ORDINALITY AS e(x, o)
    ) c
    GROUP BY c.v
  ) x
$fn$;

-- True when an epigeneticModifiers object holds an array element that needs
-- converting (an underscore) or a duplicate id.
CREATE OR REPLACE FUNCTION pg_temp.trait_modifiers_old(m JSONB) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT jsonb_typeof(m) = 'object' AND EXISTS (
    SELECT 1 FROM jsonb_each(m) j(k, val)
    WHERE jsonb_typeof(val) = 'array' AND val <> pg_temp.trait_camel_array(val))
$fn$;

UPDATE "horses"
SET "epigeneticModifiers" = (
  SELECT jsonb_object_agg(
    j.k,
    CASE WHEN jsonb_typeof(j.val) = 'array' THEN pg_temp.trait_camel_array(j.val) ELSE j.val END)
  FROM jsonb_each("epigeneticModifiers") j(k, val))
WHERE pg_temp.trait_modifiers_old("epigeneticModifiers");

UPDATE "horses"
SET "epigeneticFlags" = ARRAY(
  SELECT pg_temp.trait_camel(f.v) FROM unnest("epigeneticFlags") WITH ORDINALITY AS f(v, o) ORDER BY f.o)
WHERE EXISTS (SELECT 1 FROM unnest("epigeneticFlags") f(v) WHERE position('_' IN f.v) > 0);

UPDATE "horses" SET "trait" = pg_temp.trait_camel("trait") WHERE position('_' IN "trait") > 0;

UPDATE "trait_history_logs"
SET "traitName" = pg_temp.trait_camel("traitName"),
    "sourceType" = pg_temp.trait_camel("sourceType"),
    "sourceId" = pg_temp.trait_camel("sourceId")
WHERE position('_' IN "traitName") > 0
   OR position('_' IN "sourceType") > 0
   OR position('_' IN "sourceId") > 0;

UPDATE "milestone_trait_logs"
SET "milestoneType" = pg_temp.trait_camel("milestoneType"),
    "finalTrait" = pg_temp.trait_camel("finalTrait")
WHERE position('_' IN "milestoneType") > 0 OR position('_' IN "finalTrait") > 0;

UPDATE "groom_interactions"
SET "milestoneWindowId" = pg_temp.trait_camel("milestoneWindowId")
WHERE position('_' IN "milestoneWindowId") > 0;

UPDATE "ultra_rare_trait_events"
SET "traitName" = pg_temp.trait_camel("traitName"),
    "traitTier" = pg_temp.trait_camel("traitTier"),
    "eventType" = pg_temp.trait_camel("eventType")
WHERE position('_' IN "traitName") > 0
   OR position('_' IN "traitTier") > 0
   OR position('_' IN "eventType") > 0;

DO $$
DECLARE
  leftover INTEGER;
BEGIN
  SELECT
    (SELECT COUNT(*) FROM "horses"
     WHERE jsonb_typeof("epigeneticModifiers") = 'object' AND EXISTS (
       SELECT 1 FROM jsonb_each("epigeneticModifiers") j(k, val)
       WHERE position('_' IN j.k) > 0
          OR (jsonb_typeof(j.val) = 'array' AND EXISTS (
                SELECT 1 FROM jsonb_array_elements(j.val) e(x)
                WHERE jsonb_typeof(e.x) = 'string' AND position('_' IN e.x #>> '{}') > 0))))
    + (SELECT COUNT(*) FROM "horses"
       WHERE position('_' IN "trait") > 0
          OR EXISTS (SELECT 1 FROM unnest("epigeneticFlags") f(v) WHERE position('_' IN f.v) > 0))
    + (SELECT COUNT(*) FROM "trait_history_logs"
       WHERE position('_' IN "traitName") > 0
          OR position('_' IN "sourceType") > 0
          OR position('_' IN "sourceId") > 0)
    + (SELECT COUNT(*) FROM "milestone_trait_logs"
       WHERE position('_' IN "milestoneType") > 0 OR position('_' IN "finalTrait") > 0)
    + (SELECT COUNT(*) FROM "groom_interactions" WHERE position('_' IN "milestoneWindowId") > 0)
    + (SELECT COUNT(*) FROM "ultra_rare_trait_events"
       WHERE position('_' IN "traitName") > 0
          OR position('_' IN "traitTier") > 0
          OR position('_' IN "eventType") > 0)
  INTO leftover;
  IF leftover > 0 THEN
    RAISE EXCEPTION 'trait_values_camelcase: % row(s) still hold a snake_case trait value; aborting', leftover;
  END IF;
END $$;

COMMIT;
