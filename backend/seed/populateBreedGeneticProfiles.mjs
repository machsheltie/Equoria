// Population script for breed genetic profiles.
// Ensures the canonical 12 breeds exist and populates breedGeneticProfile JSONB.
// Idempotent: safe to run multiple times.

import prisma from '../db/index.mjs';
import {
  CANONICAL_BREEDS,
  BREED_GENETIC_PROFILES,
} from '../modules/horses/data/breedGeneticProfiles.mjs';

/**
 * Ensures all 12 canonical breeds exist in the database.
 * Creates any missing breeds with the correct ID, name, and description.
 *
 * Resilience strategy: checks by BOTH id and name before attempting create.
 * If the canonical name already exists at any ID (e.g. from a prior seed or
 * a DB that pre-existed migrations), we count it as existing and skip — the
 * genetic profile population step uses the ID from BREED_GENETIC_PROFILES and
 * will succeed if the name-keyed row is present. If the target ID is occupied
 * by a non-canonical name (test fixture) we log a warning but still skip to
 * avoid destroying game data.
 */
export async function ensureCanonicalBreeds() {
  const results = { created: 0, existing: 0, errors: [] };

  for (const breed of CANONICAL_BREEDS) {
    try {
      // Check by canonical ID first
      const existingById = await prisma.breed.findUnique({ where: { id: breed.id } });
      if (existingById) {
        results.existing++;
        if (existingById.name !== breed.name) {
          console.log(
            `  [WARN] Breed ID ${breed.id} exists but has name "${existingById.name}" instead of "${breed.name}" — skipping`,
          );
        } else {
          console.log(`  [SKIP] Breed ID ${breed.id} "${existingById.name}" already exists`);
        }
        continue;
      }

      // Check by canonical name (unique constraint) — may exist at a different ID
      const existingByName = await prisma.breed.findUnique({ where: { name: breed.name } });
      if (existingByName) {
        results.existing++;
        console.log(
          `  [SKIP-NAME] Breed "${breed.name}" exists at ID ${existingByName.id} (expected ${breed.id}) — treating as existing`,
        );
        continue;
      }

      // Neither ID nor name exists — safe to create
      await prisma.breed.create({
        data: { id: breed.id, name: breed.name, description: breed.description },
      });
      results.created++;
      console.log(`  [CREATE] Breed ID ${breed.id} "${breed.name}"`);
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
 *
 * Looks up breeds by canonical name (not by ID) so it is resilient to
 * auto-increment drift on shared/production databases where the canonical
 * seed IDs may differ from the actual row IDs.
 */
async function populateGeneticProfiles() {
  const results = { updated: 0, errors: [] };

  // Build a canonical ID → name lookup from CANONICAL_BREEDS
  const idToName = Object.fromEntries(CANONICAL_BREEDS.map(b => [b.id, b.name]));

  for (const [canonicalId, profile] of Object.entries(BREED_GENETIC_PROFILES)) {
    const breedName = idToName[Number(canonicalId)];
    if (!breedName) {
      results.errors.push({
        breedId: canonicalId,
        error: `No canonical name for breed ID ${canonicalId}`,
      });
      continue;
    }

    try {
      // Find the actual DB row by name (resilient to ID drift)
      const dbBreed = await prisma.breed.findUnique({ where: { name: breedName } });
      if (!dbBreed) {
        results.errors.push({
          breedId: canonicalId,
          error: `Breed "${breedName}" not found in database`,
        });
        console.log(
          `  [ERROR] Breed "${breedName}" (canonical ID ${canonicalId}) not found — run ensureCanonicalBreeds first`,
        );
        continue;
      }

      await prisma.breed.update({
        where: { id: dbBreed.id },
        data: { breedGeneticProfile: profile },
      });
      results.updated++;
      console.log(
        `  [UPDATE] Breed "${breedName}" (DB ID ${dbBreed.id}, canonical ID ${canonicalId}) — genetic profile populated`,
      );
    } catch (error) {
      results.errors.push({ breedId: canonicalId, error: error.message });
      console.log(`  [ERROR] Breed "${breedName}" (canonical ID ${canonicalId}): ${error.message}`);
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

/**
 * Validates a breed genetic profile object at runtime.
 * Returns an array of error strings; empty array means the profile is valid.
 *
 * @param {number} _breedId - reserved for future breed-specific rules
 * @param {object} profile  - the profile to validate
 * @returns {string[]}
 */
export function validateProfile(_breedId, profile) {
  const errors = [];

  if (profile === null || profile === undefined || typeof profile !== 'object') {
    errors.push('profile is null, undefined, or not an object');
    return errors;
  }

  if (!profile.rating_profiles) {
    errors.push('missing rating_profiles');
    return errors;
  }

  const rp = profile.rating_profiles;

  // ── Conformation ────────────────────────────────────────────────────────
  const EXPECTED_CONFORMATION_REGIONS = [
    'head',
    'neck',
    'shoulders',
    'back',
    'hindquarters',
    'legs',
    'hooves',
    'topline',
  ];
  const conformation = rp.conformation ?? {};
  const conformationKeys = Object.keys(conformation);

  if (conformationKeys.length !== EXPECTED_CONFORMATION_REGIONS.length) {
    errors.push(
      `conformation has ${conformationKeys.length} regions, expected ${EXPECTED_CONFORMATION_REGIONS.length}`,
    );
  }

  for (const region of EXPECTED_CONFORMATION_REGIONS) {
    if (!conformation[region]) {
      errors.push(`missing conformation region: ${region}`);
      continue;
    }
    const { mean, std_dev } = conformation[region];
    if (!Number.isFinite(mean)) {
      errors.push(`conformation.${region}.mean is not a finite number`);
    } else if (mean < 0 || mean > 100) {
      errors.push(`conformation.${region}.mean out of range (got ${mean})`);
    }
    if (!Number.isFinite(std_dev)) {
      errors.push(`conformation.${region}.std_dev is not a finite number`);
    }
  }

  // ── Gaits ────────────────────────────────────────────────────────────────
  const REQUIRED_GAITS = ['walk', 'trot', 'canter', 'gallop'];
  const gaits = rp.gaits ?? {};
  const isGaited = rp.is_gaited_breed === true;

  for (const gait of REQUIRED_GAITS) {
    if (!gaits[gait]) {
      errors.push(`missing gait: ${gait}`);
      continue;
    }
    if (!Number.isFinite(gaits[gait].mean)) {
      errors.push(`gaits.${gait}.mean is not a finite number`);
    }
  }

  if (isGaited) {
    if (gaits.gaiting === null || gaits.gaiting === undefined) {
      errors.push('gaited breed must have non-null gaiting score');
    }
    if (!Array.isArray(rp.gaited_gait_registry) || rp.gaited_gait_registry.length === 0) {
      errors.push('gaited breed must have non-empty gaited_gait_registry');
    }
  } else if (gaits.gaiting !== null && gaits.gaiting !== undefined) {
    errors.push('non-gaited breed must have null gaiting score');
  }

  // ── Temperament weights ──────────────────────────────────────────────────
  const EXPECTED_TEMPERAMENT_COUNT = 11;
  const tw = profile.temperament_weights ?? {};
  const twKeys = Object.keys(tw);

  if (twKeys.length !== EXPECTED_TEMPERAMENT_COUNT) {
    errors.push(
      `temperament_weights has ${twKeys.length} keys, expected ${EXPECTED_TEMPERAMENT_COUNT}`,
    );
  }

  let twSum = 0;
  for (const [key, val] of Object.entries(tw)) {
    if (!Number.isInteger(val)) {
      errors.push(`temperament_weights.${key} is not an integer`);
    }
    twSum += val;
  }

  if (twSum !== 100) {
    errors.push(`temperament weights sum to ${twSum}, expected 100`);
  }

  return errors;
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
    .finally(() => prisma.$disconnect?.());
}
