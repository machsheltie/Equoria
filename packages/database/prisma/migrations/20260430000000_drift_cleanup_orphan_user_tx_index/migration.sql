-- Drift cleanup (Equoria-qzyy, 2026-04-30):
-- The dev DB had an orphan index `user_transactions_user_created_idx`
-- (snake_case name + DESC ordering) that pre-dated the current schema.prisma
-- naming convention. Prisma's current schema declares the canonical index
-- `user_transactions_userId_createdAt_idx` (camelCase, default ASC ordering)
-- which already exists. Drop the orphan to bring the DB in sync with the
-- schema and unblock future migrations.
--
-- Idempotent: IF EXISTS guards against repeated application or environments
-- where the orphan index never existed.

DROP INDEX IF EXISTS "user_transactions_user_created_idx";
