-- Equoria-q4uem.9 (2026-10-16): breeding records and the private-stud request queue.
--
-- Owner rulings (Stacey): 2026-10-12 (another player's stallion costs its
-- player-set stud fee, own pair free), 2026-10-15 (Public Stud / Private Stud,
-- S1-S10) and 2026-10-16 (S-Q4 pending-request lock, S-Q7 one record per
-- breeding with the stud fee paid, 0 for an own pair).
--
-- Body generated with
--   prisma migrate diff --from-schema-datamodel <previous schema.prisma>
--                       --to-schema-datamodel prisma/schema.prisma --script
-- plus ONE hand-written statement at the end: the PARTIAL unique index that
-- allows at most one PENDING request per mare (S7). Prisma cannot express a
-- partial index (see the kccmt note on the Horse model and
-- 20260907120000_kccmt_partial_unique_active_staff_assignments).

-- CreateEnum
CREATE TYPE "BreedingKind" AS ENUM ('OWN_PAIR', 'PUBLIC_STUD', 'PRIVATE_STUD');

-- CreateEnum
CREATE TYPE "BreedingStatus" AS ENUM ('PENDING', 'COMPLETED', 'DECLINED', 'CANCELLED');

-- CreateTable
CREATE TABLE "breeding_records" (
    "id" SERIAL NOT NULL,
    "kind" "BreedingKind" NOT NULL,
    "status" "BreedingStatus" NOT NULL,
    "fee" INTEGER NOT NULL,
    "sireId" INTEGER,
    "damId" INTEGER,
    "mareOwnerId" TEXT,
    "stallionOwnerId" TEXT,
    "sireName" TEXT NOT NULL,
    "damName" TEXT NOT NULL,
    "mareOwnerName" TEXT NOT NULL,
    "stallionOwnerName" TEXT NOT NULL,
    "declineReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "breeding_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "breeding_records_stallionOwnerId_status_idx" ON "breeding_records"("stallionOwnerId", "status");

-- CreateIndex
CREATE INDEX "breeding_records_mareOwnerId_status_idx" ON "breeding_records"("mareOwnerId", "status");

-- CreateIndex
CREATE INDEX "breeding_records_damId_status_idx" ON "breeding_records"("damId", "status");

-- CreateIndex
CREATE INDEX "breeding_records_sireId_status_idx" ON "breeding_records"("sireId", "status");

-- AddForeignKey
ALTER TABLE "breeding_records" ADD CONSTRAINT "breeding_records_sireId_fkey" FOREIGN KEY ("sireId") REFERENCES "horses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breeding_records" ADD CONSTRAINT "breeding_records_damId_fkey" FOREIGN KEY ("damId") REFERENCES "horses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breeding_records" ADD CONSTRAINT "breeding_records_mareOwnerId_fkey" FOREIGN KEY ("mareOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breeding_records" ADD CONSTRAINT "breeding_records_stallionOwnerId_fkey" FOREIGN KEY ("stallionOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- One PENDING request per mare (ruling S7). Hand-written: partial index.
-- A NULL damId (horse erased under GDPR, FK SetNull) never collides.
CREATE UNIQUE INDEX "breeding_records_one_pending_per_dam" ON "breeding_records"("damId") WHERE "status" = 'PENDING';
