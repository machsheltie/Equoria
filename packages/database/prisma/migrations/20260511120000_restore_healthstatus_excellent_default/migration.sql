-- Restore 'Excellent' as the default for healthStatus.
-- Horses born or purchased from the store start with Excellent health,
-- which then degrades via date-based decay in getVetHealth() when neglected.
--
-- This compensates for migration 20260511000000 which incorrectly removed
-- the default and NULLed out existing Excellent rows. Whether that migration
-- ran or not, this leaves the column in the correct final state.

-- Restore the column-level DEFAULT so new horses start healthy.
ALTER TABLE "horses" ALTER COLUMN "healthStatus" SET DEFAULT 'Excellent';

-- Restore NULL healthStatus rows to 'Excellent' (they were either cleared
-- by the previous incorrect migration, or created without a default after it ran).
UPDATE "horses" SET "healthStatus" = 'Excellent' WHERE "healthStatus" IS NULL;
