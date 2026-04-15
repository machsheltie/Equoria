CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "usedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "ipAddress" TEXT,
  "userAgent" TEXT
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx
  ON password_reset_tokens ("userId");

CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_idx
  ON password_reset_tokens ("expiresAt");

