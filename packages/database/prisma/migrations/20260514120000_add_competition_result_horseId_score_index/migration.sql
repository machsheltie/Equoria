-- Add covering index on competition_results (horseId, score)
-- Equoria-9jcq: Improves getUserRankSummary and competition history queries
-- that filter by horseId and order/compare by score.
CREATE INDEX IF NOT EXISTS "competition_results_horseId_score_idx"
  ON "competition_results"("horseId", "score");
