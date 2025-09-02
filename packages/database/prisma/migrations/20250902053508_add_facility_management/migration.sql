-- CreateTable
CREATE TABLE "facilities" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "upgrades" JSONB NOT NULL DEFAULT '{}',
    "effectiveness" INTEGER NOT NULL DEFAULT 60,
    "maintenanceCost" INTEGER NOT NULL DEFAULT 100,
    "lastMaintenance" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_upgrades" (
    "id" SERIAL NOT NULL,
    "facilityId" INTEGER NOT NULL,
    "upgradeType" TEXT NOT NULL,
    "previousLevel" INTEGER NOT NULL,
    "newLevel" INTEGER NOT NULL,
    "cost" INTEGER NOT NULL,
    "effectiveness" INTEGER NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facility_upgrades_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_upgrades" ADD CONSTRAINT "facility_upgrades_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
