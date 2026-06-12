-- Equoria-zr9kl: persisted API-documentation coverage snapshots.
-- A series of these point-in-time rows is what lets /api/docs/analytics compute
-- a REAL coverage/quality trend instead of the honest not-tracked placeholder
-- it returns when fewer than two snapshots exist.

-- CreateTable
CREATE TABLE "doc_coverage_snapshots" (
    "id" SERIAL NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "coveragePct" DOUBLE PRECISION NOT NULL,
    "qualityScore" INTEGER NOT NULL,
    "totalEndpoints" INTEGER NOT NULL,
    "documentedEndpoints" INTEGER NOT NULL,

    CONSTRAINT "doc_coverage_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "doc_coverage_snapshots_capturedAt_idx" ON "doc_coverage_snapshots"("capturedAt" DESC);
