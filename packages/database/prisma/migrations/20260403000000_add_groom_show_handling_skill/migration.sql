-- AddColumn: showHandlingSkill to Groom model (Epic 31F prerequisite)
-- Values: novice | competent | skilled | expert | master
-- Used in 31F-1 conformation show scoring formula (handler weight: 20%)
ALTER TABLE "grooms" ADD COLUMN IF NOT EXISTS "showHandlingSkill" TEXT NOT NULL DEFAULT 'novice';
