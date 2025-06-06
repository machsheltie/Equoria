/*
  Warnings:

  - You are about to drop the `Horse` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Horse" DROP CONSTRAINT "Horse_userId_fkey";

-- DropTable
DROP TABLE "Horse";

-- CreateTable
CREATE TABLE "breeds" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "breeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stables" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,

    CONSTRAINT "stables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horses" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sex" TEXT NOT NULL,
    "dateOfBirth" DATE NOT NULL,
    "breedId" INTEGER,
    "ownerId" TEXT,
    "stableId" INTEGER,
    "genotype" JSONB,
    "phenotypicMarkings" JSONB,
    "finalDisplayColor" TEXT,
    "shade" TEXT,
    "imageUrl" TEXT DEFAULT '/images/samplehorse.JPG',
    "trait" TEXT,
    "temperament" TEXT,
    "personality" TEXT,
    "precision" INTEGER DEFAULT 0,
    "strength" INTEGER DEFAULT 0,
    "speed" INTEGER DEFAULT 0,
    "agility" INTEGER DEFAULT 0,
    "endurance" INTEGER DEFAULT 0,
    "intelligence" INTEGER DEFAULT 0,
    "stamina" INTEGER DEFAULT 0,
    "balance" INTEGER DEFAULT 0,
    "boldness" INTEGER DEFAULT 0,
    "flexibility" INTEGER DEFAULT 0,
    "obedience" INTEGER DEFAULT 0,
    "focus" INTEGER DEFAULT 0,
    "totalEarnings" INTEGER DEFAULT 0,
    "sireId" INTEGER,
    "damId" INTEGER,
    "studStatus" TEXT DEFAULT 'Not at Stud',
    "studFee" INTEGER DEFAULT 0,
    "lastBredDate" DATE,
    "forSale" BOOLEAN DEFAULT false,
    "salePrice" INTEGER DEFAULT 0,
    "healthStatus" TEXT DEFAULT 'Excellent',
    "lastVettedDate" DATE DEFAULT CURRENT_TIMESTAMP,
    "bondScore" INTEGER DEFAULT 50,
    "stressLevel" INTEGER DEFAULT 0,
    "tack" JSONB DEFAULT '{}',
    "age" INTEGER,
    "userId" TEXT,
    "trainingCooldown" TIMESTAMP(3),
    "earnings" DECIMAL(10,2) DEFAULT 0,
    "rider" JSONB,
    "disciplineScores" JSONB,
    "epigeneticModifiers" JSONB DEFAULT '{"positive": [], "negative": [], "hidden": []}',
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "horses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grooms" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "speciality" TEXT NOT NULL,
    "experience" INTEGER NOT NULL DEFAULT 1,
    "skillLevel" TEXT NOT NULL DEFAULT 'novice',
    "personality" TEXT NOT NULL,
    "hourlyRate" DECIMAL(10,2) NOT NULL DEFAULT 15.0,
    "availability" JSONB NOT NULL DEFAULT '{}',
    "bio" TEXT,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hiredDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groom_assignments" (
    "id" SERIAL NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "foalId" INTEGER NOT NULL,
    "groomId" INTEGER NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groom_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groom_interactions" (
    "id" SERIAL NOT NULL,
    "interactionType" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "bondingChange" INTEGER NOT NULL DEFAULT 0,
    "stressChange" INTEGER NOT NULL DEFAULT 0,
    "quality" TEXT NOT NULL DEFAULT 'good',
    "notes" TEXT,
    "cost" DECIMAL(10,2) NOT NULL DEFAULT 0.0,
    "foalId" INTEGER NOT NULL,
    "groomId" INTEGER NOT NULL,
    "assignmentId" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "groom_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shows" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "levelMin" INTEGER NOT NULL,
    "levelMax" INTEGER NOT NULL,
    "entryFee" INTEGER NOT NULL,
    "prize" INTEGER NOT NULL,
    "runDate" TIMESTAMP(3) NOT NULL,
    "hostUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competition_results" (
    "id" SERIAL NOT NULL,
    "score" DECIMAL(10,2) NOT NULL,
    "placement" TEXT,
    "discipline" TEXT NOT NULL,
    "runDate" TIMESTAMP(3) NOT NULL,
    "showName" TEXT NOT NULL,
    "prizeWon" DECIMAL(10,2) DEFAULT 0,
    "statGains" JSONB,
    "horseId" INTEGER NOT NULL,
    "showId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competition_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_logs" (
    "id" SERIAL NOT NULL,
    "discipline" TEXT NOT NULL,
    "trainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "horseId" INTEGER NOT NULL,

    CONSTRAINT "training_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foal_development" (
    "id" SERIAL NOT NULL,
    "currentDay" INTEGER NOT NULL DEFAULT 0,
    "bondingLevel" INTEGER NOT NULL DEFAULT 50,
    "stressLevel" INTEGER NOT NULL DEFAULT 20,
    "completedActivities" JSONB NOT NULL DEFAULT '{}',
    "foalId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "foal_development_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foal_activities" (
    "id" SERIAL NOT NULL,
    "day" INTEGER NOT NULL,
    "activityType" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "bondingChange" INTEGER NOT NULL,
    "stressChange" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "foalId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "foal_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foal_training_history" (
    "id" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "activity" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "bondChange" INTEGER NOT NULL DEFAULT 0,
    "stressChange" INTEGER NOT NULL DEFAULT 0,
    "horseId" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "foal_training_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xp_events" (
    "id" SERIAL NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "xp_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "horses_userId_idx" ON "horses"("userId");

-- CreateIndex
CREATE INDEX "horses_breedId_idx" ON "horses"("breedId");

-- CreateIndex
CREATE INDEX "horses_stableId_idx" ON "horses"("stableId");

-- CreateIndex
CREATE INDEX "horses_ownerId_idx" ON "horses"("ownerId");

-- CreateIndex
CREATE INDEX "grooms_userId_idx" ON "grooms"("userId");

-- CreateIndex
CREATE INDEX "groom_assignments_foalId_idx" ON "groom_assignments"("foalId");

-- CreateIndex
CREATE INDEX "groom_assignments_groomId_idx" ON "groom_assignments"("groomId");

-- CreateIndex
CREATE UNIQUE INDEX "groom_assignments_foalId_groomId_isActive_key" ON "groom_assignments"("foalId", "groomId", "isActive");

-- CreateIndex
CREATE INDEX "groom_interactions_foalId_idx" ON "groom_interactions"("foalId");

-- CreateIndex
CREATE INDEX "groom_interactions_groomId_idx" ON "groom_interactions"("groomId");

-- CreateIndex
CREATE UNIQUE INDEX "shows_name_key" ON "shows"("name");

-- CreateIndex
CREATE UNIQUE INDEX "foal_development_foalId_key" ON "foal_development"("foalId");

-- CreateIndex
CREATE INDEX "foal_training_history_horseId_idx" ON "foal_training_history"("horseId");

-- CreateIndex
CREATE INDEX "foal_training_history_day_idx" ON "foal_training_history"("day");

-- CreateIndex
CREATE INDEX "foal_training_history_timestamp_idx" ON "foal_training_history"("timestamp");

-- CreateIndex
CREATE INDEX "foal_training_history_horseId_day_idx" ON "foal_training_history"("horseId", "day");

-- CreateIndex
CREATE INDEX "xp_events_userId_idx" ON "xp_events"("userId");

-- CreateIndex
CREATE INDEX "xp_events_timestamp_idx" ON "xp_events"("timestamp");

-- CreateIndex
CREATE INDEX "xp_events_userId_timestamp_idx" ON "xp_events"("userId", "timestamp");

-- AddForeignKey
ALTER TABLE "horses" ADD CONSTRAINT "horses_breedId_fkey" FOREIGN KEY ("breedId") REFERENCES "breeds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horses" ADD CONSTRAINT "horses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horses" ADD CONSTRAINT "horses_stableId_fkey" FOREIGN KEY ("stableId") REFERENCES "stables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horses" ADD CONSTRAINT "horses_sireId_fkey" FOREIGN KEY ("sireId") REFERENCES "horses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horses" ADD CONSTRAINT "horses_damId_fkey" FOREIGN KEY ("damId") REFERENCES "horses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grooms" ADD CONSTRAINT "grooms_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groom_assignments" ADD CONSTRAINT "groom_assignments_foalId_fkey" FOREIGN KEY ("foalId") REFERENCES "horses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groom_assignments" ADD CONSTRAINT "groom_assignments_groomId_fkey" FOREIGN KEY ("groomId") REFERENCES "grooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groom_assignments" ADD CONSTRAINT "groom_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groom_interactions" ADD CONSTRAINT "groom_interactions_foalId_fkey" FOREIGN KEY ("foalId") REFERENCES "horses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groom_interactions" ADD CONSTRAINT "groom_interactions_groomId_fkey" FOREIGN KEY ("groomId") REFERENCES "grooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groom_interactions" ADD CONSTRAINT "groom_interactions_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "groom_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shows" ADD CONSTRAINT "shows_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_results" ADD CONSTRAINT "competition_results_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "horses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_results" ADD CONSTRAINT "competition_results_showId_fkey" FOREIGN KEY ("showId") REFERENCES "shows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_logs" ADD CONSTRAINT "training_logs_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "horses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foal_development" ADD CONSTRAINT "foal_development_foalId_fkey" FOREIGN KEY ("foalId") REFERENCES "horses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foal_activities" ADD CONSTRAINT "foal_activities_foalId_fkey" FOREIGN KEY ("foalId") REFERENCES "horses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foal_training_history" ADD CONSTRAINT "foal_training_history_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "horses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
