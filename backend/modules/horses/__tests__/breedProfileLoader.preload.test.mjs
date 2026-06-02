/**
 * breedProfileLoader.preload.test.mjs (Equoria-wpfvl)
 *
 * Real-DB tests for the DB-cache behavior introduced by the DB-as-SoT
 * refactor. The original Equoria-rr7 test file
 * (`breedProfileLoader.test.mjs`) covers the static JSON-only API surface;
 * this file covers what the refactor added:
 *
 *   - preloadBreedProfiles() populates an in-memory cache from
 *     breeds.breedGeneticProfile.
 *   - getBreedProfile() returns the DB profile directly on a cache hit.
 *     Post-Equoria-f8qew the DB profile is complete (all 8 conformation
 *     regions incl. topline + color genetics), so the prior transitional
 *     DB+JSON per-key merge was removed — the DB row is a strict superset.
 *   - cache-empty fallback still works (JSON-only behavior).
 *   - _clearBreedProfileCache test helper drops the cache cleanly.
 *
 * No mocks (CLAUDE.md Testing Philosophy). Each test owns its cache state
 * via beforeEach(_clearBreedProfileCache).
 *
 * REQUIRES a reseed: the cache-hit assertions below expect the DB
 * `breeds.breedGeneticProfile` rows to carry `topline`, which is only true
 * after `node seed/populateBreedsFromSql.mjs` (or `npm run seed:breeds`)
 * has re-imported the Equoria-f8qew-updated backend/data/breeds/*.txt files.
 */

import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import {
  preloadBreedProfiles,
  getBreedProfile,
  countLoadedBreedProfiles,
  _clearBreedProfileCache,
} from '../data/breedProfileLoader.mjs';

afterAll(async () => {
  await prisma.$disconnect();
});

describe('preloadBreedProfiles — populates the DB cache (Equoria-wpfvl)', () => {
  beforeEach(() => {
    _clearBreedProfileCache();
  });

  it('throws when prisma is missing', async () => {
    await expect(preloadBreedProfiles(null)).rejects.toThrow(/requires a Prisma client/);
  });

  it('throws when prisma lacks breed.findMany', async () => {
    await expect(preloadBreedProfiles({})).rejects.toThrow(/requires a Prisma client/);
  });

  it('loads breed rows whose breedGeneticProfile has rating_profiles', async () => {
    const count = await preloadBreedProfiles(prisma);
    expect(count).toBeGreaterThanOrEqual(12);
    expect(countLoadedBreedProfiles()).toBe(count);
  });
});

describe('getBreedProfile — returns the complete DB profile on a cache hit (Equoria-f8qew)', () => {
  beforeEach(() => {
    _clearBreedProfileCache();
  });

  it('returns the DB profile directly when the cache has the breed', async () => {
    await preloadBreedProfiles(prisma);
    const profile = getBreedProfile('Thoroughbred');

    // From DB (post-26qjf): color genetics live only in the DB column.
    expect(profile.shade_bias).toBeDefined();
    expect(typeof profile.shade_bias).toBe('object');

    // Post-Equoria-f8qew the source .txt files (and thus the seeded DB row)
    // carry topline directly — no JSON merge involved. (Requires the lead's
    // reseed of the updated backend/data/breeds/*.txt; see the file header.)
    expect(profile.rating_profiles.conformation.topline).toBeDefined();
    expect(Number.isFinite(profile.rating_profiles.conformation.topline.mean)).toBe(true);

    // All eight conformation regions now land from the cache.
    for (const region of [
      'head',
      'neck',
      'shoulders',
      'back',
      'hindquarters',
      'legs',
      'hooves',
      'topline',
    ]) {
      expect(profile.rating_profiles.conformation[region]).toBeDefined();
    }
  });

  it('throws "absent from both sources" when neither the cache nor the JSON has the breed', async () => {
    await preloadBreedProfiles(prisma);
    expect(() => getBreedProfile('Nonexistent-Breed-WPFVL')).toThrow(
      /absent from both the DB cache.*and breedProfiles\.json/,
    );
  });
});

describe('getBreedProfile — JSON-only fallback when DB cache empty (Equoria-wpfvl)', () => {
  beforeEach(() => {
    _clearBreedProfileCache();
  });

  it('serves Thoroughbred from breedProfiles.json with conformation but no shade_bias', () => {
    const profile = getBreedProfile('Thoroughbred');
    expect(profile.rating_profiles.conformation.topline).toBeDefined();
    // Color genetics live only on the DB; an unpreloaded loader cannot
    // produce shade_bias for any breed.
    expect(profile.shade_bias).toBeUndefined();
  });
});
