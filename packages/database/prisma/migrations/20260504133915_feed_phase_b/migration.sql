-- AlterTable
ALTER TABLE "horses" ADD COLUMN     "inFoalSinceDate" TIMESTAMP(3),
ADD COLUMN     "pregnancyFeedingsByTier" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "pregnancySireId" INTEGER;
