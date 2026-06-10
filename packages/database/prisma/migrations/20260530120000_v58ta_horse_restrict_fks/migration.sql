-- Equoria-v58ta: encode horse FKs with onDelete: Restrict
-- (amended 2026-06-10, Equoria-fefh2.14 — see "WHY DROP IF EXISTS" below)
--
-- Before:
--   horses_userId_fkey: state DIVERGED by environment (the original version of
--     this header claimed it "did NOT exist" — that was true only of the
--     drifted live databases):
--       * fresh replay DBs: EXISTS as ON DELETE SET NULL — created by
--         20250530230230_complete_schema_with_all_tables (migration.sql:304).
--       * canonical local + production: did NOT exist. Those DBs had
--         complete_schema_with_all_tables BASELINED (applied_steps_count=0,
--         marked applied without executing) after the Equoria-c3kb6 restore,
--         so the constraint was never created there and orphan rows accumulated.
--   horses_sireId_fkey: ON DELETE SET NULL
--   horses_damId_fkey:  ON DELETE SET NULL
--
-- After (all three): ON DELETE RESTRICT ON UPDATE CASCADE
--
-- WHY DROP IF EXISTS (the 2026-06-10 amendment):
--   The original migration did a bare ADD for horses_userId_fkey. That worked
--   on the drifted live DBs (constraint absent) but fails on every fresh
--   database with `constraint "horses_userId_fkey" for relation "horses"
--   already exists`, blocking CI's empty-DB migration replay (Quality Gate,
--   cookie-auth backend job, ZAP) and production's migrate deploy (recorded
--   as a failed migration there). The operation this migration always meant
--   is "REPLACE whatever delete action exists with RESTRICT", so each FK now
--   uniformly does DROP CONSTRAINT IF EXISTS + ADD. End state is identical on
--   every path; databases that already ran the original version never re-run
--   this file.
--
-- Restrict was chosen because:
--   - Cascade: deleting a user would silently wipe their entire stud history (too aggressive).
--   - SetNull: orphans the rows + loses the audit trail of who owned them.
--   - Restrict: forces callers (e.g. GDPR cascade) to explicitly delete owned horses
--     first, surfacing any stale ownership rather than hiding it.
--
-- A one-off pre-migration cleanup deleted 279 orphan-userId horses (test
-- fixture leftovers — usernames like authtestprotected_*, csrftest*,
-- docintegrationuser*) so the new userId FK constraint applies cleanly.

-- 1. Replace horses_userId_fkey (SET NULL on fresh DBs / absent on drifted DBs) -> Restrict
ALTER TABLE "horses" DROP CONSTRAINT IF EXISTS "horses_userId_fkey";
ALTER TABLE "horses"
  ADD CONSTRAINT "horses_userId_fkey"
  FOREIGN KEY ("userId")
  REFERENCES "User"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- 2. Replace horses_sireId_fkey SetNull -> Restrict
ALTER TABLE "horses" DROP CONSTRAINT IF EXISTS "horses_sireId_fkey";
ALTER TABLE "horses"
  ADD CONSTRAINT "horses_sireId_fkey"
  FOREIGN KEY ("sireId")
  REFERENCES "horses"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- 3. Replace horses_damId_fkey SetNull -> Restrict
ALTER TABLE "horses" DROP CONSTRAINT IF EXISTS "horses_damId_fkey";
ALTER TABLE "horses"
  ADD CONSTRAINT "horses_damId_fkey"
  FOREIGN KEY ("damId")
  REFERENCES "horses"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
