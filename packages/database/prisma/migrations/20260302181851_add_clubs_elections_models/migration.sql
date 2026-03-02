-- CreateEnum
CREATE TYPE "ClubType" AS ENUM ('discipline', 'breed');

-- CreateEnum
CREATE TYPE "ClubRole" AS ENUM ('member', 'officer', 'president');

-- CreateEnum
CREATE TYPE "ElectionStatus" AS ENUM ('upcoming', 'open', 'closed');

-- CreateTable
CREATE TABLE "Club" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ClubType" NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "leaderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubMembership" (
    "id" SERIAL NOT NULL,
    "clubId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ClubRole" NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubElection" (
    "id" SERIAL NOT NULL,
    "clubId" INTEGER NOT NULL,
    "position" TEXT NOT NULL,
    "status" "ElectionStatus" NOT NULL DEFAULT 'upcoming',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubElection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubCandidate" (
    "id" SERIAL NOT NULL,
    "electionId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "statement" TEXT NOT NULL,

    CONSTRAINT "ClubCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubBallot" (
    "id" SERIAL NOT NULL,
    "candidateId" INTEGER NOT NULL,
    "voterId" TEXT NOT NULL,
    "electionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubBallot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Club_name_key" ON "Club"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ClubMembership_clubId_userId_key" ON "ClubMembership"("clubId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClubCandidate_electionId_userId_key" ON "ClubCandidate"("electionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClubBallot_electionId_voterId_key" ON "ClubBallot"("electionId", "voterId");

-- AddForeignKey
ALTER TABLE "Club" ADD CONSTRAINT "Club_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubMembership" ADD CONSTRAINT "ClubMembership_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubMembership" ADD CONSTRAINT "ClubMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubElection" ADD CONSTRAINT "ClubElection_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubCandidate" ADD CONSTRAINT "ClubCandidate_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "ClubElection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubCandidate" ADD CONSTRAINT "ClubCandidate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubBallot" ADD CONSTRAINT "ClubBallot_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "ClubCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubBallot" ADD CONSTRAINT "ClubBallot_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
