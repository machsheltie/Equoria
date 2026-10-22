-- Equoria-bvddn.22 — owner ruling 2026-10-22 (Stacey): a tied club election
-- goes to a one-day run-off between the tied candidates; the run-off winner
-- takes the seat. A tied run-off is not decided (the rule is a question for the
-- owner): it is recorded as `tied` and no seat is assigned.
--
-- Additive only: one enum and three nullable columns on "ClubElection". Every
-- existing row keeps NULL (no outcome recorded, no run-off).
--   outcome           — how the closing job decided the election
--   winnerCandidateId — the candidacy that takes the seat
--   runoffOfId        — on a run-off round, the tied election it decides
--                       (unique: an election has at most one run-off)

-- CreateEnum
CREATE TYPE "ElectionOutcome" AS ENUM ('won', 'runoff', 'tied');

-- AlterTable
ALTER TABLE "ClubElection" ADD COLUMN     "outcome" "ElectionOutcome",
ADD COLUMN     "runoffOfId" INTEGER,
ADD COLUMN     "winnerCandidateId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "ClubElection_runoffOfId_key" ON "ClubElection"("runoffOfId");

-- AddForeignKey
ALTER TABLE "ClubElection" ADD CONSTRAINT "ClubElection_winnerCandidateId_fkey" FOREIGN KEY ("winnerCandidateId") REFERENCES "ClubCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubElection" ADD CONSTRAINT "ClubElection_runoffOfId_fkey" FOREIGN KEY ("runoffOfId") REFERENCES "ClubElection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
