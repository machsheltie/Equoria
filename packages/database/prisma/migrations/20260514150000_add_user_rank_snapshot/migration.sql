-- Equoria-uptj: Add UserRankSnapshot table for week-over-week rank delta
-- Category values: 'level', 'xp', 'horse-earnings', 'horse-performance'
CREATE TABLE IF NOT EXISTS "user_rank_snapshots" (
  "id"         SERIAL PRIMARY KEY,
  "userId"     TEXT NOT NULL,
  "category"   TEXT NOT NULL,
  "rank"       INTEGER NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_rank_snapshots_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "user_rank_snapshots_userId_category_capturedAt_idx"
  ON "user_rank_snapshots"("userId", "category", "capturedAt" DESC);
