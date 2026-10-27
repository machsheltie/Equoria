-- Owner ruling 2026-10-27 (q136, Equoria-2d55z): existing horses move to the
-- twenty-trait roster (q117). Five old names map to a roster trait:
--   bold -> brave, social -> outgoing, antisocial -> aloof,
--   nervous -> skittish, bonded -> affectionate.
-- Every other off-roster trait name is removed.
--
-- Data only, no schema change. One idempotent UPDATE over "horses":
--
--   "epigeneticModifiers" (jsonb) - the positive / negative / hidden arrays.
--     A mapped or roster trait keeps its state: one that was hidden stays
--     hidden, one that was revealed and active (positive or negative) stays
--     active, in the array of its ruled polarity (q135). Spellings that differ
--     only by case, underscores or spaces (Eager Learner, BRAVE) become the
--     stored camelCase id. A horse that already carries the target trait keeps
--     that entry and its state, and the mapped one is dropped, so a trait is
--     never listed twice. Discipline trait keys (disciplineAffinity...) are a
--     separate ruling and are kept as stored. Every other key in the object
--     (revealEvaluatedThroughDay and the like) is kept.
--   "epigeneticFlags" (text[]) - flag names are trait names. Mapped and
--     respelled the same way, duplicates and off-roster names removed.
--   "trait" (text) - a free-text trait label. A roster or mapped name becomes
--     the roster id, anything else (e.g. 'Speed Demon') becomes NULL.
--   "ultraRareTraits" (jsonb) - the ultra-rare and exotic traits were all
--     removed from the game (owner ruling 2026-10-19), so any listed entry is
--     off-roster and the value returns to the empty default.
--
-- Not touched: "temporaryEpigeneticFlags" (holds temporary states such as
-- startled and unsettled, not trait names) and the history tables
-- (trait_history_logs, milestone_trait_logs), which record what happened.
--
-- Running it again changes nothing: every value it writes is already
-- canonical, and only rows whose value would change are updated.

WITH trait_map (norm, target, polarity) AS (
  VALUES
    ('brave', 'brave', 'positive'),
    ('confident', 'confident', 'positive'),
    ('outgoing', 'outgoing', 'positive'),
    ('affectionate', 'affectionate', 'positive'),
    ('resilient', 'resilient', 'positive'),
    ('fearful', 'fearful', 'negative'),
    ('insecure', 'insecure', 'negative'),
    ('aloof', 'aloof', 'negative'),
    ('fragile', 'fragile', 'negative'),
    ('skittish', 'skittish', 'negative'),
    ('eagerlearner', 'eagerLearner', 'positive'),
    ('peopletrusting', 'peopleTrusting', 'positive'),
    ('adaptable', 'adaptable', 'positive'),
    ('heart', 'heart', 'positive'),
    ('focused', 'focused', 'positive'),
    ('excitable', 'excitable', 'negative'),
    ('curious', 'curious', 'positive'),
    ('playful', 'playful', 'positive'),
    ('biddable', 'biddable', 'positive'),
    ('competitive', 'competitive', 'positive'),
    ('bold', 'brave', 'positive'),
    ('social', 'outgoing', 'positive'),
    ('antisocial', 'aloof', 'negative'),
    ('nervous', 'skittish', 'negative'),
    ('bonded', 'affectionate', 'positive')
),
modifier_entries AS (
  SELECT
    h."id",
    b.bucket,
    b.bucket_order,
    e.value,
    e.position,
    lower(regexp_replace(e.value, '[^A-Za-z]', '', 'g')) AS norm
  FROM "horses" h
  CROSS JOIN (VALUES ('positive', 1), ('negative', 2), ('hidden', 3)) AS b (bucket, bucket_order)
  CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE
      WHEN jsonb_typeof(h."epigeneticModifiers" -> b.bucket) = 'array'
        THEN h."epigeneticModifiers" -> b.bucket
      ELSE '[]'::jsonb
    END
  ) WITH ORDINALITY AS e (value, position)
  WHERE jsonb_typeof(h."epigeneticModifiers") = 'object'
),
modifier_resolved AS (
  SELECT
    me."id",
    me.bucket_order,
    me.position,
    CASE WHEN me.norm LIKE 'disciplineaffinity%' THEN me.value ELSE m.target END AS target,
    CASE
      WHEN me.norm LIKE 'disciplineaffinity%' THEN me.bucket
      WHEN me.bucket = 'hidden' THEN 'hidden'
      ELSE m.polarity
    END AS new_bucket,
    COALESCE(me.value = m.target, false) AS canonical
  FROM modifier_entries me
  LEFT JOIN trait_map m ON m.norm = me.norm
),
modifier_kept AS (
  SELECT DISTINCT ON ("id", target) "id", target, new_bucket, bucket_order, position
  FROM modifier_resolved
  WHERE target IS NOT NULL
  ORDER BY "id", target, canonical DESC, (new_bucket = 'hidden'), bucket_order, position
),
computed AS (
  SELECT
    h."id",
    CASE
      WHEN jsonb_typeof(h."epigeneticModifiers") = 'object' THEN
        h."epigeneticModifiers" || jsonb_build_object(
          'positive', COALESCE((
            SELECT jsonb_agg(k.target ORDER BY k.bucket_order, k.position)
            FROM modifier_kept k WHERE k."id" = h."id" AND k.new_bucket = 'positive'
          ), '[]'::jsonb),
          'negative', COALESCE((
            SELECT jsonb_agg(k.target ORDER BY k.bucket_order, k.position)
            FROM modifier_kept k WHERE k."id" = h."id" AND k.new_bucket = 'negative'
          ), '[]'::jsonb),
          'hidden', COALESCE((
            SELECT jsonb_agg(k.target ORDER BY k.bucket_order, k.position)
            FROM modifier_kept k WHERE k."id" = h."id" AND k.new_bucket = 'hidden'
          ), '[]'::jsonb)
        )
      ELSE h."epigeneticModifiers"
    END AS modifiers,
    ARRAY(
      SELECT kept.target
      FROM (
        SELECT DISTINCT ON (m.target) m.target, f.position
        FROM unnest(h."epigeneticFlags") WITH ORDINALITY AS f (value, position)
        JOIN trait_map m ON m.norm = lower(regexp_replace(f.value, '[^A-Za-z]', '', 'g'))
        ORDER BY m.target, (f.value = m.target) DESC, f.position
      ) AS kept
      ORDER BY kept.position
    ) AS flags,
    (
      SELECT m.target FROM trait_map m
      WHERE m.norm = lower(regexp_replace(h."trait", '[^A-Za-z]', '', 'g'))
    ) AS trait,
    CASE
      WHEN h."ultraRareTraits" IS NULL THEN NULL
      WHEN h."ultraRareTraits" = '{"ultraRare": [], "exotic": []}'::jsonb THEN h."ultraRareTraits"
      ELSE '{"ultraRare": [], "exotic": []}'::jsonb
    END AS ultra_rare
  FROM "horses" h
)
UPDATE "horses" AS h
SET
  "epigeneticModifiers" = c.modifiers,
  "epigeneticFlags" = c.flags,
  "trait" = c.trait,
  "ultraRareTraits" = c.ultra_rare
FROM computed c
WHERE c."id" = h."id"
  AND (
    h."epigeneticModifiers" IS DISTINCT FROM c.modifiers
    OR h."epigeneticFlags" IS DISTINCT FROM c.flags
    OR h."trait" IS DISTINCT FROM c.trait
    OR h."ultraRareTraits" IS DISTINCT FROM c.ultra_rare
  );
