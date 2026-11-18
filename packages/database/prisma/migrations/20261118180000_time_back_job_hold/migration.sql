-- Equoria-puj1e.5 (owner rulings q377/q378, 2026-11-18): the durable nightly-job
-- hold, the outage time-back record with its change set, and purpose-bound
-- one-time staff codes. Additive only: one new column with a default, three new
-- tables. Old code ignores all of it; no backfill.

-- AlterTable: existing codes are browser check-in codes.
ALTER TABLE "staff_checkin_codes" ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'checkin';

-- CreateTable: one row (id 1) at most; no row means jobs run.
CREATE TABLE "game_control" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "jobsHeld" BOOLEAN NOT NULL DEFAULT false,
    "heldAt" TIMESTAMP(3),
    "heldById" TEXT,
    "reason" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_control_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "game_control_single_row" CHECK ("id" = 1)
);

-- CreateTable
CREATE TABLE "time_backs" (
    "id" SERIAL NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "pauseSeconds" INTEGER NOT NULL,
    "appliedById" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applyLogId" INTEGER,
    "summary" JSONB NOT NULL,
    "reversedAt" TIMESTAMP(3),
    "reversedById" TEXT,
    "reverseLogId" INTEGER,
    "reverseSummary" JSONB,

    CONSTRAINT "time_backs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_back_changes" (
    "id" SERIAL NOT NULL,
    "timeBackId" INTEGER NOT NULL,
    "tableName" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,

    CONSTRAINT "time_back_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "time_backs_windowStart_windowEnd_idx" ON "time_backs"("windowStart", "windowEnd");

-- CreateIndex
CREATE INDEX "time_back_changes_timeBackId_tableName_field_idx" ON "time_back_changes"("timeBackId", "tableName", "field");

-- CreateIndex
CREATE INDEX "staff_checkin_codes_userId_purpose_createdAt_idx" ON "staff_checkin_codes"("userId", "purpose", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "time_back_changes" ADD CONSTRAINT "time_back_changes_timeBackId_fkey" FOREIGN KEY ("timeBackId") REFERENCES "time_backs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
