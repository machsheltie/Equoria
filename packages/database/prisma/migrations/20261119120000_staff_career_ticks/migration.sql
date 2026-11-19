-- Equoria-puj1e.5 (Codex r2 #2/#3, 2026-11-19): per-row evidence for the weekly
-- staff career passes, so an outage time-back gives back only the career weeks
-- a pass actually added. Additive only: two new tables, no backfill (the passes
-- before this migration left no per-row record). Old code ignores both tables.

-- CreateTable: one row per career week added to one groom, rider or trainer.
CREATE TABLE "staff_career_ticks" (
    "id" SERIAL NOT NULL,
    "staffKind" TEXT NOT NULL,
    "staffId" INTEGER NOT NULL,
    "tickedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_career_ticks_pkey" PRIMARY KEY ("id")
);

-- CreateTable: one row (id 1), since when the ledger above is complete.
CREATE TABLE "staff_career_tick_ledger" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "completeSince" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_career_tick_ledger_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "staff_career_tick_ledger_single_row" CHECK ("id" = 1)
);

-- CreateIndex
CREATE INDEX "staff_career_ticks_staffKind_tickedAt_idx" ON "staff_career_ticks"("staffKind", "tickedAt");

-- The ledger is complete from now on (UTC, like every timestamp column here).
INSERT INTO "staff_career_tick_ledger" ("id", "completeSince")
VALUES (1, (now() AT TIME ZONE 'UTC'));
