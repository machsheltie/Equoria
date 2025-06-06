/*
  Warnings:

  - Added the required column `showName` to the `competition_results` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Horse" ADD COLUMN     "earnings" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "rider" JSONB;

-- AlterTable
ALTER TABLE "competition_results" ADD COLUMN     "prizeWon" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "showName" TEXT NOT NULL,
ADD COLUMN     "statGains" JSONB;

-- AlterTable
ALTER TABLE "shows" ADD COLUMN     "hostUserId" TEXT; -- Changed from hostPlayer

-- Remove original hostPlayer column if it exists and is no longer needed --
-- ALTER TABLE "shows" DROP COLUMN IF EXISTS "hostPlayer"; --
