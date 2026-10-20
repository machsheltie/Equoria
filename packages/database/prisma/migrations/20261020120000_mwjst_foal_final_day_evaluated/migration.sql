-- Equoria-mwjst (Codex Sol review 2026-10-20, finding 1; owner ruling
-- 2026-10-20: a separate "finished" marker, the development day stays 6).
--
-- WHY
--   The nightly trait job advances FoalDevelopment.currentDay after evaluating
--   each day, but stops at 6, the final day. Nothing recorded that day 6 had
--   been evaluated, so every later night rolled day 6 again.
--
-- WHAT THIS CHANGES
--   Adds a nullable timestamp. The job sets it, in the same transaction as the
--   day-6 reveals, and skips any foal that has it.
--
-- SAFETY
--   Additive and nullable: no backfill, no rewrite, no lock beyond the brief
--   ALTER. Code that predates the column ignores it. Production had no
--   foal_development rows on 2026-10-20 (read-only count), so no foal needs a
--   backfilled value.

ALTER TABLE "foal_development" ADD COLUMN "finalDayEvaluatedAt" TIMESTAMP(3);
