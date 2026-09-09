-- Equoria-ypb7d (2026-09-09), implementing the owner rulings of the same day on
-- Equoria-maeba and Equoria-m0w8n:
--
--   "grooms should have a built in start age. Anywhere from 18-24 years old.
--    They should require [retire] at 50-65 years old. Just like horses, a groom
--    ages a year per week."
--
--   "players never own grooms. If anyone owns them, Equoria does. They are free
--    agents. They are HIRED by players and charged a weekly fee. ... If they
--    fail to pay for a groom for a week, the groom goes back to the Grooms for
--    hire section of the marketplace and can be hired by other players. So for
--    clarity, a player gets one weeks grace period. The groom can't groom horse
--    until paid for that week but they don't officially lose the groom once
--    until they fail to pay for a whole week."
--
-- WHAT THIS ADDS
--   1. `grooms.startAge`      — the age the groom was when they entered the
--      game, drawn once, uniformly from 18..24 inclusive. A groom's CURRENT age
--      is `startAge + careerWeeks`; `careerWeeks` already advances by one per
--      weekly career pass, which on Equoria's clock (1 real week = 1 game-year,
--      backend/utils/horseAge.mjs) is one game-year. There is therefore ONE
--      clock, not two: this column supplies the offset the existing counter was
--      missing, and no second counter is introduced.
--   2. `grooms.feeUnpaidSince` — the START of the pay week (Monday 00:00 UTC,
--      groomSalaryService.getPayWeekStart) whose weekly fee could not be paid.
--      NULL means the engagement is paid up. Non-NULL means the groom is inside
--      the owner's one-week grace period: still on the player's staff, but
--      barred from grooming. When a LATER pay week arrives with this still set,
--      a full week has gone unpaid and the groom is released to the pool.
--   3. `groom_engagements`     — the record of who has hired whom. A player
--      never owns a groom; hiring opens an engagement and releasing/retiring
--      closes it. `Groom.userId` remains the LIVE pointer to the player whose
--      staff the groom is on (nullable — NULL is a free agent); this table is
--      its history, in the same relationship `groom_assignment_logs` has to
--      `groom_assignments`.
--
-- WHY A SCALAR COLUMN FOR `startAge` AND NOT A SEPARATE TABLE
--   The opposite of the reasoning for `groom_retirement_schedules`
--   (20260908180000_m9lz1_groom_retirement_schedule). The RETIREMENT age must be
--   undiscoverable until the week it takes effect, so it lives in a relation
--   Prisma emits only on explicit request. A groom's ORDINARY age is not a
--   secret — it is a character attribute like `personality` or `bio` — so it is
--   a plain column. These are two different values and only one of them is
--   hidden; see scripts/doctrine-checks/check-no-retirement-schedule-leak.mjs,
--   which still guards the hidden one.
--
-- THE CHECK CONSTRAINTS
--   `startAge BETWEEN 18 AND 24` is enforced by the database, not only by the
--   service that draws it, so a future writer cannot quietly widen the band.
--   It admits NULL because the column is added to 101 existing groom rows with
--   no backfill (see below). Prisma cannot express a CHECK constraint, so it
--   exists only in this raw SQL — the same posture m9lz1 took for its
--   `retirementAge BETWEEN 50 AND 65`, kccmt for its partial unique indexes and
--   qh6jk for its runtime indexes. A later `prisma migrate dev` will not manage
--   it; if a generated migration ever proposes dropping it, edit that DROP out.
--
-- THE PARTIAL UNIQUE INDEX
--   `groom_engagements_active_groomId_key ... WHERE "endedAt" IS NULL` is the
--   database's statement that a groom works for at most ONE player at a time.
--   It is partial for the same reason kccmt's staff-assignment indexes are: the
--   rule applies to the OPEN row only, and history must be allowed to hold many
--   closed rows for the same groom. Prisma cannot express a partial unique
--   index either, so it also lives only here.
--
-- SAFETY ON EXISTING DATA
--   Pure additive DDL. No DELETE, no UPDATE, no TRUNCATE, no column dropped or
--   retyped, and no backfill. The 101 existing groom rows get `startAge` NULL
--   and `feeUnpaidSince` NULL, and no engagement row. Each is filled in
--   idempotently by the code that needs it, exactly as m9lz1 did for the
--   retirement schedule:
--     * `startAge`      — `ensureStartAge` on the weekly career pass;
--     * engagements     — `ensureEngagement` when the weekly fee pass first
--                         bills a groom that already has a `userId`.
--   A groom with a NULL `startAge` has no known age and is therefore NOT
--   retired by the age rule until the pass has drawn one, which is the safe
--   direction to fail.
--
-- MIGRATION STATUS
--   APPLY THIS WITH `prisma migrate deploy`, NEVER `prisma migrate dev`. Read
--   the sibling NOTES.md and .superpowers/sdd/FINDINGS/task-14-report.md before
--   touching it: `migrate dev` on this repository proposes DROPping the 17
--   raw-SQL runtime indexes from `qh6jk` plus
--   `ALTER COLUMN "system_accounts"."updatedAt" DROP DEFAULT`, and those DROP
--   statements must be deleted from any generated migration before it is
--   applied. This file is hand-written precisely so that proposal never has to
--   be accepted. Once applied ANYWHERE, this file must never be edited again —
--   comments included — because Prisma hashes its raw bytes
--   (Equoria-mxftz). Operator notes belong in NOTES.md, which Prisma does not
--   read.

ALTER TABLE "grooms" ADD COLUMN "startAge" INTEGER;

ALTER TABLE "grooms" ADD COLUMN "feeUnpaidSince" TIMESTAMP(3);

ALTER TABLE "grooms"
  ADD CONSTRAINT "grooms_start_age_range"
  CHECK ("startAge" IS NULL OR "startAge" BETWEEN 18 AND 24);

CREATE TABLE "groom_engagements" (
    "id" SERIAL NOT NULL,
    "groomId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endReason" TEXT,

    CONSTRAINT "groom_engagements_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "groom_engagements"
  ADD CONSTRAINT "groom_engagements_groomId_fkey"
  FOREIGN KEY ("groomId") REFERENCES "grooms"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "groom_engagements"
  ADD CONSTRAINT "groom_engagements_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "groom_engagements_active_groomId_key"
  ON "groom_engagements"("groomId")
  WHERE "endedAt" IS NULL;

CREATE INDEX "groom_engagements_groomId_idx" ON "groom_engagements"("groomId");

CREATE INDEX "groom_engagements_userId_idx" ON "groom_engagements"("userId");
