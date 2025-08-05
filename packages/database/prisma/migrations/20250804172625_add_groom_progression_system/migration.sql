-- AlterTable
ALTER TABLE "grooms" ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "experience" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "groom_horse_synergies" (
    "id" SERIAL NOT NULL,
    "groomId" INTEGER NOT NULL,
    "horseId" INTEGER NOT NULL,
    "synergyScore" INTEGER NOT NULL DEFAULT 0,
    "sessionsTogether" INTEGER NOT NULL DEFAULT 0,
    "lastAssignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groom_horse_synergies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groom_assignment_logs" (
    "id" SERIAL NOT NULL,
    "groomId" INTEGER NOT NULL,
    "horseId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),
    "milestonesCompleted" INTEGER NOT NULL DEFAULT 0,
    "traitsShaped" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "xpGained" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groom_assignment_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "groom_horse_synergies_groomId_idx" ON "groom_horse_synergies"("groomId");

-- CreateIndex
CREATE INDEX "groom_horse_synergies_horseId_idx" ON "groom_horse_synergies"("horseId");

-- CreateIndex
CREATE INDEX "groom_horse_synergies_synergyScore_idx" ON "groom_horse_synergies"("synergyScore");

-- CreateIndex
CREATE UNIQUE INDEX "groom_horse_synergies_groomId_horseId_key" ON "groom_horse_synergies"("groomId", "horseId");

-- CreateIndex
CREATE INDEX "groom_assignment_logs_groomId_idx" ON "groom_assignment_logs"("groomId");

-- CreateIndex
CREATE INDEX "groom_assignment_logs_horseId_idx" ON "groom_assignment_logs"("horseId");

-- CreateIndex
CREATE INDEX "groom_assignment_logs_assignedAt_idx" ON "groom_assignment_logs"("assignedAt");

-- CreateIndex
CREATE INDEX "groom_assignment_logs_groomId_assignedAt_idx" ON "groom_assignment_logs"("groomId", "assignedAt");

-- CreateIndex
CREATE INDEX "grooms_level_idx" ON "grooms"("level");

-- CreateIndex
CREATE INDEX "grooms_experience_idx" ON "grooms"("experience");

-- AddForeignKey
ALTER TABLE "groom_horse_synergies" ADD CONSTRAINT "groom_horse_synergies_groomId_fkey" FOREIGN KEY ("groomId") REFERENCES "grooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groom_horse_synergies" ADD CONSTRAINT "groom_horse_synergies_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "horses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groom_assignment_logs" ADD CONSTRAINT "groom_assignment_logs_groomId_fkey" FOREIGN KEY ("groomId") REFERENCES "grooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groom_assignment_logs" ADD CONSTRAINT "groom_assignment_logs_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "horses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
