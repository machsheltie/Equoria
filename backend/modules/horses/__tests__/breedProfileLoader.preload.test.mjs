/**
 * breedProfileLoader.preload.test.mjs (Equoria-wpfvl)
 *
 * Real-DB tests for the DB-cache behavior introduced by the DB-as-SoT
 * refactor. The original Equoria-rr7 test file
 * (`breedProfileLoader.test.mjs`) covers the loader as the game uses it;
 * this file covers the cache lifecycle:
 *
 *   - preloadBreedProfiles() populates an in-memory cache from
 *     breeds.breedGeneticProfile.
 *   - getBreedProfile() returns the DB profile directly on a cache hit.
 *     Post-Equoria-f8qew the DB profile is complete (all 8 conformation
 *     regions incl. topline + color genetics), so the prior transitional
 *     DB+JSON per-key merge was removed — the DB row is a strict superset.
 *   - with no cache installed the loader throws loudly, with a `cause`
 *     (Equoria-fbnw8: the breedProfiles.json fallback is gone; the DB is the
 *     only source).
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
import { readFileSync } from 'node:fs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { installBreedProfileRows } from '../data/breedProfileCache.mjs';
import {
  assertBreedProfilesLoaded,
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

  it('loads breed rows whose breedGeneticProfile has ratingProfiles', async () => {
    const count = await preloadBreedProfiles(prisma);
    expect(count).toBeGreaterThanOrEqual(12);
    expect(countLoadedBreedProfiles()).toBe(count);
  });
});

describe('assertBreedProfilesLoaded — a server never boots on zero profiles (Equoria-cfg6q)', () => {
  beforeEach(() => {
    _clearBreedProfileCache();
  });

  it('refuses the count a migrated-but-unseeded database produces', () => {
    // Rows without ratingProfiles are skipped, so a database whose breeds carry
    // no usable profile installs an empty cache and counts 0.
    const count = installBreedProfileRows([
      { name: 'Unseeded A', breedGeneticProfile: null },
      { name: 'Unseeded B', breedGeneticProfile: { shadeBias: {} } },
    ]);
    expect(count).toBe(0);
    expect(() => assertBreedProfilesLoaded(count)).toThrow(/npm run seed:breeds/);
  });

  it('refuses a missing or non-numeric count', () => {
    expect(() => assertBreedProfilesLoaded(undefined)).toThrow(/no breed has a usable/);
    expect(() => assertBreedProfilesLoaded(Number.NaN)).toThrow(/no breed has a usable/);
  });

  it('accepts the count a seeded database produces', async () => {
    const count = await preloadBreedProfiles(prisma);
    expect(() => assertBreedProfilesLoaded(count)).not.toThrow();
  });

  it('server.mjs runs the guard inside the fatal try block, before it binds the listener', () => {
    const source = readFileSync(new URL('../../../server.mjs', import.meta.url), 'utf8');
    const tryStart = source.indexOf('const breedCount = await preloadBreedProfiles(prisma);');
    const guard = source.indexOf('assertBreedProfilesLoaded(breedCount);');
    const exit = source.indexOf('process.exit(1);', guard);
    const listen = source.indexOf('app.listen(');
    expect(tryStart).toBeGreaterThan(-1);
    expect(guard).toBeGreaterThan(tryStart);
    expect(exit).toBeGreaterThan(guard);
    expect(listen).toBeGreaterThan(exit);
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
    expect(profile.shadeBias).toBeDefined();
    expect(typeof profile.shadeBias).toBe('object');

    // Post-Equoria-f8qew the source .txt files (and thus the seeded DB row)
    // carry topline directly — no JSON merge involved. (Requires the lead's
    // reseed of the updated backend/data/breeds/*.txt; see the file header.)
    expect(profile.ratingProfiles.conformation.topline).toBeDefined();
    expect(Number.isFinite(profile.ratingProfiles.conformation.topline.mean)).toBe(true);

    // All eight conformation regions now land from the cache.
    for (const region of ['head', 'neck', 'shoulders', 'back', 'hindquarters', 'legs', 'hooves', 'topline']) {
      expect(profile.ratingProfiles.conformation[region]).toBeDefined();
    }
  });

  it('throws a cause-free "No profile" error when the cache does not have the breed', async () => {
    await preloadBreedProfiles(prisma);
    let thrown;
    try {
      getBreedProfile('Nonexistent-Breed-WPFVL');
    } catch (err) {
      thrown = err;
    }
    expect(thrown.message).toMatch(/No profile for breed "Nonexistent-Breed-WPFVL" in the DB cache/);
    expect(thrown.cause).toBeUndefined();
  });
});

describe('getBreedProfile — no cache installed (Equoria-fbnw8)', () => {
  beforeEach(() => {
    _clearBreedProfileCache();
  });

  it('throws loudly with a cause instead of serving a second copy of the breed data', () => {
    let thrown;
    try {
      getBreedProfile('Thoroughbred');
    } catch (err) {
      thrown = err;
    }
    expect(thrown.message).toMatch(/Breed profiles are not loaded/);
    expect(thrown.cause).toBeInstanceOf(Error);
  });

  it('counts zero breeds', () => {
    expect(countLoadedBreedProfiles()).toBe(0);
  });
});
