-- Equoria-jw10w: DB-backed security audit trail (OWASP A09).
-- Tamper-evident, queryable, retained audit trail for sensitive mutating
-- operations. userId is a SOFT reference (no FK constraint) on purpose so
-- audit rows survive user deletion (forensic requirement) and a user cannot
-- erase their own trail by deleting their account.

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "resourceId" TEXT,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "success" BOOLEAN NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
