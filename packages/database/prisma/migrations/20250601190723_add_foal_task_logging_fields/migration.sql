-- AlterTable
ALTER TABLE "horses" ADD COLUMN     "lastGroomed" TIMESTAMP(3),
ADD COLUMN     "taskLog" JSONB;
