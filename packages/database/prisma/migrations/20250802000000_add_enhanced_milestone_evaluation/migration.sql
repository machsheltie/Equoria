-- Enhanced Milestone Evaluation System Migration
-- Adds milestone_trait_logs table and extends groom_interactions for milestone tracking

-- Add new fields to groom_interactions table for milestone evaluation
ALTER TABLE "groom_interactions" ADD COLUMN "taskType" TEXT;
ALTER TABLE "groom_interactions" ADD COLUMN "qualityScore" DOUBLE PRECISION DEFAULT 0.75;
ALTER TABLE "groom_interactions" ADD COLUMN "milestoneWindowId" TEXT;

-- Create milestone_trait_logs table
CREATE TABLE "milestone_trait_logs" (
    "id" SERIAL NOT NULL,
    "horseId" INTEGER NOT NULL,
    "milestoneType" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "finalTrait" TEXT,
    "groomId" INTEGER,
    "bondScore" INTEGER,
    "taskDiversity" INTEGER NOT NULL DEFAULT 0,
    "taskConsistency" INTEGER NOT NULL DEFAULT 0,
    "careGapsPenalty" INTEGER NOT NULL DEFAULT 0,
    "modifiersApplied" JSONB NOT NULL DEFAULT '{}',
    "reasoning" TEXT,
    "ageInDays" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milestone_trait_logs_pkey" PRIMARY KEY ("id")
);

-- Create indexes for milestone_trait_logs
CREATE INDEX "milestone_trait_logs_horseId_idx" ON "milestone_trait_logs"("horseId");
CREATE INDEX "milestone_trait_logs_horseId_milestoneType_idx" ON "milestone_trait_logs"("horseId", "milestoneType");
CREATE INDEX "milestone_trait_logs_milestoneType_idx" ON "milestone_trait_logs"("milestoneType");
CREATE INDEX "milestone_trait_logs_groomId_idx" ON "milestone_trait_logs"("groomId");
CREATE INDEX "milestone_trait_logs_timestamp_idx" ON "milestone_trait_logs"("timestamp");

-- Add foreign key constraints
ALTER TABLE "milestone_trait_logs" ADD CONSTRAINT "milestone_trait_logs_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "horses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "milestone_trait_logs" ADD CONSTRAINT "milestone_trait_logs_groomId_fkey" FOREIGN KEY ("groomId") REFERENCES "grooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
