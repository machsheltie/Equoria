-- Equoria-ky2ob — owner ruling 2026-10-22 (Stacey): record each training
-- session's discipline score before and after the gain on its TrainingLog row,
-- so the horse's training history shows the real per-session change.
--
-- Additive only: two nullable columns on "training_logs". Every existing row
-- keeps NULL (the score at that time was never recorded); the training
-- transaction writes both values for every new session.
--   scoreBefore — the trained discipline's score just before the session
--   scoreAfter  — the trained discipline's score just after the session

-- AlterTable
ALTER TABLE "training_logs" ADD COLUMN     "scoreAfter" INTEGER,
ADD COLUMN     "scoreBefore" INTEGER;
