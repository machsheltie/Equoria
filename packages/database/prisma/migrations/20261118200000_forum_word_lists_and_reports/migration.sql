-- Equoria-puj1e.3 (owner rulings q375, q380, q381, q382; 2026-11-18): the forum's
-- blocked-word and review-word lists, and players' reports of forum posts.
--
-- Additive only: two new tables, their indexes, check constraints and foreign
-- keys. No existing row is read or changed; no backfill. Old code never touches
-- either table and keeps working. Rollback: drop both tables (only word-list
-- entries and reports are lost; who changed what stays in staff_action_log).
--
--   forum_words    list: blocked | review; word stored lowercased, single-spaced.
--                  Owner and Admins edit it (q381); matching is whole words,
--                  ignoring capitals (q380), done in application code.
--   forum_reports  reason: rudeOrBullying | spamOrSelling | personalInformation
--                  | other; status: open | resolved | dismissed (q382).
--
-- PRISMA NOTE: "forum_reports_open_postId_reporterId_key" is a PARTIAL unique
-- index (one OPEN report per player per post). Prisma cannot express a partial
-- index, so it lives only in this file, as with
-- 20260907120000_kccmt_partial_unique_active_staff_assignments. A later
-- `prisma migrate dev` may propose dropping it: edit that DROP out. The check
-- constraints are likewise outside Prisma's model.

-- CreateTable
CREATE TABLE "forum_words" (
    "id" SERIAL NOT NULL,
    "list" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_words_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "forum_words_list_check" CHECK ("list" IN ('blocked', 'review')),
    CONSTRAINT "forum_words_word_check" CHECK ("word" <> '')
);

-- CreateTable
CREATE TABLE "forum_reports" (
    "id" SERIAL NOT NULL,
    "postId" INTEGER NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,

    CONSTRAINT "forum_reports_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "forum_reports_reason_check"
      CHECK ("reason" IN ('rudeOrBullying', 'spamOrSelling', 'personalInformation', 'other')),
    CONSTRAINT "forum_reports_status_check" CHECK ("status" IN ('open', 'resolved', 'dismissed'))
);

-- CreateIndex
CREATE UNIQUE INDEX "forum_words_list_word_key" ON "forum_words"("list", "word");

-- CreateIndex
CREATE INDEX "forum_reports_status_createdAt_idx" ON "forum_reports"("status", "createdAt");

-- CreateIndex
CREATE INDEX "forum_reports_postId_idx" ON "forum_reports"("postId");

-- CreateIndex
CREATE INDEX "forum_reports_reporterId_idx" ON "forum_reports"("reporterId");

-- One open report per player per post (q382 build note); decided reports are history.
CREATE UNIQUE INDEX "forum_reports_open_postId_reporterId_key"
  ON "forum_reports" ("postId", "reporterId")
  WHERE "status" = 'open';

-- AddForeignKey
ALTER TABLE "forum_reports" ADD CONSTRAINT "forum_reports_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ForumPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_reports" ADD CONSTRAINT "forum_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
