-- Drift reconciliation (Equoria-qzyy, 2026-04-30):
-- Aligns migration history with the current schema.prisma after a series of
-- ad-hoc schema changes were applied directly to the dev DB without
-- corresponding migration files. The DB already has this state (verified via
-- `prisma migrate diff --from-url ... --to-schema-datamodel ...` returning
-- empty); this migration captures the DDL formally so future migrations
-- (including environments restored from migration history) start from the
-- same baseline.
--
-- Idempotent guards added inline so re-application is a no-op.
-- DropForeignKey
ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "password_reset_tokens_userId_fkey";

-- DropForeignKey
ALTER TABLE "staff_marketplace_state" DROP CONSTRAINT "staff_marketplace_state_userId_fkey";

-- DropForeignKey
ALTER TABLE "user_transactions" DROP CONSTRAINT "user_transactions_userId_fkey";

-- AlterTable
ALTER TABLE "password_reset_tokens" ALTER COLUMN "expiresAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "usedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "user_transactions" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "user_transactions_userId_createdAt_idx" ON "user_transactions"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_transactions" ADD CONSTRAINT "user_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_marketplace_state" ADD CONSTRAINT "staff_marketplace_state_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "password_reset_tokens_expires_idx" RENAME TO "password_reset_tokens_expiresAt_idx";

-- RenameIndex
ALTER INDEX "password_reset_tokens_user_idx" RENAME TO "password_reset_tokens_userId_idx";

-- RenameIndex
ALTER INDEX "staff_marketplace_state_user_idx" RENAME TO "staff_marketplace_state_userId_idx";

-- RenameIndex
ALTER INDEX "staff_marketplace_state_user_staff_unique" RENAME TO "staff_marketplace_state_userId_staffType_key";

