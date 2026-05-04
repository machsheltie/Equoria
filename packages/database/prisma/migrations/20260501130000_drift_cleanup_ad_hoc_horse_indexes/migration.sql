-- Drift cleanup (B1 prerequisite, 2026-05-01):
-- The dev DB had 4 ad-hoc indexes on the horses table that were applied
-- without any corresponding migration file. They used a non-Prisma naming
-- convention (idx_horses_*_gin / idx_horses_breedid_age) so Prisma's drift
-- detector flagged them as unexpected.
--
-- Additionally, the orphan `user_transactions_user_created_idx` (DESC variant)
-- has reappeared since 20260430000000_drift_cleanup_orphan_user_tx_index ran;
-- drop it again here. The canonical index `user_transactions_userId_createdAt_idx`
-- (declared in schema.prisma via @@index([userId, createdAt])) is preserved.
--
-- These indexes were not declared in schema.prisma; if performance metrics
-- later require any of them, the correct path is to add @@index declarations
-- to schema.prisma and create a forward migration. This cleanup brings the
-- live DB schema back into alignment with the migration-history truth.
--
-- Idempotent: IF EXISTS guards make repeated application a no-op.
-- Pattern matches: 20260430000000_drift_cleanup_orphan_user_tx_index,
--                  20260430000001_drift_reconcile_schema_history.

DROP INDEX IF EXISTS "idx_horses_breedid_age";
DROP INDEX IF EXISTS "idx_horses_disciplinescores_gin";
DROP INDEX IF EXISTS "idx_horses_epigeneticmodifiers_gin";
DROP INDEX IF EXISTS "idx_horses_ultrararetraits_gin";
DROP INDEX IF EXISTS "user_transactions_user_created_idx";
