/*
  Warnings:

  - You are about to drop the column `showHandlingSkill` on the `grooms` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "grooms" DROP COLUMN "showHandlingSkill";

-- AlterTable
ALTER TABLE "horses" ADD COLUMN     "breedingValueBoost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "currentTitle" TEXT,
ADD COLUMN     "titlePoints" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "conformationScores" SET DEFAULT '{"head": 20, "neck": 20, "shoulders": 20, "back": 20, "legs": 20, "hooves": 20, "topline": 20, "hindquarters": 20, "overallConformation": 20}';
