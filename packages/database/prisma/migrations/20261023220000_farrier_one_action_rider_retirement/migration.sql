-- Owner rulings of 2026-10-23, both approved as part of the rulings.
--
-- 1. Equoria-zmqzf: the farrier has ONE action (a weekly "Shoe horse" for 50
--    coins that records Horse.lastShod). Hoof condition, the hoof decay job and
--    the farrier date no longer exist, and the code stopped reading these two
--    columns before this migration was written:
--      horses.lastFarrierDate, horses.hoofCondition
--    Horse.lastShod stays. Data: hoofCondition was a prompt-to-rebook label
--    ("good" by default) and lastFarrierDate a visit date; both are superseded
--    by lastShod and are dropped with no migration of values.
--
-- 2. Equoria-or2ua: riders start at a random age of 18-25 and retire at a hidden
--    random age of 40-65, with a one-week notice to the players who use them.
--      riders.startAge                 plain nullable column (age is not secret)
--      rider_retirement_schedules      the HIDDEN age, one row per rider, in its
--                                      own table so no rider read can serialise
--                                      it (same design as
--                                      groom_retirement_schedules)
--    Existing riders get neither value here; the idempotent backfill script
--    backend/scripts/backfill-rider-retirement-schedules.mjs rolls them once.
--    The ranges are enforced by CHECK constraints so a future writer cannot
--    quietly widen the bands (Prisma cannot express CHECK constraints; a later
--    generated migration must not drop them).

ALTER TABLE "horses" DROP COLUMN "lastFarrierDate";
ALTER TABLE "horses" DROP COLUMN "hoofCondition";

ALTER TABLE "riders" ADD COLUMN "startAge" INTEGER;
ALTER TABLE "riders"
  ADD CONSTRAINT "riders_start_age_range"
  CHECK ("startAge" IS NULL OR "startAge" BETWEEN 18 AND 25);

CREATE TABLE "rider_retirement_schedules" (
    "riderId" INTEGER NOT NULL,
    "retirementAge" INTEGER NOT NULL,
    "noticeSentAt" TIMESTAMP(3),
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rider_retirement_schedules_pkey" PRIMARY KEY ("riderId")
);

ALTER TABLE "rider_retirement_schedules"
  ADD CONSTRAINT "rider_retirement_schedules_riderId_fkey"
  FOREIGN KEY ("riderId") REFERENCES "riders"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rider_retirement_schedules"
  ADD CONSTRAINT "rider_retirement_schedules_age_range"
  CHECK ("retirementAge" BETWEEN 40 AND 65);
