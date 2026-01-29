-- Migration: Remove deprecated ownerId field from Horse model
-- Purpose: Complete the ownerId → userId field standardization
-- Safety: All 203 horses have been verified to have matching ownerId and userId values
-- Created: 2026-01-29
--
-- This migration removes the deprecated ownerId field and its index from the horses table.
-- The userId field (and its index) remains as the active replacement.

-- Drop the index on ownerId
DROP INDEX IF EXISTS "horses_ownerId_idx";

-- Drop the ownerId column
ALTER TABLE "horses" DROP COLUMN IF EXISTS "ownerId";
