// Population script for breed genetic profiles.
// Ensures the canonical 12 breeds exist and populates breedGeneticProfile JSONB.
// Idempotent: safe to run multiple times.

import prisma from '../db/index.mjs';
import {
  CANONICAL_BREEDS,
  BREED_GENETIC_PROFILES,
} from '../modules/horses/data/breedGeneticProfiles.mjs';

/**
 * Ensures all 12 canonical breeds exist in the database by NAME.
 * The canonical breed name (unique constraint) is the source of truth.
 * IDs are preferred but not required — on a shared DB the target ID may be
 * occupied by a test fixture; in that case we create the breed with an
 * auto-increment ID so the name-keyed lookup still works.
 *
 * Priority order:
 *   1. Canonical name exists at canonical ID → already correct, skip.
 *   2. Canonical name exists at any other ID → treat as existing (name is unique).
 *   3. Canonical ID occupied by a different name → try canonical name-only create.
 *   4. Neither name nor ID exists → create with canonical ID (preferred).
 *   5. Create with canonical ID fails (ID taken) → create without ID (auto-increment).
 */
export async function ensureCanonicalBreeds() {
  const results = { created: 0, existing: 0, errors: [] };

  for (const breed of CANONICAL_BREEDS) {
    try {
      // --- Priority 1 & 2: check by canonical name first (unique, always correct) ---
      const existingByName = await prisma.breed.findUnique({ where: { name: breed.name } });
      if (existingByName) {
        results.existing++;
        if (existingByName.id === breed.id) {
          console.log(`  [SKIP] Breed "${breed.name}" exists at canonical ID ${breed.id}`);
        } else {
          console.log(
            `  [SKIP-DRIFT] Breed "${breed.name}" exists at ID ${existingByName.id} (canonical ${breed.id}) — treating as existing`,
          );
        }
        continue;
      }

      // --- Canonical name does NOT exist — check if canonical ID is free ---
      const existingById = await prisma.breed.findUnique({ where: { id: breed.id } });

      if (!existingById) {
        // --- Priority 4: both name and ID are free — create with canonical ID ---
        await prisma.breed.create({
          data: { id: breed.id, name: breed.name, description: breed.description },
        });
        results.created++;
        console.log(`  [CREATE] Breed ID ${breed.id} "${breed.name}"`);
      } else {
        // --- Priority 3 & 5: canonical ID occupied by different name — auto-increment ---
        console.log(
          `  [WARN] Canonical ID ${breed.id} is occupied by "${existingById.name}" — creating "${breed.name}" with auto-increment ID`,
        );
        await prisma.breed.create({
          data: { name: breed.name, description: breed.description },
        });
        results.created++;
        console.log(
          `  [CREATE-AUTOINCREMENT] Breed "${breed.name}" (canonical ID ${breed.id} was occupied)`,
        );
      }
    } catch (error) {
      results.errors.push({ breedId: breed.id, error: error.message });
      console.log(`  [ERROR] Breed "${breed.name}" (canonical ID ${breed.id}): ${error.message}`);
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
