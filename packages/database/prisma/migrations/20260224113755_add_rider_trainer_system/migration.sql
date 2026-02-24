-- CreateTable
CREATE TABLE "riders" (
    "id" SERIAL NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "personality" TEXT NOT NULL,
    "skillLevel" TEXT NOT NULL,
    "speciality" TEXT NOT NULL,
    "weeklyRate" INTEGER NOT NULL DEFAULT 200,
    "experience" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "careerWeeks" INTEGER NOT NULL DEFAULT 0,
    "totalWins" INTEGER NOT NULL DEFAULT 0,
    "prestige" INTEGER NOT NULL DEFAULT 0,
    "retired" BOOLEAN NOT NULL DEFAULT false,
    "bio" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "riders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rider_assignments" (
    "id" SERIAL NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "riderId" INTEGER NOT NULL,
    "horseId" INTEGER NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rider_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trainers" (
    "id" SERIAL NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "personality" TEXT NOT NULL,
    "skillLevel" TEXT NOT NULL,
    "speciality" TEXT NOT NULL,
    "sessionRate" INTEGER NOT NULL DEFAULT 150,
    "experience" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "careerWeeks" INTEGER NOT NULL DEFAULT 0,
    "retired" BOOLEAN NOT NULL DEFAULT false,
    "bio" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trainers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trainer_assignments" (
    "id" SERIAL NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trainerId" INTEGER NOT NULL,
    "horseId" INTEGER NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trainer_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "riders_userId_idx" ON "riders"("userId");

-- CreateIndex
CREATE INDEX "riders_level_idx" ON "riders"("level");

-- CreateIndex
CREATE INDEX "riders_retired_idx" ON "riders"("retired");

-- CreateIndex
CREATE INDEX "rider_assignments_riderId_idx" ON "rider_assignments"("riderId");

-- CreateIndex
CREATE INDEX "rider_assignments_horseId_idx" ON "rider_assignments"("horseId");

-- CreateIndex
CREATE INDEX "rider_assignments_userId_idx" ON "rider_assignments"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "rider_assignments_riderId_horseId_isActive_key" ON "rider_assignments"("riderId", "horseId", "isActive");

-- CreateIndex
CREATE INDEX "trainers_userId_idx" ON "trainers"("userId");

-- CreateIndex
CREATE INDEX "trainers_level_idx" ON "trainers"("level");

-- CreateIndex
CREATE INDEX "trainers_retired_idx" ON "trainers"("retired");

-- CreateIndex
CREATE INDEX "trainer_assignments_trainerId_idx" ON "trainer_assignments"("trainerId");

-- CreateIndex
CREATE INDEX "trainer_assignments_horseId_idx" ON "trainer_assignments"("horseId");

-- CreateIndex
CREATE INDEX "trainer_assignments_userId_idx" ON "trainer_assignments"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "trainer_assignments_trainerId_horseId_isActive_key" ON "trainer_assignments"("trainerId", "horseId", "isActive");

-- AddForeignKey
ALTER TABLE "riders" ADD CONSTRAINT "riders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rider_assignments" ADD CONSTRAINT "rider_assignments_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "riders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rider_assignments" ADD CONSTRAINT "rider_assignments_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "horses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rider_assignments" ADD CONSTRAINT "rider_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainers" ADD CONSTRAINT "trainers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_assignments" ADD CONSTRAINT "trainer_assignments_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_assignments" ADD CONSTRAINT "trainer_assignments_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "horses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainer_assignments" ADD CONSTRAINT "trainer_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
