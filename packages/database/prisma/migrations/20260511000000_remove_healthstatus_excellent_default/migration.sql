-- Remove the erroneous "Excellent" (capital-E) default from horses.healthStatus.
-- Any existing rows with healthStatus = 'Excellent' (the schema default) were
-- never set by a real vet interaction; they should fall back to date-decay in
-- getVetHealth(), so we NULL them out.  Free-form vet findings (e.g. 'Lameness',
-- 'critical') are preserved as-is.
UPDATE "horses" SET "healthStatus" = NULL WHERE "healthStatus" = 'Excellent';

-- Drop the column-level DEFAULT so new horses start with NULL and use date-decay.
ALTER TABLE "horses" ALTER COLUMN "healthStatus" DROP DEFAULT;
