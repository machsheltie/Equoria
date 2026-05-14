/**
 * Integration tests for populateBreedGeneticProfiles.mjs
 *
 * Tests that ensureCanonicalBreeds() and populateBreedGeneticProfiles() correctly
 * persist breed data to the real database. Uses the real test DB — no mocks.
 *
 * IMPORTANT: These tests do NOT delete the 12 canonical breeds.
 * They are real game data required for the game to function.
 * Cleanup is scoped: only test-created data (none here) would be removed.
 *
 * DB-STATE RESILIENCE: Lookups use breed NAME (unique constraint), not hardcoded
 * row IDs. This ensures tests pass on a shared production DB where auto-increment
 * IDs may differ from the canonical seed IDs (e.g. after test-fixture contamination).
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import prisma from '../../../db/index.mjs';
import { ensureCanonicalBreeds, populateBreedGeneticProfiles } from '../../../seed/populateBreedGeneticProfiles.mjs';
import { CANONICAL_BREEDS, BREED_GENETIC_PROFILES } from '../data/breedGeneticProfiles.mjs';

// Arabian is canonical ID 2 in the source data; look it up by name for DB-agnosticism
const ARABIAN_CANONICAL_ID = 2;
const ARABIAN_NAME = 'Arabian';

// ---------------------------------------------------------------------------
// ensureCanonicalBreeds
// ---------------------------------------------------------------------------
describe('ensureCanonicalBreeds() — DB integration', () => {
  beforeAll(async () => {
    // Run the function to guarantee canonical breeds exist before asserting
    await ensureCanonicalBreeds();
  }, 30000);

  it('all 12 canonical breed names exist in the database after running', async () => {
    const canonicalNames = CANONICAL_BREEDS.map(b => b.name);
    const breeds = await prisma.breed.findMany({
      where: { name: { in: canonicalNames } },
      select: { name: true },
    });
    const foundNames = breeds.map(b => b.name).sort();
    expect(foundNames).toEqual([...canonicalNames].sort());
  });

  it('each canonical breed name is present in the database', async () => {
    for (const canonical of CANONICAL_BREEDS) {
      const breed = await prisma.breed.findUnique({
        where: { name: canonical.name },
        select: { id: true, name: true },
      });
      expect(breed).not.toBeNull();
      expect(breed.name).toBe(canonical.name);
    }
  });

  it('returns a result object with no errors', async () => {
    const result = await ensureCanonicalBreeds();
    expect(result.errors).toHaveLength(0);
    // existing + created should equal 12
    expect(result.existing + result.created).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// populateBreedGeneticProfiles — Arabian spot-check (looked up by name)
// ---------------------------------------------------------------------------
describe('populateBreedGeneticProfiles() — Arabian spot-check', () => {
  /** The actual DB row for Arabian (looked up by name after population). */
  let arabianBreed;

  beforeAll(async () => {
    await populateBreedGeneticProfiles();
    arabianBreed = await prisma.breed.findUnique({
      where: { name: ARABIAN_NAME },
      select: { id: true, breedGeneticProfile: true },
    });
  }, 60000);

  it('sets breedGeneticProfile on Arabian (by name)', async () => {
    expect(arabianBreed).not.toBeNull();
    expect(arabianBreed.breedGeneticProfile).not.toBeNull();
  });

  it('Arabian rating_profiles.conformation has exactly 8 keys', () => {
    const conformation = arabianBreed.breedGeneticProfile.rating_profiles.conformation;
    expect(Object.keys(conformation)).toHaveLength(8);
  });

  it('Arabian rating_profiles.gaits has exactly 5 keys', () => {
    const gaits = arabianBreed.breedGeneticProfile.rating_profiles.gaits;
    expect(Object.keys(gaits)).toHaveLength(5);
  });

  it('Arabian temperament_weights is an object with values summing to 99–101', () => {
    const tw = arabianBreed.breedGeneticProfile.temperament_weights;
    expect(typeof tw).toBe('object');
    expect(tw).not.toBeNull();
    const sum = Object.values(tw).reduce((a, b) => a + b, 0);
    expect(sum).toBeGreaterThanOrEqual(99);
    expect(sum).toBeLessThanOrEqual(101);
  });

  it('Arabian starter_stats has exactly 12 entries', () => {
    const starterStats = arabianBreed.breedGeneticProfile.starter_stats;
    expect(Object.keys(starterStats)).toHaveLength(12);
  });

  it('Arabian conformation values in DB match BREED_GENETIC_PROFILES source', () => {
    const dbConformation = arabianBreed.breedGeneticProfile.rating_profiles.conformation;
    const sourceConformation = BREED_GENETIC_PROFILES[ARABIAN_CANONICAL_ID].rating_profiles.conformation;
    for (const region of Object.keys(sourceConformation)) {
      expect(dbConformation[region].mean).toBe(sourceConformation[region].mean);
      expect(dbConformation[region].std_dev).toBe(sourceConformation[region].std_dev);
    }
  });
});

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------
describe('populateBreedGeneticProfiles() — idempotency', () => {
  it('running twice produces no errors and leaves data unchanged', async () => {
    const firstRun = await populateBreedGeneticProfiles();
    expect(firstRun.success).toBe(true);
    expect(firstRun.breeds.errors).toHaveLength(0);
    expect(firstRun.profiles.errors).toHaveLength(0);

    const secondRun = await populateBreedGeneticProfiles();
    expect(secondRun.success).toBe(true);
    expect(secondRun.breeds.errors).toHaveLength(0);
    expect(secondRun.profiles.errors).toHaveLength(0);
  }, 60000);

  it('Arabian data is stable after second run', async () => {
    await populateBreedGeneticProfiles();

    const breed = await prisma.breed.findUnique({
      where: { name: ARABIAN_NAME },
      select: { breedGeneticProfile: true },
    });
    expect(breed).not.toBeNull();
    const conformation = breed.breedGeneticProfile.rating_profiles.conformation;
    // Spot-check a known value from BREED_GENETIC_PROFILES
    expect(conformation.head.mean).toBe(
      BREED_GENETIC_PROFILES[ARABIAN_CANONICAL_ID].rating_profiles.conformation.head.mean,
    );
  }, 60000);

  it('all 12 canonical breed names still exist after double run — not deleted', async () => {
    const canonicalNames = CANONICAL_BREEDS.map(b => b.name);
    const breeds = await prisma.breed.findMany({
      where: { name: { in: canonicalNames } },
      select: { name: true },
    });
    expect(breeds).toHaveLength(12);
  }, 30000);
});
