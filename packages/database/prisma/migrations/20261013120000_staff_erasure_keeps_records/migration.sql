-- Equoria-2yugk: erasing a former steward keeps the staff record.
-- The action log keeps actorId with no FK; tickets and replies keep their rows
-- with the filer or author set to NULL.

-- DropForeignKey
ALTER TABLE "staff_action_log" DROP CONSTRAINT "staff_action_log_actorId_fkey";

-- DropForeignKey
ALTER TABLE "staff_ticket_replies" DROP CONSTRAINT "staff_ticket_replies_authorId_fkey";

-- DropForeignKey
ALTER TABLE "staff_tickets" DROP CONSTRAINT "staff_tickets_filedById_fkey";

-- AlterTable
ALTER TABLE "staff_ticket_replies" ALTER COLUMN "authorId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "staff_tickets" ALTER COLUMN "filedById" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "staff_tickets" ADD CONSTRAINT "staff_tickets_filedById_fkey" FOREIGN KEY ("filedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_ticket_replies" ADD CONSTRAINT "staff_ticket_replies_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
