-- Equoria-b76x0 (owner ruling 2026-10-26): there is no stress in Equoria. The
-- code no longer reads or writes any of these columns, so they go.
--
-- Hand-written; one migration for every stress column:
--   horses.stressLevel                  (bond stays; only the stress value goes)
--   groom_interactions.stressChange
--   foal_development.stressLevel
--   foal_activities.stressChange
--   foal_training_history.stressChange
--   trait_history_logs.stressLevel
ALTER TABLE "horses" DROP COLUMN IF EXISTS "stressLevel";
ALTER TABLE "groom_interactions" DROP COLUMN IF EXISTS "stressChange";
ALTER TABLE "foal_development" DROP COLUMN IF EXISTS "stressLevel";
ALTER TABLE "foal_activities" DROP COLUMN IF EXISTS "stressChange";
ALTER TABLE "foal_training_history" DROP COLUMN IF EXISTS "stressChange";
ALTER TABLE "trait_history_logs" DROP COLUMN IF EXISTS "stressLevel";

-- The "Stress Whisperer" talent no longer exists. A groom that had picked it
-- keeps its other talents; the tier-2 slot is free to choose again.
UPDATE "groom_talent_selections" SET "tier2" = NULL WHERE "tier2" = 'stress_whisperer';
