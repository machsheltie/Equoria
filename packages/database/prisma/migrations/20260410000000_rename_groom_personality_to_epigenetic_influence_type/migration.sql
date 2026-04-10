-- Migration: rename_groom_personality_to_epigenetic_influence_type
-- Renames groomPersonality column to epigeneticInfluenceType to match the
-- Prisma schema field name directly, removing the need for @map.
-- This is a rename-only change — no data is lost or changed.

ALTER TABLE "grooms" RENAME COLUMN "groomPersonality" TO "epigeneticInfluenceType";
