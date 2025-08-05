-- AlterTable
ALTER TABLE "grooms" ADD COLUMN     "careerWeeks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "retired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "retirementReason" TEXT,
ADD COLUMN     "retirementTimestamp" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "groom_legacy_logs" (
    "id" SERIAL NOT NULL,
    "retiredGroomId" INTEGER NOT NULL,
    "legacyGroomId" INTEGER NOT NULL,
    "inheritedPerk" TEXT NOT NULL,
    "mentorLevel" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "groom_legacy_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groom_talent_selections" (
    "id" SERIAL NOT NULL,
    "groomId" INTEGER NOT NULL,
    "tier1" TEXT,
    "tier2" TEXT,
    "tier3" TEXT,

    CONSTRAINT "groom_talent_selections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "groom_legacy_logs_retiredGroomId_idx" ON "groom_legacy_logs"("retiredGroomId");

-- CreateIndex
CREATE INDEX "groom_legacy_logs_legacyGroomId_idx" ON "groom_legacy_logs"("legacyGroomId");

-- CreateIndex
CREATE UNIQUE INDEX "groom_talent_selections_groomId_key" ON "groom_talent_selections"("groomId");

-- CreateIndex
CREATE INDEX "groom_talent_selections_groomId_idx" ON "groom_talent_selections"("groomId");

-- CreateIndex
CREATE INDEX "grooms_careerWeeks_idx" ON "grooms"("careerWeeks");

-- CreateIndex
CREATE INDEX "grooms_retired_idx" ON "grooms"("retired");

-- CreateIndex
CREATE INDEX "grooms_retired_careerWeeks_idx" ON "grooms"("retired", "careerWeeks");

-- AddForeignKey
ALTER TABLE "groom_legacy_logs" ADD CONSTRAINT "groom_legacy_logs_retiredGroomId_fkey" FOREIGN KEY ("retiredGroomId") REFERENCES "grooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groom_legacy_logs" ADD CONSTRAINT "groom_legacy_logs_legacyGroomId_fkey" FOREIGN KEY ("legacyGroomId") REFERENCES "grooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groom_talent_selections" ADD CONSTRAINT "groom_talent_selections_groomId_fkey" FOREIGN KEY ("groomId") REFERENCES "grooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
