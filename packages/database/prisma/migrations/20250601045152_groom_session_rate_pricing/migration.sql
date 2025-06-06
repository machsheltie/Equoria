/*
  Warnings:

  - You are about to drop the column `hourlyRate` on the `grooms` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "grooms" DROP COLUMN "hourlyRate",
ADD COLUMN     "sessionRate" DECIMAL(10,2) NOT NULL DEFAULT 15.0;
