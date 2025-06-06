/*
  Warnings:

  - The primary key for the `Horse` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `age` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `agility` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `balance` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `boldness` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `bond_score` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `breedId` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `dam_id` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `date_of_birth` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `disciplineScores` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `earnings` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `endurance` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `epigenetic_modifiers` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `final_display_color` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `flexibility` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `focus` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `for_sale` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `genotype` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `health_status` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `image_url` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `intelligence` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `last_bred_date` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `last_vetted_date` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `obedience` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `personality` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `phenotypic_markings` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `precision` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `rider` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `sale_price` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `sex` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `shade` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `sire_id` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `speed` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `stableId` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `stamina` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `strength` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `stress_level` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `stud_fee` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `stud_status` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `tack` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `temperament` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `total_earnings` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `trainingCooldown` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the column `trait` on the `Horse` table. All the data in the column will be lost.
  - You are about to drop the `Breed` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Stable` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `competition_results` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `foal_activities` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `foal_development` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `foal_training_history` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `groom_assignments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `groom_interactions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `grooms` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `shows` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `training_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `xp_events` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `updatedAt` to the `Horse` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Horse" DROP CONSTRAINT "Horse_breedId_fkey";

-- DropForeignKey
ALTER TABLE "Horse" DROP CONSTRAINT "Horse_stableId_fkey";

-- DropForeignKey
ALTER TABLE "Horse" DROP CONSTRAINT "Horse_userId_fkey";

-- DropForeignKey
ALTER TABLE "competition_results" DROP CONSTRAINT "competition_results_horseId_fkey";

-- DropForeignKey
ALTER TABLE "competition_results" DROP CONSTRAINT "competition_results_showId_fkey";

-- DropForeignKey
ALTER TABLE "foal_activities" DROP CONSTRAINT "foal_activities_foalId_fkey";

-- DropForeignKey
ALTER TABLE "foal_development" DROP CONSTRAINT "foal_development_foalId_fkey";

-- DropForeignKey
ALTER TABLE "foal_training_history" DROP CONSTRAINT "foal_training_history_horse_id_fkey";

-- DropForeignKey
ALTER TABLE "groom_assignments" DROP CONSTRAINT "groom_assignments_foalId_fkey";

-- DropForeignKey
ALTER TABLE "groom_assignments" DROP CONSTRAINT "groom_assignments_groomId_fkey";

-- DropForeignKey
ALTER TABLE "groom_assignments" DROP CONSTRAINT "groom_assignments_userId_fkey";

-- DropForeignKey
ALTER TABLE "groom_interactions" DROP CONSTRAINT "groom_interactions_assignmentId_fkey";

-- DropForeignKey
ALTER TABLE "groom_interactions" DROP CONSTRAINT "groom_interactions_foalId_fkey";

-- DropForeignKey
ALTER TABLE "groom_interactions" DROP CONSTRAINT "groom_interactions_groomId_fkey";

-- DropForeignKey
ALTER TABLE "grooms" DROP CONSTRAINT "grooms_userId_fkey";

-- DropForeignKey
ALTER TABLE "training_logs" DROP CONSTRAINT "training_logs_horseId_fkey";

-- DropForeignKey
ALTER TABLE "xp_events" DROP CONSTRAINT "xp_events_userId_fkey";

-- AlterTable
ALTER TABLE "Horse" DROP CONSTRAINT "Horse_pkey",
DROP COLUMN "age",
DROP COLUMN "agility",
DROP COLUMN "balance",
DROP COLUMN "boldness",
DROP COLUMN "bond_score",
DROP COLUMN "breedId",
DROP COLUMN "dam_id",
DROP COLUMN "date_of_birth",
DROP COLUMN "disciplineScores",
DROP COLUMN "earnings",
DROP COLUMN "endurance",
DROP COLUMN "epigenetic_modifiers",
DROP COLUMN "final_display_color",
DROP COLUMN "flexibility",
DROP COLUMN "focus",
DROP COLUMN "for_sale",
DROP COLUMN "genotype",
DROP COLUMN "health_status",
DROP COLUMN "image_url",
DROP COLUMN "intelligence",
DROP COLUMN "last_bred_date",
DROP COLUMN "last_vetted_date",
DROP COLUMN "obedience",
DROP COLUMN "personality",
DROP COLUMN "phenotypic_markings",
DROP COLUMN "precision",
DROP COLUMN "rider",
DROP COLUMN "sale_price",
DROP COLUMN "sex",
DROP COLUMN "shade",
DROP COLUMN "sire_id",
DROP COLUMN "speed",
DROP COLUMN "stableId",
DROP COLUMN "stamina",
DROP COLUMN "strength",
DROP COLUMN "stress_level",
DROP COLUMN "stud_fee",
DROP COLUMN "stud_status",
DROP COLUMN "tack",
DROP COLUMN "temperament",
DROP COLUMN "total_earnings",
DROP COLUMN "trainingCooldown",
DROP COLUMN "trait",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "userId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Horse_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Horse_id_seq";

-- DropTable
DROP TABLE "Breed";

-- DropTable
DROP TABLE "Stable";

-- DropTable
DROP TABLE "competition_results";

-- DropTable
DROP TABLE "foal_activities";

-- DropTable
DROP TABLE "foal_development";

-- DropTable
DROP TABLE "foal_training_history";

-- DropTable
DROP TABLE "groom_assignments";

-- DropTable
DROP TABLE "groom_interactions";

-- DropTable
DROP TABLE "grooms";

-- DropTable
DROP TABLE "shows";

-- DropTable
DROP TABLE "training_logs";

-- DropTable
DROP TABLE "users";

-- DropTable
DROP TABLE "xp_events";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "money" INTEGER NOT NULL DEFAULT 1000,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "Horse_userId_idx" ON "Horse"("userId");

-- AddForeignKey
ALTER TABLE "Horse" ADD CONSTRAINT "Horse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
