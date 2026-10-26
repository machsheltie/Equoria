-- Owner ruling 2026-10-26 (q64): approved the safe speed-up indexes (Equoria-cmw85.7,
-- .23, .24 (mares in foal only), .25, .26, .36 and Equoria-lffdv). Not added, by the
-- same ruling: the Horse earnings and age indexes (cmw85.24), and the User
-- (level, xp) leaderboard index (cmw85.26), because the leaderboard now orders by
-- xp alone and User.xp is already indexed.
--
-- Additive except where an index is replaced by a wider one that serves every query the
-- old one did (its leftmost columns): riders/trainers (userId) and (retired),
-- groom_interactions (foalId), shows (status), horse_sales (sellerId) and (buyerId).
-- Each replaced index is dropped AFTER its replacement is created. IF [NOT] EXISTS keeps
-- the file safe to re-run on a database that already carries some of them.
--
-- Locking: CREATE INDEX blocks writes to its table while it builds. The largest table
-- here is competition_results (about 500k rows at beta scale); its three builds take
-- seconds. Run it at a quiet moment.

-- TrainingLog (cmw85.7): the training-eligibility checks read a horse's latest session.
CREATE INDEX IF NOT EXISTS "training_logs_horseId_discipline_trainedAt_idx"
  ON "training_logs" ("horseId", "discipline", "trainedAt" DESC);
CREATE INDEX IF NOT EXISTS "training_logs_horseId_trainedAt_idx"
  ON "training_logs" ("horseId", "trainedAt" DESC);

-- CompetitionResult (cmw85.23): horse history and the date-ranged leaderboard reads.
CREATE INDEX IF NOT EXISTS "competition_results_horseId_runDate_idx"
  ON "competition_results" ("horseId", "runDate" DESC);
CREATE INDEX IF NOT EXISTS "competition_results_discipline_runDate_idx"
  ON "competition_results" ("discipline", "runDate");
CREATE INDEX IF NOT EXISTS "competition_results_placement_runDate_idx"
  ON "competition_results" ("placement", "runDate" DESC);

-- Staff domain (cmw85.25).
CREATE INDEX IF NOT EXISTS "groom_assignments_userId_createdAt_idx"
  ON "groom_assignments" ("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "groom_interactions_foalId_timestamp_idx"
  ON "groom_interactions" ("foalId", "timestamp");
DROP INDEX IF EXISTS "groom_interactions_foalId_idx";

CREATE INDEX IF NOT EXISTS "riders_userId_retired_idx" ON "riders" ("userId", "retired");
CREATE INDEX IF NOT EXISTS "riders_retired_careerWeeks_idx" ON "riders" ("retired", "careerWeeks");
DROP INDEX IF EXISTS "riders_userId_idx";
DROP INDEX IF EXISTS "riders_retired_idx";

CREATE INDEX IF NOT EXISTS "trainers_userId_retired_idx" ON "trainers" ("userId", "retired");
CREATE INDEX IF NOT EXISTS "trainers_retired_careerWeeks_idx" ON "trainers" ("retired", "careerWeeks");
DROP INDEX IF EXISTS "trainers_userId_idx";
DROP INDEX IF EXISTS "trainers_retired_idx";

-- Show and HorseSale (cmw85.26).
CREATE INDEX IF NOT EXISTS "shows_status_runDate_idx" ON "shows" ("status", "runDate");
CREATE INDEX IF NOT EXISTS "shows_runDate_idx" ON "shows" ("runDate");
DROP INDEX IF EXISTS "shows_status_idx";

CREATE INDEX IF NOT EXISTS "horse_sales_sellerId_soldAt_idx" ON "horse_sales" ("sellerId", "soldAt" DESC);
CREATE INDEX IF NOT EXISTS "horse_sales_buyerId_soldAt_idx" ON "horse_sales" ("buyerId", "soldAt" DESC);
DROP INDEX IF EXISTS "horse_sales_sellerId_idx";
DROP INDEX IF EXISTS "horse_sales_buyerId_idx";

-- Community and messaging (lffdv). ForumPost(threadId), DirectMessage(senderId) and
-- DirectMessage(recipientId) already exist (Equoria-bvddn.23) and are kept as they are.
CREATE INDEX IF NOT EXISTS "ForumThread_authorId_idx" ON "ForumThread" ("authorId");
CREATE INDEX IF NOT EXISTS "ForumPost_authorId_idx" ON "ForumPost" ("authorId");
CREATE INDEX IF NOT EXISTS "DirectMessage_recipientId_createdAt_idx"
  ON "DirectMessage" ("recipientId", "createdAt");
CREATE INDEX IF NOT EXISTS "Club_leaderId_idx" ON "Club" ("leaderId");
CREATE INDEX IF NOT EXISTS "ClubElection_clubId_idx" ON "ClubElection" ("clubId");

-- Horse (cmw85.24): ONLY the mares-in-foal index. The column is NULL for almost every
-- horse, so the index stays tiny and adds almost no write cost.
CREATE INDEX IF NOT EXISTS "horses_inFoalSinceDate_idx" ON "horses" ("inFoalSinceDate");

-- Username search (cmw85.36). searchUsers matches case-insensitively on a prefix
-- (ILIKE 'ab%'), which the plain unique index cannot serve. A trigram GIN index serves it
-- with no change to the query. pg_trgm ships with PostgreSQL (a trusted extension, so the
-- database owner can create it; Supabase has it).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS "User_username_trgm_idx" ON "User" USING GIN ("username" gin_trgm_ops);
