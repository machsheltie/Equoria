-- Equoria-si69u: introduce show-escrow accounting + named system money accounts.
--
-- Backstory: the legacy show-money flow credited Show.createdByUser.money directly
-- on every entry. If the creator GDPR-deleted their account before the show
-- executed, createdByUserId was nulled and all subsequent entry fees were
-- silently lost from the in-game economy (no counterparty, no audit row). The
-- bug fix routes show money through a named SystemAccount[show_escrow], with
-- per-show prizeEscrow + feeEscrow columns on the Show row that decrement to
-- zero by execute time. The aggregate SystemAccount.balance always reconciles
-- against SUM(prizeEscrow + feeEscrow) for open shows — that invariant is the
-- sentinel test's primary assertion.
--
-- Migration is additive:
--   - 2 new columns on `shows` (default 0 — pre-existing open shows continue
--     to work under the legacy path until they execute; new shows use the
--     escrow path from the start)
--   - 1 new table `system_accounts` seeded with the two named accounts the
--     show controller needs (`show_escrow`, `burn`)

BEGIN;

ALTER TABLE "shows"
  ADD COLUMN "prizeEscrow" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "feeEscrow" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "system_accounts" (
  "name"      TEXT        NOT NULL PRIMARY KEY,
  "balance"   INTEGER     NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed the named accounts. The application code references these by literal
-- string constant; if a row is missing at runtime the helpers throw rather
-- than silently no-op, so the seed is functional, not cosmetic.
INSERT INTO "system_accounts" ("name", "balance", "createdAt", "updatedAt") VALUES
  ('show_escrow', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('burn',        0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

COMMIT;
