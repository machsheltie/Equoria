-- CreateEnum
CREATE TYPE "ShowStatus" AS ENUM ('open', 'closed', 'executing', 'completed');

-- CreateEnum
CREATE TYPE "AgeStage" AS ENUM ('newborn', 'weanling', 'yearling', 'two_year_old');

-- AlterTable
ALTER TABLE "foal_development" ADD COLUMN     "ageStage" "AgeStage" NOT NULL DEFAULT 'newborn',
ADD COLUMN     "bondScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "completedMilestones" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "horseId" INTEGER,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastInteractionAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "shows" ADD COLUMN     "closeDate" TIMESTAMP(3),
ADD COLUMN     "createdByClubId" INTEGER,
ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "executedAt" TIMESTAMP(3),
ADD COLUMN     "maxEntries" INTEGER,
ADD COLUMN     "openDate" TIMESTAMP(3),
ADD COLUMN     "status" "ShowStatus" NOT NULL DEFAULT 'open';

-- CreateTable
CREATE TABLE "show_entries" (
    "id" SERIAL NOT NULL,
    "showId" INTEGER NOT NULL,
    "horseId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "feePaid" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "show_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "show_entries_showId_idx" ON "show_entries"("showId");

-- CreateIndex
CREATE INDEX "show_entries_horseId_idx" ON "show_entries"("horseId");

-- CreateIndex
CREATE INDEX "show_entries_userId_idx" ON "show_entries"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "show_entries_showId_horseId_key" ON "show_entries"("showId", "horseId");

-- CreateIndex
CREATE INDEX "foal_development_isActive_idx" ON "foal_development"("isActive");

-- CreateIndex
CREATE INDEX "shows_status_idx" ON "shows"("status");

-- CreateIndex
CREATE INDEX "shows_closeDate_idx" ON "shows"("closeDate");

-- AddForeignKey
ALTER TABLE "shows" ADD CONSTRAINT "shows_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "show_entries" ADD CONSTRAINT "show_entries_showId_fkey" FOREIGN KEY ("showId") REFERENCES "shows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "show_entries" ADD CONSTRAINT "show_entries_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "horses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "show_entries" ADD CONSTRAINT "show_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
