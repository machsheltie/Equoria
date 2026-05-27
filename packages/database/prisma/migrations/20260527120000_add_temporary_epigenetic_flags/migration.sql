-- Equoria-yzqhj.5: temporary / environment-triggered epigenetic flags.
-- ADDITIVE, non-destructive: adds a single new JSONB column to "horses"
-- with a safe default. Does NOT touch the existing "epigeneticFlags"
-- String[] column or any other column. Idempotent via IF NOT EXISTS so
-- re-application on a drifted dev DB is safe.
ALTER TABLE "horses" ADD COLUMN IF NOT EXISTS "temporaryEpigeneticFlags" JSONB NOT NULL DEFAULT '[]';
