-- Owner rulings 2026-10-29 (Equoria-waqkr):
--   q282  The riders' old skill word (rookie | developing | experienced) is retired;
--         the star level ("starLevel") is a rider's only level.
--   q283  A rider has no visible speciality discipline; disciplines are learned only
--         through growth (the hidden affinities in rider_growth_profiles).
--
-- Both columns go. Trainers and grooms keep their own "skillLevel" and "speciality"
-- columns (not part of these rulings). Nothing else references these two rider
-- columns (no index, constraint or view).

ALTER TABLE "riders" DROP COLUMN IF EXISTS "skillLevel";
ALTER TABLE "riders" DROP COLUMN IF EXISTS "speciality";
