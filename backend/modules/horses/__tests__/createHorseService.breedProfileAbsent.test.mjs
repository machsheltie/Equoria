/**
 * createHorseFromRequest answers 422 when a breed has no profile (Equoria-72bub).
 *
 * The service wanted a 422 "No breed profile available" when a breed row exists
 * in the DB but no profile does. It once recognised that case by a message
 * prefix that the loader threw only when the DB cache had NOT been loaded. In
 * production the cache IS preloaded at boot, the loader then threw a differently
 * worded absence error, the prefix check missed, the error was re-thrown, and the
 * player got a generic 500. The service now branches on the error's `cause`
 * (a genuine absence has none).
 *
 * This test runs in the production shape: the DB cache is loaded
 * (preloadBreedProfiles) and the breed has no profile in it. Real Prisma, the
 * real loader and the real service; only a narrowly-owned breed row is created.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createHorseFromRequest } from '../services/createHorseService.mjs';
import { preloadBreedProfiles, _clearBreedProfileCache } from '../data/breedProfileLoader.mjs';

const cleanup = createCleanupTracker();
let breed;

beforeAll(async () => {
  breed = await prisma.breed.create({
    data: {
      name: `TestFixture-NoProfile-${randomBytes(4).toString('hex')}`,
      description: 'breed row with no profile in the DB cache',
    },
  });
  cleanup.add(() => prisma.breed.delete({ where: { id: breed.id } }), 'breed');
  cleanup.add(() => _clearBreedProfileCache(), 'breed profile cache');

  // Production boot order: the DB cache is loaded, and does not hold this breed.
  await preloadBreedProfiles(prisma);
}, 30000);

afterAll(() => cleanup.run(), 30000);

describe('createHorseFromRequest — breed with no profile', () => {
  it('returns the designed 422 instead of throwing (so the player never sees a 500)', async () => {
    const result = await createHorseFromRequest(
      { breedId: String(breed.id), name: 'TestFixture-NoProfile-Horse', sex: 'Mare', age: 4 },
      'unused-user-id',
    );

    expect(result.status).toBe(422);
    expect(result.body.success).toBe(false);
    expect(result.body.message).toContain('No breed profile available');
  });
});
