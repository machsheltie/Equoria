-- Add consecutiveDaysFoalCare field for foal streak tracking
-- This field tracks consecutive days of foal care for streak-based bonuses and burnout immunity

-- AlterTable
ALTER TABLE "horses" ADD COLUMN "consecutiveDaysFoalCare" INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN "horses"."consecutiveDaysFoalCare" IS 'Tracks consecutive days of foal care for streak bonuses and burnout immunity';
COMMENT ON COLUMN "horses"."taskLog" IS 'JSON object storing foal task repetition history for trait evaluation';
COMMENT ON COLUMN "horses"."lastGroomed" IS 'Timestamp of last care/grooming session for streak tracking and grace period logic';
