-- AlterTable
ALTER TABLE "horses" ADD COLUMN     "availableStatPoints" INTEGER DEFAULT 0,
ADD COLUMN     "horseXp" INTEGER DEFAULT 0;

-- CreateTable
CREATE TABLE "horse_xp_events" (
    "id" SERIAL NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "horseId" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "horse_xp_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "horse_xp_events_horseId_idx" ON "horse_xp_events"("horseId");

-- CreateIndex
CREATE INDEX "horse_xp_events_timestamp_idx" ON "horse_xp_events"("timestamp");

-- CreateIndex
CREATE INDEX "horse_xp_events_horseId_timestamp_idx" ON "horse_xp_events"("horseId", "timestamp");

-- AddForeignKey
ALTER TABLE "horse_xp_events" ADD CONSTRAINT "horse_xp_events_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "horses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
