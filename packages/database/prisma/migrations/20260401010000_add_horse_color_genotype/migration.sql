-- Migration: add_horse_color_genotype
-- Adds colorGenotype and phenotype JSONB columns to the horses table.
-- Both nullable for backward compatibility with existing horses.

ALTER TABLE "horses" ADD COLUMN IF NOT EXISTS "colorGenotype" JSONB;
ALTER TABLE "horses" ADD COLUMN IF NOT EXISTS "phenotype"     JSONB;
