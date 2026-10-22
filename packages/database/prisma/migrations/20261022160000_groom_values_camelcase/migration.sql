-- Owner ruling 2026-10-21 (Stacey): Equoria names are camelCase, stored game
-- values included.
--
-- 1. Groom salary payments: paymentType weekly_salary -> weeklySalary (and the
--    column default), and every snake_case payment status (missed_*,
--    terminated_non_payment, arrears_*) -> camelCase.
-- 2. The salary ledger debit's metadata.paymentType carries the same value.
-- 3. Groom.retirementReason (historical reasons and the eligibility reasons a
--    forced retirement could record) -> camelCase, plus the copy each
--    groomRetired notification carries in payload.reason.
-- 4. Groom engagement endReason fee_unpaid -> feeUnpaid.
--
-- Idempotent: a second run matches no row. The closing check aborts the whole
-- migration if any old spelling survives.

BEGIN;

ALTER TABLE "groom_salary_payments" ALTER COLUMN "paymentType" SET DEFAULT 'weeklySalary';

UPDATE "groom_salary_payments" SET "paymentType" = 'weeklySalary' WHERE "paymentType" = 'weekly_salary';

CREATE TEMP TABLE "groom_value_rename" ("family" TEXT NOT NULL, "old" TEXT NOT NULL, "new" TEXT NOT NULL,
  PRIMARY KEY ("family", "old")) ON COMMIT DROP;

INSERT INTO "groom_value_rename" ("family", "old", "new") VALUES
  ('paymentStatus', 'missed_insufficient_funds', 'missedInsufficientFunds'),
  ('paymentStatus', 'missed_grace_period', 'missedGracePeriod'),
  ('paymentStatus', 'missed_collection_error', 'missedCollectionError'),
  ('paymentStatus', 'terminated_non_payment', 'terminatedNonPayment'),
  ('paymentStatus', 'arrears_settled', 'arrearsSettled'),
  ('paymentStatus', 'arrears_written_off', 'arrearsWrittenOff'),
  ('retirementReason', 'mandatory_career_limit', 'mandatoryCareerLimit'),
  ('retirementReason', 'early_level_cap', 'earlyLevelCap'),
  ('retirementReason', 'early_assignment_limit', 'earlyAssignmentLimit'),
  ('retirementReason', 'not_eligible', 'notEligible'),
  ('retirementReason', 'not_scheduled', 'notScheduled'),
  ('retirementReason', 'age_unknown', 'ageUnknown'),
  ('retirementReason', 'already_retired', 'alreadyRetired'),
  ('endReason', 'fee_unpaid', 'feeUnpaid');

UPDATE "groom_salary_payments" p SET "status" = r."new"
FROM "groom_value_rename" r
WHERE r."family" = 'paymentStatus' AND p."status" = r."old";

UPDATE "user_transactions"
SET "metadata" = jsonb_set("metadata", '{paymentType}', '"weeklySalary"')
WHERE jsonb_typeof("metadata") = 'object' AND "metadata"->>'paymentType' = 'weekly_salary';

UPDATE "grooms" g SET "retirementReason" = r."new"
FROM "groom_value_rename" r
WHERE r."family" = 'retirementReason' AND g."retirementReason" = r."old";

UPDATE "Notification" n
SET "payload" = jsonb_set(n."payload", '{reason}', to_jsonb(r."new"))
FROM "groom_value_rename" r
WHERE r."family" = 'retirementReason' AND n."type" = 'groomRetired'
  AND jsonb_typeof(n."payload") = 'object' AND n."payload"->>'reason' = r."old";

UPDATE "groom_engagements" e SET "endReason" = r."new"
FROM "groom_value_rename" r
WHERE r."family" = 'endReason' AND e."endReason" = r."old";

DO $$
DECLARE
  leftover INTEGER;
BEGIN
  SELECT
    (SELECT COUNT(*) FROM "groom_salary_payments" WHERE "paymentType" = 'weekly_salary')
    + (SELECT COUNT(*) FROM "groom_salary_payments" p
       JOIN "groom_value_rename" r ON r."family" = 'paymentStatus' AND p."status" = r."old")
    + (SELECT COUNT(*) FROM "user_transactions"
       WHERE jsonb_typeof("metadata") = 'object' AND "metadata"->>'paymentType' = 'weekly_salary')
    + (SELECT COUNT(*) FROM "grooms" g
       JOIN "groom_value_rename" r ON r."family" = 'retirementReason' AND g."retirementReason" = r."old")
    + (SELECT COUNT(*) FROM "Notification" n
       JOIN "groom_value_rename" r ON r."family" = 'retirementReason'
         AND n."type" = 'groomRetired' AND jsonb_typeof(n."payload") = 'object' AND n."payload"->>'reason' = r."old")
    + (SELECT COUNT(*) FROM "groom_engagements" e
       JOIN "groom_value_rename" r ON r."family" = 'endReason' AND e."endReason" = r."old")
  INTO leftover;
  IF leftover > 0 THEN
    RAISE EXCEPTION 'groom_values_camelcase: % row(s) still hold an old spelling; aborting', leftover;
  END IF;
END $$;

COMMIT;
