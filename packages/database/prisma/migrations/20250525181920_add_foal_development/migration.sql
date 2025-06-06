-- CreateTable
CREATE TABLE "foal_development" (
    "id" SERIAL NOT NULL,
    "currentDay" INTEGER NOT NULL DEFAULT 0,
    "bondingLevel" INTEGER NOT NULL DEFAULT 50,
    "stressLevel" INTEGER NOT NULL DEFAULT 20,
    "completedActivities" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "foalId" INTEGER NOT NULL,

    CONSTRAINT "foal_development_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "foal_activities" (
    "id" SERIAL NOT NULL,
    "day" INTEGER NOT NULL,
    "activityType" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "bondingChange" INTEGER NOT NULL,
    "stressChange" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "foalId" INTEGER NOT NULL,

    CONSTRAINT "foal_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "foal_development_foalId_key" ON "foal_development"("foalId");

-- AddForeignKey
ALTER TABLE "foal_development" ADD CONSTRAINT "foal_development_foalId_fkey" FOREIGN KEY ("foalId") REFERENCES "Horse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "foal_activities" ADD CONSTRAINT "foal_activities_foalId_fkey" FOREIGN KEY ("foalId") REFERENCES "Horse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
