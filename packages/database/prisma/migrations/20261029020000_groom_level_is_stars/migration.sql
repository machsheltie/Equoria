-- Owner rulings 2026-10-28 (Equoria-2xxvd):
--   q229: grooms show only their star level. The old 1-10 "level" is replaced by the
--         star level behind the scenes too, so there is one level (as riders and
--         trainers were in 20261028180000_staff_level_is_stars).
--   q244: stars give no bonus for now. Everything that read the old level (talent
--         tiers, mentoring, compatibility, trait strength) now reads the constant old
--         level 1 (staffCareerLevel / staffCareerStarLevel in
--         backend/constants/staffLevels.mjs), which is where every game-made groom sat.
--
-- 1. The old level column and its index go. Grooms are fixed NPCs and never gained
--    levels after generation (owner ruling 2026-10-21); the star level
--    (20261028120000_staff_star_levels) already carries each groom's level.
-- 2. A legacy log's "mentorLevel" copied the mentor's old level; the mentor's star level
--    is read from the mentor row (retiredGroomId), so the copy goes too.

DROP INDEX IF EXISTS "grooms_level_idx";

ALTER TABLE "grooms" DROP COLUMN "level";
ALTER TABLE "groom_legacy_logs" DROP COLUMN "mentorLevel";
