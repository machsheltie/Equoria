/*
  Warnings:

  - You are about to drop the column `ownerId` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `playerId` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `playerId` on the `groom_assignments` table. All the data in the column will be lost.
  - You are about to drop the column `playerId` on the `grooms` table. All the data in the column will be lost.
  - You are about to drop the column `playerId` on the `xp_events` table. All the data in the column will be lost.
  - You are about to drop the `players` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `userId` to the `Horse` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `xp_events` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Horse" DROP CONSTRAINT "Horse_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "Horse" DROP CONSTRAINT "Horse_playerId_fkey";

-- DropForeignKey
ALTER TABLE "groom_assignments" DROP CONSTRAINT "groom_assignments_playerId_fkey";

-- DropForeignKey
ALTER TABLE "grooms" DROP CONSTRAINT "grooms_playerId_fkey";

-- DropForeignKey
ALTER TABLE "xp_events" DROP CONSTRAINT "xp_events_playerId_fkey";

-- DropIndex
DROP INDEX "xp_events_playerId_idx";

-- DropIndex
DROP INDEX "xp_events_playerId_timestamp_idx";

-- AlterTable
ALTER TABLE "Horse" DROP COLUMN "ownerId",
DROP COLUMN "playerId",
ADD COLUMN     "userId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "groom_assignments" DROP COLUMN "playerId",
ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "grooms" DROP COLUMN "playerId",
ADD COLUMN     "userId" INTEGER;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "money" INTEGER NOT NULL DEFAULT 1000,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "settings" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "xp" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "xp_events" DROP COLUMN "playerId",
ADD COLUMN     "userId" INTEGER NOT NULL;

-- DropTable
DROP TABLE "players";

-- CreateIndex
CREATE INDEX "xp_events_userId_idx" ON "xp_events"("userId");

-- CreateIndex
CREATE INDEX "xp_events_userId_timestamp_idx" ON "xp_events"("userId", "timestamp");

-- AddForeignKey
ALTER TABLE "Horse" ADD CONSTRAINT "Horse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grooms" ADD CONSTRAINT "grooms_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groom_assignments" ADD CONSTRAINT "groom_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
