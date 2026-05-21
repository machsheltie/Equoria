-- Equoria-rmkvk: DB-level uniqueness backstop for the executeClosedShows double-score race (atomic-claim fix Equoria-dyj3y).
-- Canonical-DB dup-check returned 0 duplicate (showId,horseId) groups before this migration (owner-approved 2026-05-21).
CREATE UNIQUE INDEX "competition_results_showId_horseId_key" ON "competition_results"("showId", "horseId");
