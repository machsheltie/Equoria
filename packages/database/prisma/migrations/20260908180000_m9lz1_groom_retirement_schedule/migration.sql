-- Equoria-m9lz1 (2026-09-08), implementing the owner's ruling of the same day:
--   "Players don't retire grooms. Grooms retire automatically at a randomly
--    selected age by the game. They can retire any time between age 50-65 and
--    that is not known until the week they retire. Grooms are hired from the
--    marketplace. Player [does] not own them. The game should notify a player
--    [when] their groom is retiring so they can select a new one."
--
-- WHAT THIS ADDS
--   One table, `groom_retirement_schedules`, holding exactly one row per groom:
--   the career age at which the game will retire that groom. The value is drawn
--   once (uniformly from 50..65 inclusive) and never recomputed, so it cannot
--   drift between reads.
--
-- WHY A SEPARATE TABLE RATHER THAN A COLUMN ON `grooms`
--   The hiding requirement is structural, not cosmetic. Roughly twenty call
--   sites read grooms with a bare `prisma.groom.findMany()` / `findUnique()`
--   and several serialize the row straight into a player-facing response
--   (groomRosterController.getUserGrooms, groomHandlerController,
--   horseOverviewController, gdprAccountService, conformationShowController).
--   A scalar column would leak into all of them the moment it existed, and
--   every future groom read would leak it again. A 1:1 relation is absent from
--   those responses by construction — Prisma emits a relation only when the
--   caller explicitly asks for it, and the only caller that asks is
--   backend/modules/grooms/services/groomRetirementService.mjs.
--
-- THE CHECK CONSTRAINT
--   `retirementAge BETWEEN 50 AND 65` is enforced by the database, not only by
--   the service that writes it, so a future writer cannot quietly widen the
--   band. Prisma cannot express a CHECK constraint, so it exists only in this
--   raw SQL — the same posture
--   20260907120000_kccmt_partial_unique_active_staff_assignments took for its
--   partial unique indexes, and 20260528120000_qh6jk_align_runtime_indexes for
--   its runtime indexes. A later `prisma migrate dev` will not manage it; if a
--   generated migration ever proposes dropping it, edit that DROP out.
--
-- NO INDEX BEYOND THE PRIMARY KEY
--   The table is only ever read by primary key (`groomId`) or through the
--   `retirementSchedule` relation of a groom already fetched by id. The PK's
--   implicit unique index serves both. `assignedAt` is provenance, never a
--   query predicate.
--
-- SAFETY ON EXISTING DATA
--   Pure additive DDL. No DELETE, no UPDATE, no TRUNCATE, no column dropped or
--   retyped. Existing groom rows get no schedule row; the retirement service
--   draws one for them idempotently on the first weekly career pass
--   (`ensureRetirementSchedule`), so no backfill is required and none is
--   performed here. Until that pass runs a groom simply has no scheduled
--   retirement, which is the pre-existing behaviour.
--
-- APPLY THIS WITH `migrate deploy`, NEVER `migrate dev`
--   Applied to the local development database on 2026-09-08 (Equoria-m9lz1) via
--   `prisma migrate deploy`; no other environment has had it. Every remaining
--   environment needs the same `migrate deploy` plus `prisma generate`.
--
--   Use `deploy`, not `dev`, and the reason is specific rather than stylistic:
--   per .superpowers/sdd/FINDINGS/task-14-report.md §4.2, `prisma migrate dev` on
--   this repository proposes DROPping the 17 raw-SQL runtime indexes from `qh6jk`
--   plus `ALTER COLUMN "system_accounts"."updatedAt" DROP DEFAULT`. Those DROP
--   statements must be deleted from any generated migration before it is applied.
--   This file is hand-written precisely so that proposal never has to be
--   accepted, and the CHECK constraint below is invisible to Prisma for the same
--   reason the qh6jk indexes are — if a future generated migration proposes
--   dropping it, edit that DROP out.

CREATE TABLE "groom_retirement_schedules" (
    "groomId" INTEGER NOT NULL,
    "retirementAge" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "groom_retirement_schedules_pkey" PRIMARY KEY ("groomId")
);

ALTER TABLE "groom_retirement_schedules"
  ADD CONSTRAINT "groom_retirement_schedules_groomId_fkey"
  FOREIGN KEY ("groomId") REFERENCES "grooms"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "groom_retirement_schedules"
  ADD CONSTRAINT "groom_retirement_schedules_age_range"
  CHECK ("retirementAge" BETWEEN 50 AND 65);
