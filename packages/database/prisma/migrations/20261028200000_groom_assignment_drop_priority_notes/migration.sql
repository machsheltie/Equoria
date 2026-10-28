-- Owner ruling 2026-10-28 (Equoria-ekrab): "There is no priority level. Do NOT
-- invent systems without my approval." The groom assignment priority (1-5)
-- and the assignment notes were never game rules; the Assign Groom screen no
-- longer offers them and no code reads or writes them.
ALTER TABLE "groom_assignments" DROP COLUMN IF EXISTS "priority";
ALTER TABLE "groom_assignments" DROP COLUMN IF EXISTS "notes";
