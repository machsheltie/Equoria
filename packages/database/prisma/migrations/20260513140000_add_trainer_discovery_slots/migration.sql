-- AddColumn: discovery_slots on trainers table
ALTER TABLE "trainers" ADD COLUMN "discovery_slots" JSONB NOT NULL DEFAULT '[]';
