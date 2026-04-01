-- Migration: add_breed_default_trait
-- 1. Removes duplicate breed rows (keeps lowest id per name)
-- 2. Adds defaultTrait column
-- 3. Adds unique constraint on name (required for ON CONFLICT upserts)

-- Step 1: Delete duplicate breed rows, keeping the one with the lowest id
DELETE FROM "breeds"
WHERE id NOT IN (
  SELECT MIN(id)
  FROM "breeds"
  GROUP BY name
);

-- Step 2: Add defaultTrait column
ALTER TABLE "breeds" ADD COLUMN IF NOT EXISTS "defaultTrait" TEXT;

-- Step 3: Add unique constraint on name
ALTER TABLE "breeds" ADD CONSTRAINT "breeds_name_key" UNIQUE ("name");
