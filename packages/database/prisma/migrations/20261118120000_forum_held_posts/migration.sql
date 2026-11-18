-- Equoria-puj1e.3 (owner rulings q375 and q376, 2026-11-18): content moderation.
-- A forum post can be held for a moderator. A held post is shown only to its
-- author, marked as awaiting a moderator; nobody else sees it until a moderator
-- accepts it. A thread whose opening post is held is held with it.
--
-- Additive only: two columns with a constant default and one index.
--   "ForumThread"."status"  published | held
--   "ForumPost"."status"    published | held
-- Every existing row becomes 'published', so every reader that filters on
-- status sees exactly what it saw before. On PostgreSQL 11+ adding a column
-- with a constant default is a catalog change, not a table rewrite.
--
-- Old code ignores both columns and keeps working (it never writes 'held').
-- Rollback: drop the index and the two columns; no data other than the held
-- state is lost.

ALTER TABLE "ForumThread" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'published';

ALTER TABLE "ForumPost" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'published';

CREATE INDEX "ForumPost_status_createdAt_idx" ON "ForumPost"("status", "createdAt");
