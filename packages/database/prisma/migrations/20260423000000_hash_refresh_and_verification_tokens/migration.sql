-- Equoria-uy73 (2026-04-23): Hash refresh tokens and email verification tokens at rest.
--
-- Raw JWTs / raw verification tokens were previously stored in plaintext, so a
-- DB read leak would immediately grant active sessions or the ability to verify
-- arbitrary accounts. This migration converts both tables to store only the
-- SHA-256 hex digest of the token, mirroring the password_reset_tokens pattern.
--
-- No backfill: there is no way to recover raw tokens from the existing rows
-- (the JWT is only persisted, not computable from userId/familyId/jti), so we
-- purge existing rows. Consequences:
--   * All users are force-logged-out — they obtain new tokens on next login.
--   * Pending email verifications must be re-requested.
-- Both are acceptable one-time costs to close the persistence-leak primitive.

BEGIN;

-- ============================================================================
-- refresh_tokens: drop "token", add "tokenHash"
-- ============================================================================

-- Purge all existing rows (no hash-from-JWT recovery is possible).
DELETE FROM "refresh_tokens";

-- Drop the old unique constraint and any index on the raw-token column.
-- The constraint name matches the @unique on RefreshToken.token.
ALTER TABLE "refresh_tokens" DROP CONSTRAINT IF EXISTS "refresh_tokens_token_key";
DROP INDEX IF EXISTS "refresh_tokens_token_idx";

-- Swap the column. With the table empty we can safely add NOT NULL without a default.
ALTER TABLE "refresh_tokens" DROP COLUMN "token";
ALTER TABLE "refresh_tokens" ADD COLUMN "tokenHash" VARCHAR(64) NOT NULL;

-- Enforce the new unique invariant on the hash.
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens" ("tokenHash");

-- ============================================================================
-- email_verification_tokens: drop "token", add "tokenHash"
-- ============================================================================

-- Purge outstanding rows. Users who had unused verification emails must
-- re-request; users who were already verified are unaffected (the flag lives
-- on "User", not here).
DELETE FROM "email_verification_tokens";

ALTER TABLE "email_verification_tokens" DROP CONSTRAINT IF EXISTS "email_verification_tokens_token_key";
DROP INDEX IF EXISTS "email_verification_tokens_token_idx";

ALTER TABLE "email_verification_tokens" DROP COLUMN "token";
ALTER TABLE "email_verification_tokens" ADD COLUMN "tokenHash" VARCHAR(64) NOT NULL;

CREATE UNIQUE INDEX "email_verification_tokens_tokenHash_key" ON "email_verification_tokens" ("tokenHash");

COMMIT;
