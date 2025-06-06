/*
  Warnings:

  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Horse" DROP CONSTRAINT "Horse_ownerId_fkey";

-- AlterTable
ALTER TABLE "Horse" ADD COLUMN     "playerId" TEXT,
ALTER COLUMN "ownerId" DROP NOT NULL;

-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "money" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "xp" INTEGER NOT NULL,
    "settings" JSONB NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grooms" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "speciality" TEXT NOT NULL,
    "experience" INTEGER NOT NULL DEFAULT 1,
    "skill_level" TEXT NOT NULL DEFAULT 'novice',
    "personality" TEXT NOT NULL,
    "hourly_rate" DOUBLE PRECISION NOT NULL DEFAULT 15.0,
    "availability" JSONB NOT NULL DEFAULT '{}',
    "bio" TEXT,
    "image_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "hired_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "playerId" TEXT,

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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "foalId" INTEGER NOT NULL,
    "groomId" INTEGER NOT NULL,
    "playerId" TEXT,

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
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "foalId" INTEGER NOT NULL,
    "groomId" INTEGER NOT NULL,
    "assignmentId" INTEGER,

    CONSTRAINT "groom_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "xp_events" (
    "id" SERIAL NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "playerId" TEXT NOT NULL,

    CONSTRAINT "xp_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "players_email_key" ON "players"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "groom_assignments_foalId_groomId_isActive_key" ON "groom_assignments"("foalId", "groomId", "isActive");

-- CreateIndex
CREATE INDEX "xp_events_playerId_idx" ON "xp_events"("playerId");

-- CreateIndex
CREATE INDEX "xp_events_timestamp_idx" ON "xp_events"("timestamp");

-- CreateIndex
CREATE INDEX "xp_events_playerId_timestamp_idx" ON "xp_events"("playerId", "timestamp");

-- AddForeignKey
ALTER TABLE "Horse" ADD CONSTRAINT "Horse_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Horse" ADD CONSTRAINT "Horse_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grooms" ADD CONSTRAINT "grooms_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groom_assignments" ADD CONSTRAINT "groom_assignments_foalId_fkey" FOREIGN KEY ("foalId") REFERENCES "Horse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groom_assignments" ADD CONSTRAINT "groom_assignments_groomId_fkey" FOREIGN KEY ("groomId") REFERENCES "grooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groom_assignments" ADD CONSTRAINT "groom_assignments_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groom_interactions" ADD CONSTRAINT "groom_interactions_foalId_fkey" FOREIGN KEY ("foalId") REFERENCES "Horse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groom_interactions" ADD CONSTRAINT "groom_interactions_groomId_fkey" FOREIGN KEY ("groomId") REFERENCES "grooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groom_interactions" ADD CONSTRAINT "groom_interactions_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "groom_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "xp_events" ADD CONSTRAINT "xp_events_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
