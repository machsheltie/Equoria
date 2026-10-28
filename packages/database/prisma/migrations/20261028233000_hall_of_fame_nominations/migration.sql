-- Equoria-vb1n0 (owner rulings 2026-10-28, q257-q259): the Hall of Fame is
-- nominations, weekly votes and inductions. It starts empty: no horse is
-- carried over (until now the "Hall of Fame" was only a view of retired horses).

-- CreateEnum
CREATE TYPE "HallOfFameRoundOutcome" AS ENUM ('inducted', 'runoff', 'none');

-- CreateTable
CREATE TABLE "HallOfFameNomination" (
    "id" SERIAL NOT NULL,
    "horseId" INTEGER NOT NULL,
    "nominatedById" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HallOfFameNomination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HallOfFameRound" (
    "id" SERIAL NOT NULL,
    "weekStart" TIMESTAMP(3),
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "outcome" "HallOfFameRoundOutcome",
    "runoffOfId" INTEGER,

    CONSTRAINT "HallOfFameRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HallOfFameCandidate" (
    "id" SERIAL NOT NULL,
    "roundId" INTEGER NOT NULL,
    "nominationId" INTEGER NOT NULL,

    CONSTRAINT "HallOfFameCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HallOfFameVote" (
    "id" SERIAL NOT NULL,
    "roundId" INTEGER NOT NULL,
    "candidateId" INTEGER NOT NULL,
    "voterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HallOfFameVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HallOfFameInduction" (
    "id" SERIAL NOT NULL,
    "horseId" INTEGER NOT NULL,
    "roundId" INTEGER NOT NULL,
    "inductedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HallOfFameInduction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HallOfFameNomination_horseId_key" ON "HallOfFameNomination"("horseId");

-- CreateIndex
CREATE INDEX "HallOfFameNomination_weekStart_idx" ON "HallOfFameNomination"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "HallOfFameRound_weekStart_key" ON "HallOfFameRound"("weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "HallOfFameRound_runoffOfId_key" ON "HallOfFameRound"("runoffOfId");

-- CreateIndex
CREATE INDEX "HallOfFameRound_closedAt_endsAt_idx" ON "HallOfFameRound"("closedAt", "endsAt");

-- CreateIndex
CREATE INDEX "HallOfFameCandidate_nominationId_idx" ON "HallOfFameCandidate"("nominationId");

-- CreateIndex
CREATE UNIQUE INDEX "HallOfFameCandidate_roundId_nominationId_key" ON "HallOfFameCandidate"("roundId", "nominationId");

-- CreateIndex
CREATE INDEX "HallOfFameVote_candidateId_idx" ON "HallOfFameVote"("candidateId");

-- CreateIndex
CREATE INDEX "HallOfFameVote_voterId_idx" ON "HallOfFameVote"("voterId");

-- CreateIndex
CREATE UNIQUE INDEX "HallOfFameVote_roundId_voterId_key" ON "HallOfFameVote"("roundId", "voterId");

-- CreateIndex
CREATE UNIQUE INDEX "HallOfFameInduction_horseId_key" ON "HallOfFameInduction"("horseId");

-- CreateIndex
CREATE UNIQUE INDEX "HallOfFameInduction_roundId_key" ON "HallOfFameInduction"("roundId");

-- AddForeignKey
ALTER TABLE "HallOfFameNomination" ADD CONSTRAINT "HallOfFameNomination_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "horses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HallOfFameNomination" ADD CONSTRAINT "HallOfFameNomination_nominatedById_fkey" FOREIGN KEY ("nominatedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HallOfFameRound" ADD CONSTRAINT "HallOfFameRound_runoffOfId_fkey" FOREIGN KEY ("runoffOfId") REFERENCES "HallOfFameRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HallOfFameCandidate" ADD CONSTRAINT "HallOfFameCandidate_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "HallOfFameRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HallOfFameCandidate" ADD CONSTRAINT "HallOfFameCandidate_nominationId_fkey" FOREIGN KEY ("nominationId") REFERENCES "HallOfFameNomination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HallOfFameVote" ADD CONSTRAINT "HallOfFameVote_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "HallOfFameRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HallOfFameVote" ADD CONSTRAINT "HallOfFameVote_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "HallOfFameCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HallOfFameVote" ADD CONSTRAINT "HallOfFameVote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HallOfFameInduction" ADD CONSTRAINT "HallOfFameInduction_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "horses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HallOfFameInduction" ADD CONSTRAINT "HallOfFameInduction_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "HallOfFameRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
