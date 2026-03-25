// Population script for breed genetic profiles.
// Ensures the canonical 12 breeds exist and populates breedGeneticProfile JSONB.
// Idempotent: safe to run multiple times.

import { PrismaClient } from '../../packages/database/node_modules/@prisma/client/index.js';
import {
  CANONICAL_BREEDS,
  BREED_GENETIC_PROFILES,
} from '../modules/horses/data/breedGeneticProfiles.mjs';

const prisma = new PrismaClient();

/**
 * Ensures all 12 canonical breeds exist in the database.
 * Creates any missing breeds with the correct ID, name, and description.
 */
async function ensureCanonicalBreeds() {
  const results = { created: 0, existing: 0, errors: [] };

  for (const breed of CANONICAL_BREEDS) {
    try {
      const existing = await prisma.breed.findUnique({ where: { id: breed.id } });
      if (existing) {
        results.existing++;
        console.log(`  [SKIP] Breed ID ${breed.id} "${existing.name}" already exists`);
      } else {
        await prisma.breed.create({
          data: { id: breed.id, name: breed.name, description: breed.description },
        });
        results.created++;
        console.log(`  [CREATE] Breed ID ${breed.id} "${breed.name}"`);
      }
    } catch (error) {
      results.errors.push({ breedId: breed.id, error: error.message });
      console.log(`  [ERROR] Breed ID ${breed.id}: ${error.message}`);
    }
  }

  return results;
}

/**
 * Populates breedGeneticProfile JSONB on all 12 breeds.
 * Overwrites existing profile data (idempotent).
 */
async function populateGeneticProfiles() {
  const results = { updated: 0, errors: [] };

  for (const [breedId, profile] of Object.entries(BREED_GENETIC_PROFILES)) {
    try {
      await prisma.breed.update({
        where: { id: Number(breedId) },
        data: { breedGeneticProfile: profile },
      });
      results.updated++;
      console.log(`  [UPDATE] Breed ID ${breedId} — genetic profile populated`);
    } catch (error) {
      results.errors.push({ breedId, error: error.message });
      console.log(`  [ERROR] Breed ID ${breedId}: ${error.message}`);
    }
  }

  return results;
}

/**
 * Main population function. Exported for use in seed scripts and tests.
 */
export async function populateBreedGeneticProfiles() {
  console.log('\n=== Populating Breed Genetic Profiles ===\n');

  console.log('Step 1: Ensuring canonical breeds exist...');
  const breedResults = await ensureCanonicalBreeds();
  console.log(
    `  Created: ${breedResults.created}, Existing: ${breedResults.existing}, Errors: ${breedResults.errors.length}`,
  );

  console.log('\nStep 2: Populating genetic profiles...');
  const profileResults = await populateGeneticProfiles();
  console.log(`  Updated: ${profileResults.updated}, Errors: ${profileResults.errors.length}`);

  console.log('\n=== Population Complete ===\n');

  return {
    breeds: breedResults,
    profiles: profileResults,
    success: breedResults.errors.length === 0 && profileResults.errors.length === 0,
  };
}

// Direct execution support: node backend/seed/populateBreedGeneticProfiles.mjs
const isDirectRun = process.argv[1] && process.argv[1].includes('populateBreedGeneticProfiles');
if (isDirectRun) {
  populateBreedGeneticProfiles()
    .then(result => {
      if (!result.success) {
        console.error('Population completed with errors');
        process.exit(1);
      }
      process.exit(0);
    })
    .catch(error => {
      console.error('Population failed:', error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
