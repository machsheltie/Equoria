-- Equoria-bvddn.23: add the missing foreign-key indexes.
--
-- OWNER RULING 2026-09-30: "approved: add the FK indexes in one migration."
--
-- Each column below is a foreign key with no index whose LEADING column is
-- that FK (checked against schema.prisma and every prior migration). The one
-- composite on these tables, "ClubMembership_clubId_userId_key", leads with
-- clubId and so does not cover userId. training_logs.horseId is tracked
-- separately in Equoria-cmw85.7 and is not part of this migration.
--
-- SQL generated without a database by
--   prisma migrate diff --from-schema-datamodel <pre-change schema.prisma>
--     --to-schema-datamodel packages/database/prisma/schema.prisma --script
-- and contains nothing else, so the new @@index lines and this file agree.
--
-- Pure CREATE INDEX statements: additive, no data writes, reversible with
-- DROP INDEX. CONCURRENTLY is not legal inside the transaction Prisma wraps
-- each migration in, so plain CREATE INDEX is used, as in
-- 20260529140000_ezx1y_add_horse_query_indexes. The tables are small at the
-- current single-replica scale, so the brief lock is acceptable.

-- CreateIndex
CREATE INDEX "shows_createdByUserId_idx" ON "shows"("createdByUserId");

-- CreateIndex
CREATE INDEX "ForumPost_threadId_idx" ON "ForumPost"("threadId");

-- CreateIndex
CREATE INDEX "DirectMessage_senderId_idx" ON "DirectMessage"("senderId");

-- CreateIndex
CREATE INDEX "DirectMessage_recipientId_idx" ON "DirectMessage"("recipientId");

-- CreateIndex
CREATE INDEX "ClubMembership_userId_idx" ON "ClubMembership"("userId");

-- CreateIndex
CREATE INDEX "horse_sales_horseId_idx" ON "horse_sales"("horseId");
