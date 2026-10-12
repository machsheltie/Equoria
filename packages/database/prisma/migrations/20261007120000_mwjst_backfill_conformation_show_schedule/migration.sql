-- Equoria-mwjst (Codex review 2026-10-06, finding 3), implementing the owner's
-- ruling of 2026-10-07: legacy conformation shows without a closing date get
-- the seven-day schedule backfilled; entry stays open.
--
-- WHY
--   Conformation shows are settled only by the nightly job, and only once
--   closeDate has passed (owner ruling 2026-10-05: shows run exactly 7 days
--   from creation). An open conformation show with closeDate NULL is never
--   due, so every entry fee paid into it sat in escrow forever.
--
-- WHAT THIS CHANGES
--   Open conformation shows with closeDate NULL only:
--     openDate  := openDate, or createdAt when that is NULL
--     closeDate := that openDate + 7 days   (the schema's documented rule)
--     runDate   := closeDate                (what createShow writes)
--   Ridden shows, completed/executing shows and already-dated shows are not
--   touched. A backfilled show whose seven days have already passed becomes
--   due and is settled by the next nightly run.
--
-- NO NEW UNDATED ROWS
--   The only runtime creator (showController.createShow) always writes both
--   dates, and no seed creates conformation shows, so this is a one-time
--   backfill; no constraint is added.
--
-- SAFETY
--   One UPDATE, no DDL, no deletes. Read-only cohort check first:
--     SELECT id, "createdAt", "openDate" FROM "shows"
--     WHERE "showType" = 'conformation' AND status = 'open' AND "closeDate" IS NULL;
--   Not reversible as data (the NULLs are not recorded); forward repair is to
--   edit the dates of the affected show ids listed by the query above.

UPDATE "shows"
SET "openDate"  = COALESCE("openDate", "createdAt"),
    "closeDate" = COALESCE("openDate", "createdAt") + INTERVAL '7 days',
    "runDate"   = COALESCE("openDate", "createdAt") + INTERVAL '7 days',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "showType" = 'conformation'
  AND "status" = 'open'
  AND "closeDate" IS NULL;
