-- AlterTable
ALTER TABLE "grooms" ADD COLUMN     "bonusTraitMap" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "milestone_trait_logs" ADD COLUMN     "personalityEffectApplied" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "personalityMatchScore" INTEGER NOT NULL DEFAULT 0;
