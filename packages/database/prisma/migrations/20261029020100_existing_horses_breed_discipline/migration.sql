-- Existing horses get their breed's discipline trait (Equoria-n7ph5).
--
-- Owner rulings 2026-10-20 (round 2 Q4, answer A) and 2026-10-21: every horse has exactly
-- one discipline trait, always visible, worth +5 in that discipline. New horses are born
-- with it (backend/modules/horses/services/birthDiscipline.mjs, migration
-- 20261028150000_breed_default_disciplines for the approved per-breed list, q232). A horse
-- made before then and holding no discipline value at all gets its breed's default now.
--
-- The value lives where training writes it and show scoring reads it,
-- horses."disciplineScores"[discipline] = 5 (the same +5 a week of training gives).
-- A horse that already holds a positive value in any of the 24 disciplines already has
-- its discipline (the highest one, as the foal inheritance reads it) and is left alone.
--
-- The breed default mirrors breedDefaultDiscipline(): a gaited breed
-- (breedGeneticProfile.ratingProfiles.isGaitedBreed = true) is always Gaited; any other
-- breed takes breeds."defaultTrait" when it names one of the other 23 disciplines; a breed
-- with no such default gives nothing. Horses with no breed are left alone.
--
-- Data only. Re-running it changes nothing: every horse it touches then holds a +5.

WITH disciplines(name) AS (
  VALUES
    ('Racing'), ('Show Jumping'), ('Dressage'), ('Cross Country'), ('Western Pleasure'),
    ('Reining'), ('Cutting'), ('Barrel Racing'), ('Roping'), ('Team Penning'), ('Rodeo'),
    ('Hunter'), ('Saddleseat'), ('Endurance'), ('Eventing'), ('Vaulting'), ('Polo'),
    ('Combined Driving'), ('Fine Harness'), ('Gaited'), ('Gymkhana'), ('Steeplechase'),
    ('Harness Racing'), ('Pleasure Driving')
),
breed_default AS (
  SELECT
    b.id AS "breedId",
    CASE
      WHEN b."breedGeneticProfile" -> 'ratingProfiles' -> 'isGaitedBreed' = 'true'::jsonb
        THEN 'Gaited'
      WHEN b."defaultTrait" <> 'Gaited'
        AND b."defaultTrait" IN (SELECT name FROM disciplines)
        THEN b."defaultTrait"
      ELSE NULL
    END AS discipline
  FROM "breeds" b
)
UPDATE "horses" AS h
SET "disciplineScores" =
  (CASE
     WHEN jsonb_typeof(h."disciplineScores") = 'object' THEN h."disciplineScores"
     ELSE '{}'::jsonb
   END) || jsonb_build_object(d.discipline, 5)
FROM breed_default d
WHERE h."breedId" = d."breedId"
  AND d.discipline IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_each(
      CASE
        WHEN jsonb_typeof(h."disciplineScores") = 'object' THEN h."disciplineScores"
        ELSE '{}'::jsonb
      END
    ) AS e(key, value)
    WHERE e.key IN (SELECT name FROM disciplines)
      AND jsonb_typeof(e.value) = 'number'
      AND (e.value)::text::numeric > 0
  );
