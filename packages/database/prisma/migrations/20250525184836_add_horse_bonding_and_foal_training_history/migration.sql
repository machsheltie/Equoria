-- AlterTable
ALTER TABLE "Horse" ADD COLUMN     "bond_score" INTEGER DEFAULT 50,
ADD COLUMN     "stress_level" INTEGER DEFAULT 0;

-- CreateTable
CREATE TABLE "foal_training_history" (
    "id" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "activity" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "bond_change" INTEGER NOT NULL DEFAULT 0,
    "stress_change" INTEGER NOT NULL DEFAULT 0,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "horse_id" INTEGER NOT NULL,

    CONSTRAINT "foal_training_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "foal_training_history_horse_id_idx" ON "foal_training_history"("horse_id");

-- CreateIndex
CREATE INDEX "foal_training_history_day_idx" ON "foal_training_history"("day");

-- CreateIndex
CREATE INDEX "foal_training_history_timestamp_idx" ON "foal_training_history"("timestamp");

-- CreateIndex
CREATE INDEX "foal_training_history_horse_id_day_idx" ON "foal_training_history"("horse_id", "day");

-- AddForeignKey
ALTER TABLE "foal_training_history" ADD CONSTRAINT "foal_training_history_horse_id_fkey" FOREIGN KEY ("horse_id") REFERENCES "Horse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
