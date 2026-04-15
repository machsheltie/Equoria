CREATE TABLE IF NOT EXISTS user_transactions (
  id SERIAL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  "balanceAfter" INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_transactions_user_created_idx
  ON user_transactions ("userId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS user_transactions_category_idx
  ON user_transactions (category);

