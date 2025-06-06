-- AlterTable
ALTER TABLE "horses" ADD COLUMN     "burnoutStatus" TEXT DEFAULT 'none',
ADD COLUMN     "daysGroomedInARow" INTEGER DEFAULT 0,
ALTER COLUMN "bondScore" SET DEFAULT 0;
