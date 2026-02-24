-- AlterTable
ALTER TABLE "horses" ADD COLUMN     "currentFeed" TEXT DEFAULT 'basic',
ADD COLUMN     "energyLevel" INTEGER DEFAULT 100,
ADD COLUMN     "hoofCondition" TEXT DEFAULT 'good',
ADD COLUMN     "lastFarrierDate" TIMESTAMP(3),
ADD COLUMN     "lastFedDate" TIMESTAMP(3),
ADD COLUMN     "lastShod" TIMESTAMP(3);
