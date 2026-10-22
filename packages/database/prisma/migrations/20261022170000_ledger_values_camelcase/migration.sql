-- Owner ruling 2026-10-21 (Stacey): Equoria names are camelCase, stored game
-- values included.
--
-- 1. The show escrow system account: its primary key show_escrow -> showEscrow,
--    and the copy every ledger row paired with it carries in
--    metadata.systemAccount. Nothing references system_accounts by foreign key.
--    A plain key rename: if a showEscrow row already exists the primary key
--    rejects it and the whole migration aborts rather than merging balances.
-- 2. user_transactions.category: every snake_case ledger category -> camelCase.
-- 3. user_transactions.description: the default system-account descriptions
--    name the account, and the store-horse burn names its category; both are
--    rewritten word for word.
--
-- Idempotent: a second run matches no row. The closing check aborts the whole
-- migration if any old spelling survives.

BEGIN;

UPDATE "system_accounts" SET "name" = 'showEscrow' WHERE "name" = 'show_escrow';

UPDATE "user_transactions"
SET "metadata" = jsonb_set("metadata", '{systemAccount}', '"showEscrow"')
WHERE jsonb_typeof("metadata") = 'object' AND "metadata"->>'systemAccount' = 'show_escrow';

UPDATE "user_transactions"
SET "description" = regexp_replace("description", '\mshow_escrow\M', 'showEscrow', 'g')
WHERE "description" ~ '\mshow_escrow\M';

CREATE TEMP TABLE "ledger_category_rename" ("old" TEXT PRIMARY KEY, "new" TEXT NOT NULL) ON COMMIT DROP;

INSERT INTO "ledger_category_rename" ("old", "new") VALUES
  ('weekly_reward', 'weeklyReward'),
  ('stud_fee_paid', 'studFeePaid'),
  ('stud_fee_received', 'studFeeReceived'),
  ('show_create_prize_escrow', 'showCreatePrizeEscrow'),
  ('show_entry_fee_escrow', 'showEntryFeeEscrow'),
  ('competition_entry', 'competitionEntry'),
  ('show_refund_unpaid_prize', 'showRefundUnpaidPrize'),
  ('show_unpaid_prize_refund', 'showUnpaidPrizeRefund'),
  ('show_settle_fees_to_creator', 'showSettleFeesToCreator'),
  ('show_settle_fees_to_burn', 'showSettleFeesToBurn'),
  ('show_entry_fees_received', 'showEntryFeesReceived'),
  ('show_burn_orphaned_fees', 'showBurnOrphanedFees'),
  ('show_payout_prize', 'showPayoutPrize'),
  ('crafting_fee_burn', 'craftingFeeBurn'),
  ('farrier_service', 'farrierService'),
  ('farrier_service_burn', 'farrierServiceBurn'),
  ('feed_purchase', 'feedPurchase'),
  ('feed_purchase_burn', 'feedPurchaseBurn'),
  ('tack_purchase', 'tackPurchase'),
  ('tack_purchase_burn', 'tackPurchaseBurn'),
  ('vet_service', 'vetService'),
  ('vet_service_burn', 'vetServiceBurn'),
  ('groom_hire', 'groomHire'),
  ('groom_hire_burn', 'groomHireBurn'),
  ('groom_marketplace_refresh', 'groomMarketplaceRefresh'),
  ('groom_marketplace_refresh_burn', 'groomMarketplaceRefreshBurn'),
  ('groom_salary_burn', 'groomSalaryBurn'),
  ('marketplace_purchase', 'marketplacePurchase'),
  ('marketplace_sale', 'marketplaceSale'),
  ('store_horse_purchase_burn', 'storeHorsePurchaseBurn'),
  ('horse_trader_purchase', 'horseTraderPurchase'),
  ('rider_marketplace_refresh_burn', 'riderMarketplaceRefreshBurn'),
  ('rider_hire', 'riderHire'),
  ('rider_hire_burn', 'riderHireBurn'),
  ('trainer_marketplace_refresh_burn', 'trainerMarketplaceRefreshBurn'),
  ('trainer_hire', 'trainerHire'),
  ('trainer_hire_burn', 'trainerHireBurn'),
  ('show_cancel_refund_entrant', 'showCancelRefundEntrant'),
  ('show_cancel_burn_fee_residue', 'showCancelBurnFeeResidue'),
  ('show_cancel_burn_prize', 'showCancelBurnPrize');

UPDATE "user_transactions" t SET "category" = r."new"
FROM "ledger_category_rename" r
WHERE t."category" = r."old";

-- A description could name more than one category, so rewrite each in turn.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT "old", "new" FROM "ledger_category_rename" LOOP
    UPDATE "user_transactions"
    SET "description" = regexp_replace("description", '\m' || r."old" || '\M', r."new", 'g')
    WHERE "description" ~ ('\m' || r."old" || '\M');
  END LOOP;
END $$;

DO $$
DECLARE
  leftover INTEGER;
BEGIN
  SELECT
    (SELECT COUNT(*) FROM "system_accounts" WHERE "name" = 'show_escrow')
    + (SELECT COUNT(*) FROM "user_transactions"
       WHERE jsonb_typeof("metadata") = 'object' AND "metadata"->>'systemAccount' = 'show_escrow')
    + (SELECT COUNT(*) FROM "user_transactions" t
       JOIN "ledger_category_rename" r ON t."category" = r."old")
    + (SELECT COUNT(*) FROM "user_transactions" t
       WHERE t."description" ~ '\mshow_escrow\M'
          OR EXISTS (SELECT 1 FROM "ledger_category_rename" r
                     WHERE t."description" ~ ('\m' || r."old" || '\M')))
  INTO leftover;
  IF leftover > 0 THEN
    RAISE EXCEPTION 'ledger_values_camelcase: % row(s) still hold an old spelling; aborting', leftover;
  END IF;
END $$;

COMMIT;
