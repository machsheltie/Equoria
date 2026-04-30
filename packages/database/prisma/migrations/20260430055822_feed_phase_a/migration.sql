-- AlterTable
ALTER TABLE "horses" DROP COLUMN "coordination",
DROP COLUMN "currentFeed",
DROP COLUMN "energyLevel",
ADD COLUMN     "equippedFeedType" TEXT;

