-- Equoria-c7mx0.1 — owner ruling 2026-10-23 (Stacey): quarantine a show after
-- 3 failed execution attempts. Migration approved: a 'quarantined' ShowStatus
-- value and an execution-attempts counter on Show.
--
-- Before this, a show whose re-drive crashed the executor every cycle was
-- released back to 'open' and retried by the show-execution reaper every ~2.5h
-- forever. The reaper counts each failed attempt in executionAttempts; at 3 it
-- sets the show 'quarantined', which no executor or reaper scan selects, and
-- Owner/Admin resolve it from a staff list. Escrow is untouched by quarantine.
--
-- ADD VALUE only appends to the enum; no existing row or default changes. The
-- new value is not used anywhere in this migration (PostgreSQL forbids using an
-- enum value in the transaction that added it).

-- AlterEnum
ALTER TYPE "ShowStatus" ADD VALUE 'quarantined';

-- AlterTable
ALTER TABLE "shows" ADD COLUMN "executionAttempts" INTEGER NOT NULL DEFAULT 0;
