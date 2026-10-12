-- Equoria-mwjst (Codex review 2026-10-06, finding 3), implementing the owner's
-- rulings of 2026-10-07 (backfill the dates; entry stays open) and 2026-10-12
-- (the seven days count from creation): legacy conformation shows without a
-- closing date get the seven-day schedule backfilled from createdAt.
--
-- WHY
--   Conformation shows are settled only by the nightly job, and only once
--   closeDate has passed (owner ruling 2026-10-05: shows run exactly 7 days
--   from creation). An open conformation show with closeDate NULL is never
--   due, so every entry fee paid into it sat in escrow forever.
--
-- WHAT THIS CHANGES
--   Open conformation shows with closeDate NULL only:
--     closeDate := createdAt + 7 days   (exactly seven days from creation)
--     runDate   := closeDate
--     openDate  := openDate, or createdAt when that is NULL
--   Ridden shows, completed/executing shows and already-dated shows are not
--   touched. A backfilled show whose seven days have already passed becomes
--   due and is settled by the next nightly run.
--
-- NEW UNDATED ROWS
--   No game code creates conformation shows (showController.createShow writes
--   the schema default showType 'ridden'). The E2E global setup seeds one and
--   now writes its dates. Conformation entry refuses a show with no closing
--   date, so an undated show added later can never take a fee it cannot settle.
--
-- SAFETY
--   One UPDATE, no DDL, no deletes. Read-only cohort check first:
--     SELECT id, "createdAt", "openDate" FROM "shows"
--     WHERE "showType" = 'conformation' AND status = 'open' AND "closeDate" IS NULL;
--   Not reversible as data (the NULLs are not recorded); forward repair is to
--   edit the dates of the affected show ids listed by the query above.

UPDATE "shows"
SET "openDate"  = COALESCE("openDate", "createdAt"),
    "closeDate" = "createdAt" + INTERVAL '7 days',
    "runDate"   = "createdAt" + INTERVAL '7 days',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "showType" = 'conformation'
  AND "status" = 'open'
  AND "closeDate" IS NULL;
