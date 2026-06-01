#!/usr/bin/env node
/**
 * Equoria-is28: Sync the 12 canonical breeds' rating_profiles, temperament_weights,
 * and starter_stats from BREED_GENETIC_PROFILES (the authoritative .mjs source of
 * truth) into backend/data/breedProfiles.json (the runtime JSON consumed by
 * conformationService / gaitService / temperamentService via breedProfileLoader).
 *
 * Only the 12 canonical breeds are touched — the remaining ~297 non-canonical
 * breed entries in breedProfiles.json (generated from category templates by
 * generate-breed-profiles.mjs) are preserved untouched.
 *
 * After this script runs:
 *   - JSON values for Thoroughbred, Arabian, American Saddlebred, National Show Horse,
 *     Pony of the Americas, Appaloosa, Tennessee Walking Horse, Andalusian, American
 *     Quarter Horse, Walkaloosa, Lusitano, Paint Horse match the .mjs source exactly.
 *   - The breedProfileSync.test.mjs "KNOWN DIVERGENCE" comment block can be removed.
 *   - Live conformation/gait scores for these 12 breeds use the enriched BreedData
 *     means/std_dev rather than the older generic baseline.
 *
 * Run: node backend/scripts/sync-canonical-breeds-to-json.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { CANONICAL_BREEDS, BREED_GENETIC_PROFILES } from '../modules/horses/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const JSON_PATH = resolve(__dirname, '../data/breedProfiles.json');

function main() {
  const json = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
  let updatedCount = 0;
  const changedBreeds = [];

  for (const breed of CANONICAL_BREEDS) {
    const profile = BREED_GENETIC_PROFILES[breed.id];
    if (!profile) {
      console.error(
        `[sync] WARNING: no .mjs profile for canonical breed ${breed.name} (id=${breed.id})`,
      );
      continue;
    }
    if (!json[breed.name]) {
      console.error(`[sync] WARNING: breed "${breed.name}" not in breedProfiles.json — skipping`);
      continue;
    }

    const before = JSON.stringify(json[breed.name]);

    // Preserve category (JSON-only metadata used by category templates) but
    // overwrite the three substantive sub-blocks from the .mjs source.
    json[breed.name].rating_profiles = profile.rating_profiles;
    json[breed.name].temperament_weights = profile.temperament_weights;
    if (profile.starter_stats) {
      json[breed.name].starter_stats = profile.starter_stats;
    }

    const after = JSON.stringify(json[breed.name]);
    if (before !== after) {
      updatedCount += 1;
      changedBreeds.push(breed.name);
    }
  }

  writeFileSync(JSON_PATH, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
  console.log(`[sync] Updated ${updatedCount} of ${CANONICAL_BREEDS.length} canonical breeds:`);
  for (const name of changedBreeds) {
    console.log(`  - ${name}`);
  }
  console.log(`[sync] Wrote ${JSON_PATH}`);
}

main();
