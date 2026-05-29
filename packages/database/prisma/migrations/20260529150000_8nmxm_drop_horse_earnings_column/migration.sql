-- Equoria-8nmxm: drop the dead Horse.earnings (Decimal) column.
--
-- Pre-fix state: schema.prisma had BOTH `earnings Decimal? @default(0)`
-- (line 213) AND `totalEarnings Int? @default(0)` (line 182) on the Horse
-- model. The production writer (updateHorseEarnings in backend/utils/
-- horseUpdates.mjs, called via updateHorseRewards from competitionController)
-- wrote to Horse.earnings. The production readers (leaderboard summaries,
-- horseController, frontend Hall-of-Fame) read Horse.totalEarnings. Result:
-- the column the readers consume was NEVER WRITTEN — all 259 horses had
-- earnings=0 AND totalEarnings=0 in the canonical DB at the time this
-- migration shipped.
--
-- The companion code commit re-aims the writer at Horse.totalEarnings,
-- which is the column name the leaderboards and frontend always intended.
-- This migration drops the now-orphan Decimal column.
--
-- Data safety: pre-migration `SELECT MAX(earnings)` returned 0 across all
-- 259 rows. There is no data to lose.

ALTER TABLE "horses" DROP COLUMN "earnings";
