-- AddColumn: pendingFoalName and pendingFoalBreedId on horses table
--
-- These fields were added to schema.prisma in commit 6f336521 (feat(breeding):
-- persist pendingFoalName/pendingFoalBreedId and honour at foaling, Equoria-wjxw)
-- but the corresponding migration file was omitted. Without this migration,
-- Railway's horses table is missing these columns causing every Prisma query
-- that selects horse fields (including requireOwnership) to throw a column-not-found
-- error and return HTTP 500 on all horse detail endpoints.
--
-- Use IF NOT EXISTS so this is idempotent on DBs that already have the columns
-- (e.g., local dev that was synced via prisma db push).
ALTER TABLE "horses" ADD COLUMN IF NOT EXISTS "pendingFoalName" TEXT;
ALTER TABLE "horses" ADD COLUMN IF NOT EXISTS "pendingFoalBreedId" INTEGER;
