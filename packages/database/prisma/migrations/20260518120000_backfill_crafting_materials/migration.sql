-- Equoria-msuh (2026-05-18): Backfill craftingMaterials for pre-fix beta accounts.
--
-- Accounts created before the starter-material grant landed
-- (sprint-change-proposal-2026-04-15 §4.3) have no settings.craftingMaterials.
-- craftingController.getMaterials() then defaults every material to 0, so NO
-- Tier 0 recipe is affordable for those existing beta testers. Crafting is
-- beta-live and must work for real testers, not just freshly-registered ones.
--
-- This grants the SERVER-AUTHORITATIVE starter materials — identical to what
-- new registrations receive via authController.STARTER_CRAFTING_MATERIALS:
--   { leather: 2, cloth: 2, dye: 2, metal: 0, thread: 1 }
--
-- Idempotency / no-double-grant:
--   The WHERE clause grants ONLY where the craftingMaterials key is absent
--   (settings -> 'craftingMaterials' IS NULL). Accounts that already have the
--   key — even an all-zero stockpile a player legitimately spent down — are
--   left untouched. Re-running this migration body (or prisma migrate deploy
--   on a redeploy) matches zero rows on the second pass: fully idempotent,
--   never tops a spent stockpile back up.
--
-- Scope safety: the UPDATE is filtered to exactly the deficient rows. It is
-- NOT an unscoped table rewrite — rows that already conform are excluded by
-- the predicate, and all other settings keys are preserved because we use
-- jsonb_set on the existing settings object (additive, key-targeted).
--
-- The reusable, test-exercised mirror of this logic lives at
-- backend/scripts/backfill-crafting-materials.mjs (Equoria-msuh).

BEGIN;

UPDATE "User"
SET "settings" = jsonb_set(
  COALESCE("settings", '{}'::jsonb),
  '{craftingMaterials}',
  '{"leather": 2, "cloth": 2, "dye": 2, "metal": 0, "thread": 1}'::jsonb,
  true
)
WHERE
  COALESCE("settings", '{}'::jsonb) -> 'craftingMaterials' IS NULL;

COMMIT;
