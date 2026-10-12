-- Equoria-mwjst (Codex review 2026-10-12, owner ruling 2026-10-12): a
-- conformation entry keeps the groom it was entered with. "The groom has
-- already been paid for to use for those entries, therefore they get to use
-- said groom for them." Settlement scores the entry with this groom even if
-- the groom's assignment to the horse has ended by the night the show runs.
--
-- Additive and nullable: ridden entries have no groom, and code that does not
-- know the column keeps working. Existing rows stay NULL (settlement falls back
-- to the horse's active assignment for those). Grooms are deleted only by GDPR
-- account deletion, which removes the same player's horses and entries; SET
-- NULL is the safety net, not a path the game takes.

-- AlterTable
ALTER TABLE "show_entries" ADD COLUMN     "groomId" INTEGER;

-- CreateIndex
CREATE INDEX "show_entries_groomId_idx" ON "show_entries"("groomId");

-- AddForeignKey
ALTER TABLE "show_entries" ADD CONSTRAINT "show_entries_groomId_fkey" FOREIGN KEY ("groomId") REFERENCES "grooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
