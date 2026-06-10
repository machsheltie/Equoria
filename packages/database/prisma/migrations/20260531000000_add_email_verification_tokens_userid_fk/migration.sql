-- Equoria-3spgs: reconcile the canonical DB with schema.prisma's declared
-- email_verification_tokens.userId foreign key.
--
-- BACKGROUND
-- schema.prisma declares:
--     user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
-- on model EmailVerificationToken (@@map("email_verification_tokens")).
-- The ORIGINAL creating migration (20251119173114_add_email_verification)
-- emitted the matching constraint:
--     ALTER TABLE "email_verification_tokens"
--       ADD CONSTRAINT "email_verification_tokens_userId_fkey"
--       FOREIGN KEY ("userId") REFERENCES "User"("id")
--       ON DELETE CASCADE ON UPDATE CASCADE;
-- but the CANONICAL DB has NO such constraint today (verified via pg_constraint
-- during Equoria-t1f5r). This is the same class of drift as Equoria-vllv4 /
-- trait_history_logs: the Equoria-c3kb6 Supabase production restore dropped FK
-- constraints that pg_restore could not satisfy, leaving the table FK-less even
-- though the schema declares the relation.
--
-- Measured during Equoria-t1f5r: ~101 orphan rows in email_verification_tokens
-- whose "userId" points at a User row that no longer exists. A FK CANNOT be
-- added while violating rows exist — PostgreSQL validates existing data on
-- ADD CONSTRAINT and rejects the ALTER TABLE if any row would violate it.
--
-- ORDER MATTERS (orphan-delete BEFORE add-FK):
--   Step 1 deletes ONLY the orphan rows (userId not present in "User").
--   Step 2 then adds the FK, which now has no violating rows to reject.
-- Deleting the orphans first is also exactly what `onDelete: Cascade` means:
-- had the FK been enforcing all along, the parent-User deletion that orphaned
-- these tokens would have cascaded the tokens away. We are reconciling the
-- data with the constraint's own stated intent, not inventing a new policy.
--
-- SCOPE OF THE DELETE (intentionally narrow):
--   The WHERE clause restricts the delete to rows whose "userId" has no
--   matching id in "User". A token whose userId references a live user is
--   untouched. This is NOT a broad/unscoped delete. It cannot remove any row
--   that the about-to-be-added FK would consider valid.
--   (email_verification_tokens.userId is NOT NULL per the schema, so there is
--   no NULL-userId branch to special-case the way a nullable SetNull FK would
--   need — every row has a userId, and every userId either matches a live user
--   or is an orphan to be purged.)

BEGIN;

-- Step 1: purge orphan tokens whose owning user no longer exists.
-- Scoped: only rows whose "userId" is absent from "User". Matches the
-- onDelete: Cascade intent declared in schema.prisma.
DELETE FROM "email_verification_tokens"
WHERE "userId" NOT IN (SELECT "id" FROM "User");

-- Step 2: add the FK the canonical DB is missing. Name + ON DELETE/ON UPDATE
-- match the original creating migration and Prisma's <table>_<column>_fkey
-- naming convention exactly, so `prisma migrate status` sees the DB as now
-- matching what the schema already expects (no schema.prisma change needed).
--
-- DROP IF EXISTS first (amended 2026-06-10, Equoria-fefh2.14): on a FRESH
-- database the original creating migration (20251119173114_add_email_verification,
-- migration.sql:39) has already added this exact constraint, so a bare ADD
-- fails with `constraint already exists` — the same fresh-replay defect class
-- as the v58ta horses FK migration. Only the drifted (c3kb6-restored) DBs lack
-- it. DROP IF EXISTS + ADD converges both paths on the identical end state.
ALTER TABLE "email_verification_tokens"
  DROP CONSTRAINT IF EXISTS "email_verification_tokens_userId_fkey";
ALTER TABLE "email_verification_tokens"
  ADD CONSTRAINT "email_verification_tokens_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
