-- Equoria-wnlf0 (audit BRE-11, 2026-10-28): link each breeding record to the
-- foal it produced. The foaling transaction sets "foalId" on the dam's latest
-- COMPLETED record for the same sire. One foal per breeding, so it is unique.
-- Existing rows stay null (no backfill: the link is not derivable reliably).

-- AlterTable
ALTER TABLE "breeding_records" ADD COLUMN "foalId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "breeding_records_foalId_key" ON "breeding_records"("foalId");

-- AddForeignKey
ALTER TABLE "breeding_records" ADD CONSTRAINT "breeding_records_foalId_fkey" FOREIGN KEY ("foalId") REFERENCES "horses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
