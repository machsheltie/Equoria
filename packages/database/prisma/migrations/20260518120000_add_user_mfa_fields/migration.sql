-- Equoria-2vwwh: TOTP-based MFA (OWASP A07). Opt-in per user.
-- mfaSecret: base32 TOTP shared secret (at-rest encryption is a tracked
--            follow-up — no encryption util currently exists in the codebase).
-- mfaEnabled: gates the login second-factor challenge.
-- mfaRecoveryCodes: JSON array of { codeHash, usedAt } — bcrypt-hashed,
--                   single-use recovery codes.

ALTER TABLE "User" ADD COLUMN "mfaSecret" TEXT;
ALTER TABLE "User" ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "mfaRecoveryCodes" JSONB;
