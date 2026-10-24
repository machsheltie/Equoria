-- Equoria-y3nia — owner rulings q10, q11, q40, q42 (2026-10-23): leaderboard
-- redesign. Overall and Monthly boards for players and horses; the Monthly
-- boards read these totals, the Overall boards are counted live.
--
-- Additive only: two new tables (one row per player / horse, per Eastern game
-- month 'YYYY-MM', per category) and the indexes the live Overall boards need.
--   player_monthly_totals  categories: xp, earnings, wins, shows
--   horse_monthly_totals   categories: points, earnings, wins, shows,
--                          disciplineWins:<discipline>
-- Rows are added to by the transaction that earns the amount. Historical
-- months are filled by backend/scripts/backfillLeaderboardMonthlyTotals.mjs.

-- CreateTable
CREATE TABLE "player_monthly_totals" (
    "id" SERIAL NOT NULL,
    "month" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "player_monthly_totals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horse_monthly_totals" (
    "id" SERIAL NOT NULL,
    "month" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "horseId" INTEGER NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "horse_monthly_totals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "player_monthly_totals_month_category_playerId_key" ON "player_monthly_totals"("month", "category", "playerId");

-- CreateIndex
CREATE INDEX "player_monthly_totals_month_category_value_playerId_idx" ON "player_monthly_totals"("month", "category", "value" DESC, "playerId");

-- CreateIndex
CREATE INDEX "player_monthly_totals_playerId_idx" ON "player_monthly_totals"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "horse_monthly_totals_month_category_horseId_key" ON "horse_monthly_totals"("month", "category", "horseId");

-- CreateIndex
CREATE INDEX "horse_monthly_totals_month_category_value_horseId_idx" ON "horse_monthly_totals"("month", "category", "value" DESC, "horseId");

-- CreateIndex
CREATE INDEX "horse_monthly_totals_horseId_idx" ON "horse_monthly_totals"("horseId");

-- CreateIndex
CREATE INDEX "User_xp_idx" ON "User"("xp");

-- CreateIndex
CREATE INDEX "horses_horseXp_idx" ON "horses"("horseXp");

-- CreateIndex
CREATE INDEX "horses_totalEarnings_idx" ON "horses"("totalEarnings");

-- CreateIndex
CREATE INDEX "competition_results_discipline_placement_horseId_idx" ON "competition_results"("discipline", "placement", "horseId");

-- CreateIndex
CREATE INDEX "competition_results_placement_horseId_idx" ON "competition_results"("placement", "horseId");

-- AddForeignKey
ALTER TABLE "player_monthly_totals" ADD CONSTRAINT "player_monthly_totals_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horse_monthly_totals" ADD CONSTRAINT "horse_monthly_totals_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "horses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
