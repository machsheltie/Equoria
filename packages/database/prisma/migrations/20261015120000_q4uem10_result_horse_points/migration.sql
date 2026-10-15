-- Equoria-q4uem.10 (slice A1), owner ruling R6 (Stacey, 2026-10-15): each
-- competition result records the Horse Points its placement awarded, so the
-- horse's show history never has to be recomputed from today's award table.
--
-- Additive and nullable; no backfill. Rows settled before this migration keep
-- NULL ("not recorded"), which the results reads show as unknown, never 0. Only
-- the owner had entered shows when this shipped (ruling 2026-10-07), so there is
-- no player history to reconstruct.
--
-- Generated with `prisma migrate diff --from-schema-datamodel <HEAD schema>
-- --to-schema-datamodel prisma/schema.prisma --script`.

-- AlterTable
ALTER TABLE "competition_results" ADD COLUMN     "horsePointsAwarded" INTEGER;
