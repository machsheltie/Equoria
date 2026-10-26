-- Owner ruling 2026-10-26 (q65), Equoria-h7518: the database itself refuses a second paid
-- weekly salary for the same groom in the same pay week. The application already prevents
-- it (an advisory lock plus a read of the paid rows, Equoria-icqqm); this is the guarantee
-- that survives a logic bug.
--
-- weekKey is the pay week: the Eastern (game-clock) Monday that starts it, as 'YYYY-MM-DD'.
--
-- WHY THE UNIQUE INDEX IS PARTIAL (status = 'paid'). A pay week can legitimately carry more
-- than one row for one groom: a fee missed twice in the same week writes a
-- 'missedInsufficientFunds' row and then a 'missedGracePeriod' row, and a missed week can be
-- paid later, so a 'paid' row sits beside a missed one. What must never happen twice is
-- the PAID row. A plain unique over every status would make the second missed row (and the
-- later payment) fail. Prisma cannot express a partial index, so it lives only in this SQL,
-- like the three active-assignment indexes (Equoria-kccmt).
--
-- NO PAYROLL ROW IS DELETED. If the backfill finds two paid rows for one groom and week,
-- the migration stops with an error naming how many, and nothing is changed: a person looks
-- at the money first.

ALTER TABLE "groom_salary_payments" ADD COLUMN IF NOT EXISTS "weekKey" TEXT;

-- paymentDate is stored as UTC wall-clock time. Read it as UTC, move it to Eastern, and
-- take the Monday of that Eastern week (date_trunc('week') starts on Monday). A missed
-- row is dated with the pay week's own Monday midnight, so it lands on that same Monday.
UPDATE "groom_salary_payments"
   SET "weekKey" = to_char(
         date_trunc('week', ("paymentDate" AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York'),
         'YYYY-MM-DD')
 WHERE "weekKey" IS NULL;

DO $$
DECLARE
  duplicateWeeks integer;
BEGIN
  SELECT count(*) INTO duplicateWeeks FROM (
    SELECT 1
      FROM "groom_salary_payments"
     WHERE "status" = 'paid'
     GROUP BY "userId", "groomId", "weekKey", "paymentType"
    HAVING count(*) > 1
  ) AS duplicates;
  IF duplicateWeeks > 0 THEN
    RAISE EXCEPTION 'groom_salary_payments has % groom-and-week combinations with more than one paid row; resolve them by hand (no payroll row was changed) and run the migration again', duplicateWeeks;
  END IF;
END
$$;

CREATE UNIQUE INDEX "groom_salary_payments_paid_week_key"
  ON "groom_salary_payments" ("userId", "groomId", "weekKey", "paymentType")
  WHERE "status" = 'paid';
