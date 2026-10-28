-- Owner ruling 2026-10-28 (Equoria-nawn5): riders, trainers and grooms all use five star
-- levels - rookie (1 star, 100), novice (2, 200), intermediate (3, 300), advanced (4, 400),
-- expert (5, 500). Riders and grooms are priced per week, trainers per session, and the
-- price comes from the level. One column per staff table holds the level; the table of
-- stars, labels and prices lives in backend/constants/staffLevels.mjs.
--
-- Backfill: every existing row is placed from its old skill word. A tier that maps to two
-- levels is split by where the row's old price sat in that tier's old range (grooms: years
-- of experience). Kept in step with legacyStaffLevel() in backend/constants/staffLevels.mjs.
--   riders:   rookie -> rookie (< 225) | novice;  developing -> intermediate (< 400) | advanced;
--             experienced -> expert
--   trainers: novice -> rookie (< 150) | novice;  developing -> intermediate (< 275) | advanced;
--             expert -> expert
--   grooms:   novice -> rookie (experience < 3) | novice;  intermediate -> intermediate;
--             expert -> advanced;  master -> expert
--   any other word -> rookie
-- No price column is changed: staff already hired keep the price they were hired at until
-- the owner answers q226 (see alreadyHiredStaffKeepTheirPrice).

ALTER TABLE "riders" ADD COLUMN "starLevel" TEXT NOT NULL DEFAULT 'rookie';
ALTER TABLE "trainers" ADD COLUMN "starLevel" TEXT NOT NULL DEFAULT 'rookie';
ALTER TABLE "grooms" ADD COLUMN "starLevel" TEXT NOT NULL DEFAULT 'rookie';

UPDATE "riders" SET "starLevel" = CASE
    WHEN "skillLevel" = 'rookie' AND "weeklyRate" >= 225 THEN 'novice'
    WHEN "skillLevel" = 'rookie' THEN 'rookie'
    WHEN "skillLevel" = 'developing' AND "weeklyRate" >= 400 THEN 'advanced'
    WHEN "skillLevel" = 'developing' THEN 'intermediate'
    WHEN "skillLevel" = 'experienced' THEN 'expert'
    ELSE 'rookie'
END;

UPDATE "trainers" SET "starLevel" = CASE
    WHEN "skillLevel" = 'novice' AND "sessionRate" >= 150 THEN 'novice'
    WHEN "skillLevel" = 'novice' THEN 'rookie'
    WHEN "skillLevel" = 'developing' AND "sessionRate" >= 275 THEN 'advanced'
    WHEN "skillLevel" = 'developing' THEN 'intermediate'
    WHEN "skillLevel" = 'expert' THEN 'expert'
    ELSE 'rookie'
END;

UPDATE "grooms" SET "starLevel" = CASE
    WHEN "skillLevel" = 'novice' AND "experience" >= 3 THEN 'novice'
    WHEN "skillLevel" = 'novice' THEN 'rookie'
    WHEN "skillLevel" = 'intermediate' THEN 'intermediate'
    WHEN "skillLevel" = 'expert' THEN 'advanced'
    WHEN "skillLevel" = 'master' THEN 'expert'
    ELSE 'rookie'
END;

-- Only the five levels may be stored. Prisma cannot express CHECK constraints; they live
-- only in this SQL (do not "restore" them in schema.prisma).
ALTER TABLE "riders" ADD CONSTRAINT "riders_star_level_check"
    CHECK ("starLevel" IN ('rookie', 'novice', 'intermediate', 'advanced', 'expert'));
ALTER TABLE "trainers" ADD CONSTRAINT "trainers_star_level_check"
    CHECK ("starLevel" IN ('rookie', 'novice', 'intermediate', 'advanced', 'expert'));
ALTER TABLE "grooms" ADD CONSTRAINT "grooms_star_level_check"
    CHECK ("starLevel" IN ('rookie', 'novice', 'intermediate', 'advanced', 'expert'));
