-- Equoria-gt81 (2026-04-30): Phase A of feed-system redesign.
--
-- Drops legacy fields the new feed system replaces:
--   * coordination — removed from the redesigned stat model entirely.
--                    No code reads it after Task A2 cleanup; only 12 stats
--                    remain in the boost-roll pool. (Recon Finding 1 → B.)
--   * currentFeed  — replaced by equippedFeedType. The old field stored the
--                    last-purchased feed; the new one is a persistent
--                    equipped-tier slot decoupled from purchase.
--   * energyLevel  — replaced by derived feedHealth (computed from
--                    lastFedDate). No need to store a runtime energy stat.
--
-- Data loss is authorized: spec §6 (Decisions Log) approves a wipe of
-- existing currentFeed/energyLevel/coordination values; the active player
-- base is one tester with two test horses, no production data.
--
-- Adds equippedFeedType (nullable TEXT) as the new feed-equip slot.
-- See: docs/superpowers/specs/2026-04-29-feed-system-redesign-design.md §5.2.

-- AlterTable
ALTER TABLE "horses" DROP COLUMN "coordination",
DROP COLUMN "currentFeed",
DROP COLUMN "energyLevel",
ADD COLUMN     "equippedFeedType" TEXT;

