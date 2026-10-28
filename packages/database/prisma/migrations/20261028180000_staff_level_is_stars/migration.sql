-- Owner rulings 2026-10-28 (Equoria-nawn5):
--   q229: riders and trainers show only their star level. The old 1-10 "level" is
--         replaced by the star level behind the scenes too, so there is one level.
--   q226: staff already hired pay their star level's price now.
--
-- 1. The price columns are brought in line with the star level, so the stored rate and
--    the charged price can never disagree (the code charges the level price either way;
--    see hiredStaffFee in backend/constants/staffLevels.mjs). Rookie 100, Novice 200,
--    Intermediate 300, Advanced 400, Expert 500.
-- 2. The old level column goes. Staff are fixed NPCs and never gained levels after
--    generation (owner ruling 2026-10-21), and every rider and trainer was generated at
--    level 1, so the column carried no information the star level does not.

UPDATE "riders" SET "weeklyRate" = CASE "starLevel"
    WHEN 'rookie' THEN 100
    WHEN 'novice' THEN 200
    WHEN 'intermediate' THEN 300
    WHEN 'advanced' THEN 400
    WHEN 'expert' THEN 500
END;

UPDATE "trainers" SET "sessionRate" = CASE "starLevel"
    WHEN 'rookie' THEN 100
    WHEN 'novice' THEN 200
    WHEN 'intermediate' THEN 300
    WHEN 'advanced' THEN 400
    WHEN 'expert' THEN 500
END;

DROP INDEX IF EXISTS "riders_level_idx";
DROP INDEX IF EXISTS "trainers_level_idx";

ALTER TABLE "riders" DROP COLUMN "level";
ALTER TABLE "trainers" DROP COLUMN "level";
