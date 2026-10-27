-- Owner ruling 2026-10-27 (q111, Equoria-rdg0d): riders get a weekly payday like grooms.
-- A hired rider's weekly rate is taken every Monday (Eastern). An unpaid rider cannot ride
-- that week; after a full unpaid week the rider leaves.
--
-- rider_salary_payments holds one row per rider per pay week. weekKey is the Eastern
-- Monday that starts the pay week, as 'YYYY-MM-DD'. The unique index is PARTIAL
-- (status = 'paid'): the database refuses a second paid row for one rider and week, while
-- missed-week and release rows are not limited. Prisma cannot express a partial index, so
-- it lives only in this SQL, like groom_salary_payments (Equoria-h7518).
--
-- No existing row is changed: the new riders column starts NULL (paid up) for every rider.

ALTER TABLE "riders" ADD COLUMN "feeUnpaidSince" TIMESTAMP(3);

CREATE TABLE "rider_salary_payments" (
    "id" SERIAL NOT NULL,
    "riderId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "weekKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'paid',
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rider_salary_payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "rider_salary_payments_riderId_idx" ON "rider_salary_payments"("riderId");
CREATE INDEX "rider_salary_payments_userId_weekKey_idx" ON "rider_salary_payments"("userId", "weekKey");
CREATE UNIQUE INDEX "rider_salary_payments_paid_riderId_weekKey_key"
    ON "rider_salary_payments"("riderId", "weekKey") WHERE "status" = 'paid';

ALTER TABLE "rider_salary_payments"
    ADD CONSTRAINT "rider_salary_payments_riderId_fkey"
    FOREIGN KEY ("riderId") REFERENCES "riders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rider_salary_payments"
    ADD CONSTRAINT "rider_salary_payments_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
