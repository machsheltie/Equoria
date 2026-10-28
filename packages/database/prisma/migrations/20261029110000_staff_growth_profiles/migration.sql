-- Owner rulings 2026-10-28 (q160, q177, q235, q244; Equoria-xlw03): riders and grooms grow.
-- Each carries twelve hidden modifiers (4 horse traits, 4 disciplines, 2 temperaments, each
-- positive or negative, and 2 favourite breeds), revealed three per level-up and all at
-- Expert; levels are earned by shows completed. The profile lives in its own table, like
-- the rider retirement schedule, so no staff row read can carry the unrevealed items.
-- Profiles are drawn by the game (backend/services/staffGrowthService.mjs), not here:
-- existing staff get theirs the first time the game needs it, with as many items revealed
-- as their current level shows.

CREATE TABLE "rider_growth_profiles" (
    "riderId" INTEGER NOT NULL,
    "items" JSONB NOT NULL DEFAULT '[]',
    "showsAtLevel" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "rider_growth_profiles_pkey" PRIMARY KEY ("riderId"),
    CONSTRAINT "rider_growth_profiles_shows_nonnegative" CHECK ("showsAtLevel" >= 0)
);

CREATE TABLE "groom_growth_profiles" (
    "groomId" INTEGER NOT NULL,
    "items" JSONB NOT NULL DEFAULT '[]',
    "showsAtLevel" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "groom_growth_profiles_pkey" PRIMARY KEY ("groomId"),
    CONSTRAINT "groom_growth_profiles_shows_nonnegative" CHECK ("showsAtLevel" >= 0)
);

ALTER TABLE "rider_growth_profiles" ADD CONSTRAINT "rider_growth_profiles_riderId_fkey"
    FOREIGN KEY ("riderId") REFERENCES "riders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "groom_growth_profiles" ADD CONSTRAINT "groom_growth_profiles_groomId_fkey"
    FOREIGN KEY ("groomId") REFERENCES "grooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The riders-for-hire pool (q177): a dismissed or unpaid rider keeps its row, level and
-- reveals, leaves the player's roster (userId NULL) and is marked as in the pool.
ALTER TABLE "riders" ADD COLUMN "freeAgentSince" TIMESTAMP(3);
CREATE INDEX "riders_freeAgentSince_idx" ON "riders"("freeAgentSince") WHERE "freeAgentSince" IS NOT NULL;
