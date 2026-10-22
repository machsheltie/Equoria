-- Owner ruling 2026-10-21 (Stacey): Equoria names are camelCase, stored game
-- values included.
--
-- Groom specialities foal_care, general_grooming, specialized_disciplines ->
-- foalCare, generalGrooming, specializedDisciplines, in grooms.speciality and in
-- the copy a groomRetired notification carries in payload.speciality.
--
-- Rows written by the roster hire path held foal_care while the marketplace
-- generator wrote foalCare, and every foal-care rule matches foalCare only.
-- Owner ruling 2026-10-22: unify anyway, accepting that grooms stored as
-- foal_care now receive the foal-care rules the game already defines.
--
-- audit_logs.metadata is NOT touched: it records request bodies exactly as
-- clients sent them.
--
-- Idempotent: a second run matches no row. The closing check aborts the whole
-- migration if any old spelling survives.

BEGIN;

CREATE TEMP TABLE "groom_speciality_rename" ("old" TEXT PRIMARY KEY, "new" TEXT NOT NULL) ON COMMIT DROP;

INSERT INTO "groom_speciality_rename" ("old", "new") VALUES
  ('foal_care', 'foalCare'),
  ('general_grooming', 'generalGrooming'),
  ('specialized_disciplines', 'specializedDisciplines');

UPDATE "grooms" g SET "speciality" = r."new"
FROM "groom_speciality_rename" r
WHERE g."speciality" = r."old";

UPDATE "Notification" n
SET "payload" = jsonb_set(n."payload", '{speciality}', to_jsonb(r."new"))
FROM "groom_speciality_rename" r
WHERE jsonb_typeof(n."payload") = 'object' AND n."payload"->>'speciality' = r."old";

DO $$
DECLARE
  leftover INTEGER;
BEGIN
  SELECT
    (SELECT COUNT(*) FROM "grooms" g
     JOIN "groom_speciality_rename" r ON g."speciality" = r."old")
    + (SELECT COUNT(*) FROM "Notification" n
       JOIN "groom_speciality_rename" r
         ON jsonb_typeof(n."payload") = 'object' AND n."payload"->>'speciality' = r."old")
  INTO leftover;
  IF leftover > 0 THEN
    RAISE EXCEPTION 'groom_speciality_camelcase: % row(s) still hold an old spelling; aborting', leftover;
  END IF;
END $$;

COMMIT;
