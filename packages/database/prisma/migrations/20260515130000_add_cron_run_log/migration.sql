-- Equoria-9wby: Persistent CronRunLog table for cross-restart cron observability
-- Complements the in-memory CronJobService.heartbeats (Equoria-0elk) by adding
-- a queryable last-N runs view per job that survives process restarts.

-- CreateTable
CREATE TABLE "cron_run_logs" (
    "id" SERIAL NOT NULL,
    "jobName" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "horsesProcessed" INTEGER,
    "birthdaysFound" INTEGER,
    "milestonesEvaluated" INTEGER,
    "electionsOpened" INTEGER,
    "electionsClosed" INTEGER,
    "errorsCount" INTEGER,
    "errorMessage" TEXT,
    "summary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cron_run_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cron_run_logs_jobName_startedAt_idx" ON "cron_run_logs"("jobName", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "cron_run_logs_status_idx" ON "cron_run_logs"("status");
