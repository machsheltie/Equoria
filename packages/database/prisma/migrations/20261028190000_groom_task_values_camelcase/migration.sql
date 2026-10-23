-- Owner ruling 2026-10-21 (Stacey): Equoria names are camelCase, stored game
-- values included.
--
-- Groom task and interaction types (trust_building, hand-walking, daily_care,
-- routine_care, ...) -> trustBuilding, handWalking, dailyCare, routineCare, in:
--   groom_interactions."interactionType" and "taskType"
--     (groom_performance_records is gone: 20261027120100 dropped it)
--   foal_activities."activityType", and the type quoted in the description the
--     groom path writes: "Groom interaction (<type>) recorded via groom system"
--   horses."taskLog": task-name keys of the {task: count} map, and task names
--     inside array values (the {date: [tasks]} shape)
-- Enhanced interactions are stored as type + variation
-- (daily_care_morning_routine); they become dailyCareMorningRoutine, which is
-- what the code now writes.
-- foal_activities.source: groom_interaction, enrichment_activity ->
-- groomInteraction, enrichmentActivity.
--
-- A value is converted when it starts with a lower-case letter, contains _ or -,
-- and has no capital or space. It is split on every run of non-alphanumerics;
-- the first word stays lower-case and every later word is capitalised, so
-- training_support_pre-training_prep -> trainingSupportPreTrainingPrep. taskLog
-- keys that start with a digit (dates) and labels such as "Trailer Exposure"
-- (old enrichment rows) are left alone.
--
-- NOT touched: groom_interactions.notes (may hold player text),
-- groom_interactions."milestoneWindowId" (milestone types, a later phase),
-- audit_logs (raw request bodies).
--
-- Idempotent: a second run matches no row. Aborts before writing if two
-- taskLog keys of one horse would merge into one; the closing check aborts the
-- whole migration if any old spelling survives.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.groom_task_camel(v TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT string_agg(
    CASE WHEN t.o = 1 THEN lower(t.w) ELSE upper(left(t.w, 1)) || lower(substr(t.w, 2)) END,
    '' ORDER BY t.o)
  FROM unnest(array_remove(regexp_split_to_array(v, '[^A-Za-z0-9]+'), '')) WITH ORDINALITY AS t(w, o)
$fn$;

-- A taskLog key or array element that still needs converting.
CREATE OR REPLACE FUNCTION pg_temp.groom_task_old(v TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT v ~ '^[a-z]' AND v ~ '[_-]' AND v !~ '[A-Z[:space:]]'
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.groom_task_log_old(log JSONB) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT jsonb_typeof(log) = 'object' AND EXISTS (
    SELECT 1 FROM jsonb_each(log) j(k, val)
    WHERE pg_temp.groom_task_old(k)
       OR (jsonb_typeof(val) = 'array' AND EXISTS (
             SELECT 1 FROM jsonb_array_elements(val) e(x)
             WHERE jsonb_typeof(x) = 'string' AND pg_temp.groom_task_old(x #>> '{}'))))
$fn$;

UPDATE "groom_interactions" SET "interactionType" = pg_temp.groom_task_camel("interactionType")
WHERE pg_temp.groom_task_old("interactionType");

UPDATE "groom_interactions" SET "taskType" = pg_temp.groom_task_camel("taskType")
WHERE pg_temp.groom_task_old("taskType");

UPDATE "foal_activities" SET "activityType" = pg_temp.groom_task_camel("activityType")
WHERE pg_temp.groom_task_old("activityType");

UPDATE "foal_activities"
SET "description" = 'Groom interaction ('
  || pg_temp.groom_task_camel(substring("description" FROM '^Groom interaction \((.+)\) recorded via groom system$'))
  || ') recorded via groom system'
WHERE "description" ~ '^Groom interaction \(([a-z0-9]+[^A-Za-z0-9()]+)+[a-z0-9]+\) recorded via groom system$';

UPDATE "foal_activities" SET "source" = 'groomInteraction' WHERE "source" = 'groom_interaction';
UPDATE "foal_activities" SET "source" = 'enrichmentActivity' WHERE "source" = 'enrichment_activity';

DO $$
DECLARE
  merged INTEGER;
BEGIN
  SELECT COUNT(*) INTO merged FROM (
    SELECT h."id"
    FROM "horses" h, jsonb_each(h."taskLog") j(k, val)
    WHERE jsonb_typeof(h."taskLog") = 'object'
    GROUP BY h."id", CASE WHEN pg_temp.groom_task_old(j.k) THEN pg_temp.groom_task_camel(j.k) ELSE j.k END
    HAVING COUNT(*) > 1
  ) clash;
  IF merged > 0 THEN
    RAISE EXCEPTION 'groom_task_values_camelcase: % taskLog key(s) would merge with an existing key; aborting', merged;
  END IF;
END $$;

UPDATE "horses" h
SET "taskLog" = (
  SELECT jsonb_object_agg(
    CASE WHEN pg_temp.groom_task_old(j.k) THEN pg_temp.groom_task_camel(j.k) ELSE j.k END,
    CASE WHEN jsonb_typeof(j.val) = 'array' THEN COALESCE((
      SELECT jsonb_agg(
        CASE WHEN jsonb_typeof(e.x) = 'string' AND pg_temp.groom_task_old(e.x #>> '{}')
          THEN to_jsonb(pg_temp.groom_task_camel(e.x #>> '{}')) ELSE e.x END
        ORDER BY e.i)
      FROM jsonb_array_elements(j.val) WITH ORDINALITY e(x, i)), '[]'::jsonb)
    ELSE j.val END)
  FROM jsonb_each(h."taskLog") j(k, val))
WHERE pg_temp.groom_task_log_old(h."taskLog");

DO $$
DECLARE
  leftover INTEGER;
BEGIN
  SELECT
    (SELECT COUNT(*) FROM "groom_interactions"
     WHERE pg_temp.groom_task_old("interactionType") OR pg_temp.groom_task_old("taskType"))
    + (SELECT COUNT(*) FROM "foal_activities"
       WHERE pg_temp.groom_task_old("activityType")
          OR "source" IN ('groom_interaction', 'enrichment_activity')
          OR "description" ~ '^Groom interaction \(([a-z0-9]+[^A-Za-z0-9()]+)+[a-z0-9]+\) recorded via groom system$')
    + (SELECT COUNT(*) FROM "horses" WHERE pg_temp.groom_task_log_old("taskLog"))
  INTO leftover;
  IF leftover > 0 THEN
    RAISE EXCEPTION 'groom_task_values_camelcase: % row(s) still hold an old spelling; aborting', leftover;
  END IF;
END $$;

COMMIT;
