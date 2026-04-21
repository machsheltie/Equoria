CREATE TABLE IF NOT EXISTS staff_marketplace_state (
  id SERIAL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "staffType" TEXT NOT NULL,
  offers JSONB NOT NULL DEFAULT '[]'::jsonb,
  "lastRefresh" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "refreshCount" INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS staff_marketplace_state_user_staff_unique
  ON staff_marketplace_state ("userId", "staffType");

CREATE INDEX IF NOT EXISTS staff_marketplace_state_user_idx
  ON staff_marketplace_state ("userId");
