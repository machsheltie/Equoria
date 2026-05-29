-- Equoria-v58ta: encode horse FKs with onDelete: Restrict
--
-- Before:
--   horses_userId_fkey: did NOT exist (Prisma silent default — orphan rows accumulated)
--   horses_sireId_fkey: ON DELETE SET NULL
--   horses_damId_fkey:  ON DELETE SET NULL
--
-- After (all three): ON DELETE RESTRICT ON UPDATE CASCADE
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

-- 1. Add the missing horses_userId_fkey constraint with RESTRICT
ALTER TABLE "horses"
  ADD CONSTRAINT "horses_userId_fkey"
  FOREIGN KEY ("userId")
  REFERENCES "User"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- 2. Replace horses_sireId_fkey SetNull -> Restrict
ALTER TABLE "horses" DROP CONSTRAINT "horses_sireId_fkey";
ALTER TABLE "horses"
  ADD CONSTRAINT "horses_sireId_fkey"
  FOREIGN KEY ("sireId")
  REFERENCES "horses"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- 3. Replace horses_damId_fkey SetNull -> Restrict
ALTER TABLE "horses" DROP CONSTRAINT "horses_damId_fkey";
ALTER TABLE "horses"
  ADD CONSTRAINT "horses_damId_fkey"
  FOREIGN KEY ("damId")
  REFERENCES "horses"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
