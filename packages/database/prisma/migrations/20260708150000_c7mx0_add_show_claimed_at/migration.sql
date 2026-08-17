ALTER TABLE "shows" ADD COLUMN "claimedAt" TIMESTAMP(3);
CREATE INDEX "shows_status_claimed_at_idx" ON "shows"("status", "claimedAt");
