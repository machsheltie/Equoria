-- Owner rulings 2026-10-29:
--   q304 (Equoria-oey96.47): the trainer "discovery" panel and its saved data are
--        retired. Drops trainers."discovery_slots" (migration
--        20260513140000_add_trainer_discovery_slots).
--   q305 (Equoria-a7f1p): authenticator-app (TOTP) sign-in is removed entirely.
--        Drops "User"."mfaSecret", "mfaEnabled" and "mfaRecoveryCodes" (migration
--        20260518120000_add_user_mfa_fields). Staff emailed check-in codes live in
--        their own tables and are untouched.
--
-- No reader is left: the application release that ships with this migration has no
-- trainer discovery route, service or raw-SQL read/write of discovery_slots, and no
-- MFA enrolment, challenge, disable, login step or email-change code step.
--
-- NOT backward compatible with the previous application release: its generated Prisma
-- client lists these columns, so a bare trainer or user read from an old instance
-- would fail once they are gone. Deploy the new release and this migration together.
--
-- No data is copied: the discovery slots were generated flavour with no game effect,
-- and a player who had TOTP on signs in with her password from now on. The counts of
-- non-empty rows are logged so the migration output shows what went.

DO $$
DECLARE
  seededTrainers integer;
  totpAccounts integer;
BEGIN
  SELECT count(*) INTO seededTrainers FROM "trainers"
   WHERE jsonb_typeof("discovery_slots") = 'array' AND jsonb_array_length("discovery_slots") > 0;
  SELECT count(*) INTO totpAccounts FROM "User"
   WHERE "mfaEnabled" = true OR "mfaSecret" IS NOT NULL OR "mfaRecoveryCodes" IS NOT NULL;
  RAISE NOTICE 'dropping trainers.discovery_slots (% seeded) and User TOTP columns (% accounts with TOTP data)',
    seededTrainers, totpAccounts;
END
$$;

ALTER TABLE "trainers" DROP COLUMN IF EXISTS "discovery_slots";

ALTER TABLE "User" DROP COLUMN IF EXISTS "mfaSecret";
ALTER TABLE "User" DROP COLUMN IF EXISTS "mfaEnabled";
ALTER TABLE "User" DROP COLUMN IF EXISTS "mfaRecoveryCodes";
