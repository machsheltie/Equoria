/**
 * breedProfileLoader — unit tests (Equoria-rr7)
 *
 * Tests the loader as the game uses it: backend/tests/setup.mjs installs the
 * DB cache from breeds.breedGeneticProfile before this file loads, as
 * server.mjs preloads it at boot (Equoria-ctop1). The first block proves that
 * this file really is reading the DB rows, including from a loader imported after Jest's per-test module reset.
 */

import { describe, it, expect } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { getBreedProfile, countLoadedBreedProfiles } from '../data/breedProfileLoader.mjs';

// ---------------------------------------------------------------------------
// The test setup's preload (Equoria-ctop1)
// ---------------------------------------------------------------------------
describe('test setup preloads the DB breed cache (Equoria-ctop1)', () => {
  it('holds every DB breed row that has ratingProfiles', async () => {
    const [{ withProfile }] = await prisma.$queryRaw`
      SELECT count(*)::int AS "withProfile" FROM breeds
       WHERE jsonb_typeof("breedGeneticProfile"->'ratingProfiles') = 'object'`;
    expect(withProfile).toBeGreaterThan(0);
    expect(countLoadedBreedProfiles()).toBe(withProfile);
  });

  it('serves the DB row for Thoroughbred, color genetics included', async () => {
    const row = await prisma.breed.findUnique({
      where: { name: 'Thoroughbred' },
      select: { breedGeneticProfile: true },
    });
    const profile = getBreedProfile('Thoroughbred');
    // The DB profile carries color genetics (shadeBias) beside the ratings.
    expect(typeof profile.shadeBias).toBe('object');
    expect(profile).toEqual(row.breedGeneticProfile);
  });

  it('reaches a loader imported after the per-test module reset', async () => {
    // resetModules: true gives this test a fresh module registry, so this is a
    // second loader instance, the way a route handler that awaits import() of
    // its controller gets one. It must read the same DB cache.
    const fresh = await import('../data/breedProfileLoader.mjs');
    expect(fresh.getBreedProfile).not.toBe(getBreedProfile);
    expect(typeof fresh.getBreedProfile('Thoroughbred').shadeBias).toBe('object');
    expect(fresh.countLoadedBreedProfiles()).toBe(countLoadedBreedProfiles());
  });
});

// ---------------------------------------------------------------------------
// countLoadedBreedProfiles
// ---------------------------------------------------------------------------
describe('countLoadedBreedProfiles', () => {
  it('returns a positive number of breed profiles', () => {
    const count = countLoadedBreedProfiles();
    expect(typeof count).toBe('number');
    expect(count).toBeGreaterThan(0);
  });

  it('returns at least 12 profiles', () => {
    const count = countLoadedBreedProfiles();
    expect(count).toBeGreaterThanOrEqual(12);
  });
});

// ---------------------------------------------------------------------------
// getBreedProfile — by name
// ---------------------------------------------------------------------------
describe('getBreedProfile — by breed name', () => {
  it('returns a profile object for "Thoroughbred"', () => {
    const profile = getBreedProfile('Thoroughbred');
    expect(typeof profile).toBe('object');
    expect(profile).not.toBeNull();
  });

  it('returned profile has ratingProfiles with conformation', () => {
    const profile = getBreedProfile('Thoroughbred');
    expect(profile.ratingProfiles).toBeDefined();
    expect(typeof profile.ratingProfiles.conformation).toBe('object');
  });

  it('returned profile has temperamentWeights', () => {
    const profile = getBreedProfile('Thoroughbred');
    expect(profile.temperamentWeights).toBeDefined();
  });

  it('gaited breed has isGaitedBreed true (American Saddlebred)', () => {
    const profile = getBreedProfile('American Saddlebred');
    expect(profile.ratingProfiles.isGaitedBreed).toBe(true);
  });

  it('non-gaited breed has isGaitedBreed false (Thoroughbred)', () => {
    const profile = getBreedProfile('Thoroughbred');
    expect(profile.ratingProfiles.isGaitedBreed).toBe(false);
  });

  it('throws for an unknown breed name', () => {
    expect(() => getBreedProfile('UnicornBreedXYZ')).toThrow();
  });

  it('throws for empty string', () => {
    expect(() => getBreedProfile('')).toThrow();
  });

  it('throws for null', () => {
    expect(() => getBreedProfile(null)).toThrow();
  });

  it('throws for undefined', () => {
    expect(() => getBreedProfile(undefined)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// getBreedProfile — numeric breedId rejected (Equoria-f6xgn).
// LEGACY_ID_TO_NAME was removed when the 12-only shim became a quiet-failure
// vector for the other ~300 imported breeds. Numeric IDs throw a clear error
// pointing at the migration path (prisma.breed.findUnique → name).
// ---------------------------------------------------------------------------
describe('getBreedProfile — numeric breedId rejection (Equoria-f6xgn)', () => {
  it('throws when given a positive integer breedId', () => {
    expect(() => getBreedProfile(1)).toThrow(/no longer accepts a numeric breedId/);
  });

  it('throws when given an out-of-range positive integer', () => {
    expect(() => getBreedProfile(999)).toThrow(/no longer accepts a numeric breedId/);
  });

  it('throws when given 0', () => {
    expect(() => getBreedProfile(0)).toThrow(/no longer accepts a numeric breedId/);
  });

  it('error message includes the prisma.breed.findUnique migration hint', () => {
    expect(() => getBreedProfile(2)).toThrow(/prisma\.breed\.findUnique/);
  });
});
