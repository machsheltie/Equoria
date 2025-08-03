-- AlterTable
ALTER TABLE "public"."grooms" ADD COLUMN     "rareTraitPerks" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "public"."horses" ADD COLUMN     "ultraRareTraits" JSONB DEFAULT '{"ultraRare": [], "exotic": []}';

-- CreateTable
CREATE TABLE "public"."ultra_rare_trait_events" (
    "id" SERIAL NOT NULL,
    "horseId" INTEGER NOT NULL,
    "traitName" TEXT NOT NULL,
    "traitTier" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "baseChance" DECIMAL(5,4),
    "finalChance" DECIMAL(5,4),
    "groomId" INTEGER,
    "appliedPerks" JSONB DEFAULT '[]',
    "triggerConditions" JSONB DEFAULT '{}',
    "success" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ultra_rare_trait_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ultra_rare_trait_events_horseId_idx" ON "public"."ultra_rare_trait_events"("horseId");

-- CreateIndex
CREATE INDEX "ultra_rare_trait_events_traitName_idx" ON "public"."ultra_rare_trait_events"("traitName");

-- CreateIndex
CREATE INDEX "ultra_rare_trait_events_traitTier_idx" ON "public"."ultra_rare_trait_events"("traitTier");

-- CreateIndex
CREATE INDEX "ultra_rare_trait_events_eventType_idx" ON "public"."ultra_rare_trait_events"("eventType");

-- CreateIndex
CREATE INDEX "ultra_rare_trait_events_groomId_idx" ON "public"."ultra_rare_trait_events"("groomId");

-- CreateIndex
CREATE INDEX "ultra_rare_trait_events_timestamp_idx" ON "public"."ultra_rare_trait_events"("timestamp");

-- CreateIndex
CREATE INDEX "ultra_rare_trait_events_horseId_traitName_idx" ON "public"."ultra_rare_trait_events"("horseId", "traitName");

-- AddForeignKey
ALTER TABLE "public"."ultra_rare_trait_events" ADD CONSTRAINT "ultra_rare_trait_events_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "public"."horses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ultra_rare_trait_events" ADD CONSTRAINT "ultra_rare_trait_events_groomId_fkey" FOREIGN KEY ("groomId") REFERENCES "public"."grooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
