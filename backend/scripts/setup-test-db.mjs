/**
 * @deprecated UNUSED LEGACY INFRA — recommended for deletion (Equoria-wml3k).
 *
 * This script hand-rolls a raw-SQL test-DB schema (CREATE TABLE ...) that
 * (1) is referenced by NOTHING in the current codebase — no package.json
 *     script, no jest config / globalSetup, no CI workflow, no other script
 *     imports or invokes it (verified by repo-wide grep, 2026-05-27); and
 * (2) directly contradicts CLAUDE.md NON-NEGOTIABLE Rule 2 "REAL DB ONLY":
 *     there is NO separate test database. `.env.test` points at the canonical
 *     Equoria DB, which is already migrated by Prisma. The active test
 *     bootstrap (`backend/tests/globalSetup.mjs`) creates NO schema — it only
 *     cleans leftover test rows; and
 * (3) its raw schema has drifted badly from the canonical Prisma schema
 *     (`packages/database/prisma/schema.prisma`): `ownerId INTEGER` vs
 *     canonical `userId String?`/uuid, snake_case `date_of_birth` vs camelCase
 *     `dateOfBirth`, INT user PK vs uuid, `bond_score DEFAULT 50` vs canonical
 *     default 0, and it omits many current columns (temperament, colorGenotype,
 *     phenotype, etc).
 *
 * It is NOT fixed to match the canonical schema because it is dead and running
 * it against the real canonical DB would be harmful (it would attempt to CREATE
 * a divergent `horses`/`users` schema). Deletion is a removal decision left to
 * the lead/user; this header is a low-risk annotation only. See Equoria-wml3k.
 *
 * --- Original (stale) description: ---
 * This script initializes the test database by directly creating necessary tables
 * for the authentication tests to work.
 */

import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Load environment variables
dotenv.config({ path: '.env.test' });

// Create a Prisma client instance
const prisma = new PrismaClient();

async function setupTestDb() {
  try {
    // console.log('Starting test database setup...');

    // Add User table directly with SQL (if it doesn't exist)
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" SERIAL PRIMARY KEY,
        "name" TEXT,
        "email" TEXT NOT NULL UNIQUE,
        "username" TEXT NOT NULL UNIQUE,
        "firstName" TEXT NOT NULL,
        "lastName" TEXT NOT NULL,
        "password" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'user',
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "lastLoginAt" TIMESTAMP(3),
        "money" INTEGER NOT NULL DEFAULT 1000,
        "level" INTEGER NOT NULL DEFAULT 1,
        "xp" INTEGER NOT NULL DEFAULT 0,
        "settings" JSONB NOT NULL DEFAULT '{}'
      );
    `;

    // Create Breed table (needed for Horse table references)
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Breed" (
        "id" SERIAL PRIMARY KEY,
        "name" TEXT NOT NULL UNIQUE,
        "description" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Create Stable table (needed for Horse table references)
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Stable" (
        "id" SERIAL PRIMARY KEY,
        "name" TEXT
      );
    `;

    // Create Horse table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "horses" (
        "id" SERIAL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "age" INTEGER NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "breedId" INTEGER NOT NULL,
        "ownerId" INTEGER NOT NULL,
        "stableId" INTEGER,
        "sex" TEXT,
        "date_of_birth" TIMESTAMP(3),
        "genotype" JSONB,
        "phenotypic_markings" JSONB,
        "final_display_color" TEXT,
        "shade" TEXT,
        "image_url" TEXT,
        "sire_id" INTEGER,
        "dam_id" INTEGER,
        "stud_status" TEXT,
        "stud_fee" DOUBLE PRECISION,
        "last_bred_date" TIMESTAMP(3),
        "for_sale" BOOLEAN DEFAULT false,
        "sale_price" DOUBLE PRECISION DEFAULT 0,
        "health_status" TEXT,
        "last_vetted_date" TIMESTAMP(3),
        "tack" JSONB,
        "trainingCooldown" TIMESTAMP(3),
        "earnings" DOUBLE PRECISION DEFAULT 0,
        "rider" JSONB,
        "disciplineScores" JSONB,
        "bond_score" INTEGER DEFAULT 50,
        "stress_level" INTEGER DEFAULT 0,
        "epigenetic_modifiers" JSONB DEFAULT '{"positive": [], "negative": [], "hidden": []}',
        FOREIGN KEY ("breedId") REFERENCES "Breed"("id"),
        FOREIGN KEY ("ownerId") REFERENCES "users"("id"),
        FOREIGN KEY ("stableId") REFERENCES "Stable"("id")
      );
    `;

    // Create TrainingLog table
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "training_logs" (
        "id" SERIAL PRIMARY KEY,
        "discipline" TEXT NOT NULL,
        "trainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "horseId" INTEGER NOT NULL,
        FOREIGN KEY ("horseId") REFERENCES "horses"("id")
      );
    `;

    // Add some basic data for testing
    // Add a breed
    await prisma.$executeRaw`
      INSERT INTO "Breed" ("name", "description", "updatedAt")
      VALUES ('Thoroughbred', 'A horse breed known for its agility, speed and spirit.', CURRENT_TIMESTAMP)
      ON CONFLICT ("name") DO NOTHING;
    `;

    // console.log('Test database setup complete!');
  } catch (error) {
    throw new Error(`Error setting up test database: ${error}`);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the setup
setupTestDb();
