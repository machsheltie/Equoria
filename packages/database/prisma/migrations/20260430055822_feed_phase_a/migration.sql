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
-- This historical migration deliberately discarded existing
-- currentFeed/energyLevel/coordination values during the approved 2026-04-30
-- development-data reset.
--
-- Adds equippedFeedType (nullable TEXT) as the new feed-equip slot.
-- See: docs/features/feed-system.md.

-- AlterTable
ALTER TABLE "horses" DROP COLUMN "coordination",
DROP COLUMN "currentFeed",
DROP COLUMN "energyLevel",
ADD COLUMN     "equippedFeedType" TEXT;
