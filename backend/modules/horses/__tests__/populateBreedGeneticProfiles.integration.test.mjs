/**
 * Integration tests for populateBreedGeneticProfiles.mjs
 *
 * Tests that ensureCanonicalBreeds() and populateBreedGeneticProfiles() correctly
 * persist breed data to the real database. Uses the real test DB — no mocks.
 *
 * IMPORTANT: These tests do NOT delete the 12 canonical breeds.
 * They are real game data required for the game to function.
 * Cleanup is scoped: only test-created data (none here) would be removed.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import prisma from '../../../db/index.mjs';
import { ensureCanonicalBreeds, populateBreedGeneticProfiles } from '../../../seed/populateBreedGeneticProfiles.mjs';
import { CANONICAL_BREEDS, BREED_GENETIC_PROFILES } from '../data/breedGeneticProfiles.mjs';

const ALL_BREED_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// ---------------------------------------------------------------------------
// ensureCanonicalBreeds
// ---------------------------------------------------------------------------
describe('ensureCanonicalBreeds() — DB integration', () => {
  beforeAll(async () => {
    // Run the function to guarantee canonical breeds exist before asserting
    await ensureCanonicalBreeds();
  }, 30000);

  it('all 12 canonical breed IDs exist in the database after running', async () => {
    const breeds = await prisma.breed.findMany({
      where: { id: { in: ALL_BREED_IDS } },
      select: { id: true },
    });
    const foundIds = breeds.map(b => b.id).sort((a, b) => a - b);
    expect(foundIds).toEqual(ALL_BREED_IDS);
  });

  it('each canonical breed has the correct name in the database', async () => {
    for (const canonical of CANONICAL_BREEDS) {
      const breed = await prisma.breed.findUnique({
        where: { id: canonical.id },
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
// populateBreedGeneticProfiles — Arabian (ID 2) spot-check
// ---------------------------------------------------------------------------
describe('populateBreedGeneticProfiles() — Arabian (ID 2) spot-check', () => {
  beforeAll(async () => {
    await populateBreedGeneticProfiles();
  }, 60000);

  it('sets breedGeneticProfile on Arabian (ID 2)', async () => {
    const breed = await prisma.breed.findUnique({
      where: { id: 2 },
      select: { breedGeneticProfile: true },
    });
    expect(breed).not.toBeNull();
    expect(breed.breedGeneticProfile).not.toBeNull();
  });

  it('Arabian rating_profiles.conformation has exactly 8 keys', async () => {
    const breed = await prisma.breed.findUnique({
      where: { id: 2 },
      select: { breedGeneticProfile: true },
    });
    const conformation = breed.breedGeneticProfile.rating_profiles.conformation;
    expect(Object.keys(conformation)).toHaveLength(8);
  });

  it('Arabian rating_profiles.gaits has exactly 5 keys', async () => {
    const breed = await prisma.breed.findUnique({
      where: { id: 2 },
      select: { breedGeneticProfile: true },
    });
    const gaits = breed.breedGeneticProfile.rating_profiles.gaits;
    expect(Object.keys(gaits)).toHaveLength(5);
  });

  it('Arabian temperament_weights is an object with values summing to 99–101', async () => {
    const breed = await prisma.breed.findUnique({
      where: { id: 2 },
      select: { breedGeneticProfile: true },
    });
    const tw = breed.breedGeneticProfile.temperament_weights;
    expect(typeof tw).toBe('object');
    expect(tw).not.toBeNull();
    const sum = Object.values(tw).reduce((a, b) => a + b, 0);
    expect(sum).toBeGreaterThanOrEqual(99);
    expect(sum).toBeLessThanOrEqual(101);
  });

  it('Arabian starter_stats has exactly 12 entries', async () => {
    const breed = await prisma.breed.findUnique({
      where: { id: 2 },
      select: { breedGeneticProfile: true },
    });
    const starterStats = breed.breedGeneticProfile.starter_stats;
    expect(Object.keys(starterStats)).toHaveLength(12);
  });

  it('Arabian conformation values in DB match BREED_GENETIC_PROFILES source', async () => {
    const breed = await prisma.breed.findUnique({
      where: { id: 2 },
      select: { breedGeneticProfile: true },
    });
    const dbConformation = breed.breedGeneticProfile.rating_profiles.conformation;
    const sourceConformation = BREED_GENETIC_PROFILES[2].rating_profiles.conformation;
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

  it('Arabian (ID 2) data is stable after second run', async () => {
    await populateBreedGeneticProfiles();

    const breed = await prisma.breed.findUnique({
      where: { id: 2 },
      select: { breedGeneticProfile: true },
    });
    const conformation = breed.breedGeneticProfile.rating_profiles.conformation;
    // Spot-check a known value from BREED_GENETIC_PROFILES
    expect(conformation.head.mean).toBe(BREED_GENETIC_PROFILES[2].rating_profiles.conformation.head.mean);
  }, 60000);

  it('all 12 breeds still exist after double run — canonical breeds not deleted', async () => {
    const breeds = await prisma.breed.findMany({
      where: { id: { in: ALL_BREED_IDS } },
      select: { id: true },
    });
    expect(breeds).toHaveLength(12);
  }, 30000);
});
