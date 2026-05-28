/**
 * breedProfileLoader.preload.test.mjs (Equoria-wpfvl)
 *
 * Real-DB tests for the DB-cache + transitional-merge behavior introduced by
 * the DB-as-SoT refactor. The original Equoria-rr7 test file
 * (`breedProfileLoader.test.mjs`) covers the static JSON-only API surface;
 * this file covers what the refactor added:
 *
 *   - preloadBreedProfiles() populates an in-memory cache from
 *     breeds.breedGeneticProfile.
 *   - getBreedProfile() merges DB + JSON during the transition window
 *     (DB wins per-key, JSON fills gaps such as conformation.topline).
 *   - cache-empty fallback still works (JSON-only behavior).
 *   - _clearBreedProfileCache test helper drops the cache cleanly.
 *
 * No mocks (CLAUDE.md Testing Philosophy). Each test owns its cache state
 * via beforeEach(_clearBreedProfileCache).
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

describe('getBreedProfile — DB + JSON merge during transition (Equoria-wpfvl)', () => {
  beforeEach(() => {
    _clearBreedProfileCache();
  });

  it('returns a merged profile when both sources have the breed', async () => {
    await preloadBreedProfiles(prisma);
    const profile = getBreedProfile('Thoroughbred');

    // From DB (post-26qjf): color genetics are only in the DB column.
    expect(profile.shade_bias).toBeDefined();
    expect(typeof profile.shade_bias).toBe('object');

    // From JSON (transitional): topline conformation is only in the JSON.
    // Once the source SQL files gain topline, this region will come from
    // the DB and the merge will be a no-op for this key — the assertion
    // still holds either way.
    expect(profile.rating_profiles.conformation.topline).toBeDefined();
    expect(Number.isFinite(profile.rating_profiles.conformation.topline.mean)).toBe(true);

    // From DB (rich set): the seven other conformation regions land from
    // the cache.
    for (const region of ['head', 'neck', 'shoulders', 'back', 'hindquarters', 'legs', 'hooves']) {
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
