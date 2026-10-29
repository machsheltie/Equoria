-- Owner ruling 2026-10-21 (Stacey): Equoria names are camelCase, stored game
-- values included.
--
-- Breeding-request decline reasons (Equoria-pjvp8.4, phase 3k):
--   REJECTED, CANCELLED_BY_OWNER, ACCOUNT_CLOSED, OWN_STALLION,
--   STALLION_UNAVAILABLE, STALLION_SOLD, MARE_TRANSFERRED, MARE_INELIGIBLE,
--   INSUFFICIENT_FUNDS, LISTING_CHANGED
-- -> rejected, cancelledByOwner, accountClosed, ownStallion,
--   stallionUnavailable, stallionSold, mareTransferred, mareIneligible,
--   insufficientFunds, listingChanged
-- in:
--   breeding_records."declineReason".
--   "Notification"."payload" of the studRequestDeclined and studRequestCancelled
--     notifications: the "declineReason" key and the "reason" key (a cancelled
--     request's reason). Every other key of the payload is kept.
--
-- Only these ten exact values change; any other value is left as stored.
-- Idempotent: a second run matches no row. The closing check aborts the whole
-- migration if any decline reason in those places is still snake_case or
-- UPPER_CASE (an underscore, or a leading capital letter).

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.camel_decline(v TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT CASE v
    WHEN 'REJECTED' THEN 'rejected'
    WHEN 'CANCELLED_BY_OWNER' THEN 'cancelledByOwner'
    WHEN 'ACCOUNT_CLOSED' THEN 'accountClosed'
    WHEN 'OWN_STALLION' THEN 'ownStallion'
    WHEN 'STALLION_UNAVAILABLE' THEN 'stallionUnavailable'
    WHEN 'STALLION_SOLD' THEN 'stallionSold'
    WHEN 'MARE_TRANSFERRED' THEN 'mareTransferred'
    WHEN 'MARE_INELIGIBLE' THEN 'mareIneligible'
    WHEN 'INSUFFICIENT_FUNDS' THEN 'insufficientFunds'
    WHEN 'LISTING_CHANGED' THEN 'listingChanged'
    ELSE v
  END
$fn$;

CREATE OR REPLACE FUNCTION pg_temp.is_old_decline(v TEXT) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT COALESCE(pg_temp.camel_decline(v) IS DISTINCT FROM v, FALSE)
$fn$;

UPDATE "breeding_records"
SET "declineReason" = pg_temp.camel_decline("declineReason")
WHERE pg_temp.is_old_decline("declineReason");

UPDATE "Notification"
SET "payload" = "payload"
  || CASE WHEN pg_temp.is_old_decline("payload" ->> 'declineReason')
       THEN jsonb_build_object('declineReason', pg_temp.camel_decline("payload" ->> 'declineReason'))
       ELSE '{}'::jsonb END
  || CASE WHEN pg_temp.is_old_decline("payload" ->> 'reason')
       THEN jsonb_build_object('reason', pg_temp.camel_decline("payload" ->> 'reason'))
       ELSE '{}'::jsonb END
WHERE "type" IN ('studRequestDeclined', 'studRequestCancelled')
  AND jsonb_typeof("payload") = 'object'
  AND (pg_temp.is_old_decline("payload" ->> 'declineReason')
    OR pg_temp.is_old_decline("payload" ->> 'reason'));

DO $$
DECLARE
  leftover INTEGER;
BEGIN
  SELECT
    (SELECT COUNT(*) FROM "breeding_records"
     WHERE "declineReason" ~ '_|^[A-Z]')
    + (SELECT COUNT(*) FROM "Notification"
       WHERE "type" IN ('studRequestDeclined', 'studRequestCancelled')
         AND jsonb_typeof("payload") = 'object'
         AND (("payload" ->> 'declineReason') ~ '_|^[A-Z]'
           OR ("payload" ->> 'reason') ~ '_|^[A-Z]'))
  INTO leftover;
  IF leftover > 0 THEN
    RAISE EXCEPTION 'stud_decline_reasons_camelcase: % row(s) still hold a snake_case or UPPER_CASE decline reason; aborting', leftover;
  END IF;
END $$;

COMMIT;
