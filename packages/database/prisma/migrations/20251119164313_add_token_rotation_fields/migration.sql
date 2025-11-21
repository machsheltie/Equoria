-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "familyId" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isInvalidated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastActivityAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "refresh_tokens_lastActivityAt_idx" ON "refresh_tokens"("lastActivityAt");

-- CreateIndex
CREATE INDEX "refresh_tokens_familyId_idx" ON "refresh_tokens"("familyId");

-- CreateIndex
CREATE INDEX "refresh_tokens_isActive_isInvalidated_idx" ON "refresh_tokens"("isActive", "isInvalidated");

-- CreateIndex
CREATE INDEX "refresh_tokens_familyId_isActive_isInvalidated_idx" ON "refresh_tokens"("familyId", "isActive", "isInvalidated");
