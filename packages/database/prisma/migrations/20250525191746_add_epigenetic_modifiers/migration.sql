-- AlterTable
ALTER TABLE "Horse" ADD COLUMN     "epigenetic_modifiers" JSONB DEFAULT '{"positive": [], "negative": [], "hidden": []}';
