-- Equoria-r9q06 - owner ruling q256 (2026-10-28): when a horse is sold, the
-- player who entered a show keeps that result in their totals. Each result now
-- records its entrant; player records read it instead of the horse's current
-- owner.
--
-- Backfill: the entry row of the same show and horse names the entrant; a
-- result without one (an entry erased since) takes the horse's owner at
-- migration time, which is the only record left. No player besides the owner
-- has entered shows yet (owner, 2026-10-07), so nothing is misattributed.

ALTER TABLE "competition_results" ADD COLUMN "entrantUserId" TEXT;

UPDATE "competition_results" AS r
SET "entrantUserId" = e."userId"
FROM "show_entries" AS e
WHERE e."showId" = r."showId" AND e."horseId" = r."horseId";

UPDATE "competition_results" AS r
SET "entrantUserId" = h."userId"
FROM "horses" AS h
WHERE r."entrantUserId" IS NULL AND h."id" = r."horseId";

ALTER TABLE "competition_results"
  ADD CONSTRAINT "competition_results_entrantUserId_fkey"
  FOREIGN KEY ("entrantUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "competition_results_entrantUserId_runDate_idx"
  ON "competition_results"("entrantUserId", "runDate" DESC);
