-- AlterTable
ALTER TABLE "User" ADD COLUMN     "groomSalaryGracePeriod" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "grooms" ADD COLUMN     "groomPersonality" TEXT NOT NULL DEFAULT 'balanced';

-- AlterTable
ALTER TABLE "horses" ADD COLUMN     "conformationScores" JSONB DEFAULT '{"head": 20, "neck": 20, "shoulders": 20, "back": 20, "legs": 20, "hooves": 20, "topline": 20, "hindquarters": 20}',
ADD COLUMN     "consecutiveDaysFoalCare" INTEGER DEFAULT 0,
ADD COLUMN     "coordination" INTEGER DEFAULT 0,
ADD COLUMN     "epigeneticFlags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "groom_salary_payments" (
    "id" SERIAL NOT NULL,
    "groomId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentType" TEXT NOT NULL DEFAULT 'weekly_salary',
    "status" TEXT NOT NULL DEFAULT 'paid',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groom_salary_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groom_performance_records" (
    "id" SERIAL NOT NULL,
    "groomId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "horseId" INTEGER,
    "interactionType" TEXT NOT NULL,
    "bondGain" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taskSuccess" BOOLEAN NOT NULL DEFAULT true,
    "wellbeingImpact" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "playerRating" INTEGER,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groom_performance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groom_metrics" (
    "id" SERIAL NOT NULL,
    "groomId" INTEGER NOT NULL,
    "totalInteractions" INTEGER NOT NULL DEFAULT 0,
    "bondingEffectiveness" INTEGER NOT NULL DEFAULT 50,
    "taskCompletion" INTEGER NOT NULL DEFAULT 75,
    "horseWellbeing" INTEGER NOT NULL DEFAULT 50,
    "showPerformance" INTEGER NOT NULL DEFAULT 50,
    "consistency" INTEGER NOT NULL DEFAULT 50,
    "playerSatisfaction" INTEGER NOT NULL DEFAULT 75,
    "reputationScore" INTEGER NOT NULL DEFAULT 50,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groom_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trait_history_logs" (
    "id" SERIAL NOT NULL,
    "horseId" INTEGER NOT NULL,
    "traitName" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "influenceScore" INTEGER NOT NULL DEFAULT 0,
    "isEpigenetic" BOOLEAN NOT NULL DEFAULT false,
    "groomId" INTEGER,
    "bondScore" INTEGER,
    "stressLevel" INTEGER,
    "ageInDays" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trait_history_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "groom_salary_payments_groomId_idx" ON "groom_salary_payments"("groomId");

-- CreateIndex
CREATE INDEX "groom_salary_payments_userId_idx" ON "groom_salary_payments"("userId");

-- CreateIndex
CREATE INDEX "groom_salary_payments_paymentDate_idx" ON "groom_salary_payments"("paymentDate");

-- CreateIndex
CREATE INDEX "groom_salary_payments_userId_paymentDate_idx" ON "groom_salary_payments"("userId", "paymentDate");

-- CreateIndex
CREATE INDEX "groom_performance_records_groomId_idx" ON "groom_performance_records"("groomId");

-- CreateIndex
CREATE INDEX "groom_performance_records_userId_idx" ON "groom_performance_records"("userId");

-- CreateIndex
CREATE INDEX "groom_performance_records_recordedAt_idx" ON "groom_performance_records"("recordedAt");

-- CreateIndex
CREATE INDEX "groom_performance_records_groomId_recordedAt_idx" ON "groom_performance_records"("groomId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "groom_metrics_groomId_key" ON "groom_metrics"("groomId");

-- CreateIndex
CREATE INDEX "groom_metrics_reputationScore_idx" ON "groom_metrics"("reputationScore");

-- CreateIndex
CREATE INDEX "groom_metrics_groomId_idx" ON "groom_metrics"("groomId");

-- CreateIndex
CREATE INDEX "trait_history_logs_horseId_idx" ON "trait_history_logs"("horseId");

-- CreateIndex
CREATE INDEX "trait_history_logs_horseId_timestamp_idx" ON "trait_history_logs"("horseId", "timestamp");

-- CreateIndex
CREATE INDEX "trait_history_logs_traitName_idx" ON "trait_history_logs"("traitName");

-- CreateIndex
CREATE INDEX "trait_history_logs_sourceType_idx" ON "trait_history_logs"("sourceType");

-- CreateIndex
CREATE INDEX "trait_history_logs_groomId_idx" ON "trait_history_logs"("groomId");

-- CreateIndex
CREATE INDEX "trait_history_logs_isEpigenetic_idx" ON "trait_history_logs"("isEpigenetic");

-- AddForeignKey
ALTER TABLE "groom_salary_payments" ADD CONSTRAINT "groom_salary_payments_groomId_fkey" FOREIGN KEY ("groomId") REFERENCES "grooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groom_salary_payments" ADD CONSTRAINT "groom_salary_payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groom_performance_records" ADD CONSTRAINT "groom_performance_records_groomId_fkey" FOREIGN KEY ("groomId") REFERENCES "grooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groom_performance_records" ADD CONSTRAINT "groom_performance_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groom_performance_records" ADD CONSTRAINT "groom_performance_records_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "horses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groom_metrics" ADD CONSTRAINT "groom_metrics_groomId_fkey" FOREIGN KEY ("groomId") REFERENCES "grooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trait_history_logs" ADD CONSTRAINT "trait_history_logs_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "horses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trait_history_logs" ADD CONSTRAINT "trait_history_logs_groomId_fkey" FOREIGN KEY ("groomId") REFERENCES "grooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
