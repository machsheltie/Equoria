-- Equoria-507mt: backfill NULLs (defensive, 0 NULLs observed pre-migration)
-- and SET NOT NULL on 19 horse stat / counter columns. Defaults stay at 0
-- (including bondScore — user chose 'unbonded' over 'neutral').
--
-- Companion code changes strip `?? 50` / `?? 0` reader-side defaults that
-- were guarding against NULLs now structurally impossible.

-- 12 base / competition stats
UPDATE "horses" SET "precision"     = COALESCE("precision", 0)     WHERE "precision"     IS NULL;
UPDATE "horses" SET "strength"      = COALESCE("strength", 0)      WHERE "strength"      IS NULL;
UPDATE "horses" SET "speed"         = COALESCE("speed", 0)         WHERE "speed"         IS NULL;
UPDATE "horses" SET "agility"       = COALESCE("agility", 0)       WHERE "agility"       IS NULL;
UPDATE "horses" SET "endurance"     = COALESCE("endurance", 0)     WHERE "endurance"     IS NULL;
UPDATE "horses" SET "intelligence"  = COALESCE("intelligence", 0)  WHERE "intelligence"  IS NULL;
UPDATE "horses" SET "stamina"       = COALESCE("stamina", 0)       WHERE "stamina"       IS NULL;
UPDATE "horses" SET "balance"       = COALESCE("balance", 0)       WHERE "balance"       IS NULL;
UPDATE "horses" SET "boldness"      = COALESCE("boldness", 0)      WHERE "boldness"      IS NULL;
UPDATE "horses" SET "flexibility"   = COALESCE("flexibility", 0)   WHERE "flexibility"   IS NULL;
UPDATE "horses" SET "obedience"     = COALESCE("obedience", 0)     WHERE "obedience"     IS NULL;
UPDATE "horses" SET "focus"         = COALESCE("focus", 0)         WHERE "focus"         IS NULL;

ALTER TABLE "horses" ALTER COLUMN "precision"     SET NOT NULL;
ALTER TABLE "horses" ALTER COLUMN "strength"      SET NOT NULL;
ALTER TABLE "horses" ALTER COLUMN "speed"         SET NOT NULL;
ALTER TABLE "horses" ALTER COLUMN "agility"       SET NOT NULL;
ALTER TABLE "horses" ALTER COLUMN "endurance"     SET NOT NULL;
ALTER TABLE "horses" ALTER COLUMN "intelligence"  SET NOT NULL;
ALTER TABLE "horses" ALTER COLUMN "stamina"       SET NOT NULL;
ALTER TABLE "horses" ALTER COLUMN "balance"       SET NOT NULL;
ALTER TABLE "horses" ALTER COLUMN "boldness"      SET NOT NULL;
ALTER TABLE "horses" ALTER COLUMN "flexibility"   SET NOT NULL;
ALTER TABLE "horses" ALTER COLUMN "obedience"     SET NOT NULL;
ALTER TABLE "horses" ALTER COLUMN "focus"         SET NOT NULL;

-- 7 financial / bond / progression counters
UPDATE "horses" SET "totalEarnings"           = COALESCE("totalEarnings", 0)           WHERE "totalEarnings"           IS NULL;
UPDATE "horses" SET "bondScore"               = COALESCE("bondScore", 0)               WHERE "bondScore"               IS NULL;
UPDATE "horses" SET "stressLevel"             = COALESCE("stressLevel", 0)             WHERE "stressLevel"             IS NULL;
UPDATE "horses" SET "daysGroomedInARow"       = COALESCE("daysGroomedInARow", 0)       WHERE "daysGroomedInARow"       IS NULL;
UPDATE "horses" SET "consecutiveDaysFoalCare" = COALESCE("consecutiveDaysFoalCare", 0) WHERE "consecutiveDaysFoalCare" IS NULL;
UPDATE "horses" SET "horseXp"                 = COALESCE("horseXp", 0)                 WHERE "horseXp"                 IS NULL;
UPDATE "horses" SET "availableStatPoints"     = COALESCE("availableStatPoints", 0)     WHERE "availableStatPoints"     IS NULL;

ALTER TABLE "horses" ALTER COLUMN "totalEarnings"           SET NOT NULL;
ALTER TABLE "horses" ALTER COLUMN "bondScore"               SET NOT NULL;
ALTER TABLE "horses" ALTER COLUMN "stressLevel"             SET NOT NULL;
ALTER TABLE "horses" ALTER COLUMN "daysGroomedInARow"       SET NOT NULL;
ALTER TABLE "horses" ALTER COLUMN "consecutiveDaysFoalCare" SET NOT NULL;
ALTER TABLE "horses" ALTER COLUMN "horseXp"                 SET NOT NULL;
ALTER TABLE "horses" ALTER COLUMN "availableStatPoints"     SET NOT NULL;
