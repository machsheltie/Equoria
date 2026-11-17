/**
 * Integration Test: POST /api/v1/horses/foals — breed-data OUTAGE arm
 * (Equoria-6w3ur, task 20 follow-up to commit c38aa0ab5; reworked under
 * Equoria-rlvgn and again under Equoria-fbnw8)
 *
 * THE DEFECT THIS GUARDS
 *   `createFoal`'s breed-profile precondition (horseFoalingController.mjs) calls
 *   the real `getBreedProfile(breedName)` and branches on whether the thrown
 *   error carries a `cause`:
 *     - `cause` present  -> the breed data itself is unavailable (no profile
 *       cache is installed). This is a SERVER fault, not the player's mare's
 *       fault, so the route must answer 500 with a message that blames the
 *       server, not the breed.
 *     - `cause` absent   -> this specific breed genuinely has no profile. 400,
 *       naming the breed.
 *   Before this discriminator existed, EVERY breed-profile failure collapsed
 *   into one 400 naming the breed, so a total breed-data outage told every
 *   player, breeding any horse, that THEIR OWN MARE's breed had no profile: a
 *   server outage rendered as a per-player, per-breed refusal instead of an
 *   honest "try again later".
 *
 * HOW THE OUTAGE IS REPRODUCED (Equoria-fbnw8)
 *   Old contract: the outage was a breedProfiles.json that failed to read, made
 *   to happen by pointing the loader's BREED_PROFILES_PATH at a disposable copy
 *   and deleting it for one request. That file, the path variable and the
 *   loader's JSON read no longer exist: the DB breed cache is the only source.
 *   New contract: the same outage arm (500, server-blaming message, no
 *   pregnancy claimed) is reached by taking the real DB breed cache away for
 *   exactly one request, the state a process is in when preloadBreedProfiles
 *   never ran, and putting the very same rows back afterwards. Nothing is
 *   mocked and no file is touched: the real cache module is cleared and
 *   re-installed, and the loader, controller discriminator, route, app, HTTP
 *   request and database are all real.
 *
 *   The cache lives on globalThis (breedProfileCache.mjs), so it is the one the
 *   controller's per-request import() of the loader sees, whatever Jest's
 *   per-test module reset does to the module registry.
 *
 * WHAT THIS FILE DOES NOT PROVE
 *   The 400 (genuine-absence) arm. That is proven by the adjacent
 *   `foalCreationMinimalPayload.test.mjs` in this same directory, run against the
 *   intact cache, including a sentinel that pins the loader contract this
 *   discriminator depends on (a genuine-absence throw carries no `cause`).
 *
 * Real DB, real app, real HTTP, the real breedProfileLoader.mjs. No mocks.
 */

import { describe, beforeAll, afterAll, expect, it } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { clearBreedProfileCache, getBreedProfileCache, installBreedProfileRows } from '../data/breedProfileCache.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';

const app = (await import('../../../app.mjs')).default;
const rand = () => randomBytes(4).toString('hex');

/**
 * Takes the DB breed cache away, awaits `fn`, then installs the same breed rows
 * again, even if `fn` throws. `fn` is one HTTP request through `postFoals`
 * below, so the controller's request-time getBreedProfile sees no cache.
 *
 * The restore is unconditional and unguarded: if it cannot happen the run must
 * fail loudly here. The cache belongs to this test file's own global, so a
 * crash inside the window cannot reach another file.
 */
async function withBreedProfilesUnavailable(fn) {
  const saved = getBreedProfileCache();
  if (!saved || saved.size === 0) {
    throw new Error('The test setup did not install the DB breed cache; this suite needs it to take away.');
  }
  const rows = [...saved].map(([name, breedGeneticProfile]) => ({ name, breedGeneticProfile }));
  clearBreedProfileCache();
  try {
    return await fn();
  } finally {
    installBreedProfileRows(rows);
  }
}

describe("POST /horses/foals — breed-data outage reports 500, not the breed's fault (Equoria-6w3ur)", () => {
  const cleanup = createCleanupTracker();
  const ts = `${rand()}_${rand()}`;

  let player, playerToken, playerCsrf;
  let breed, stallion, mare;

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash('TestPw123!', 1);

    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: player.id } }), 'fixtureHorses');
    cleanup.add(() => prisma.breed.deleteMany({ where: { id: breed.id } }), 'outageBreed');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: player.id } }), 'user');

    player = await prisma.user.create({
      data: {
        emailVerified: true,
        username: `task20_outage_${ts}`,
        email: `task20_outage_${ts}@example.com`,
        password: hashedPassword,
        firstName: 'Task20',
        lastName: 'Outage',
        money: 50000,
      },
    });

    playerToken = generateTestToken({ id: player.id, role: 'user' });
    playerCsrf = await fetchCsrf(app, { extraCookies: [`accessToken=${playerToken}`] });

    // An ordinary breed row. Its name does not matter: with the DB cache taken
    // away, EVERY breed name fails `getBreedProfile` with a cause-bearing
    // error — a total outage, not a per-breed gap.
    breed = await prisma.breed.create({
      data: {
        name: `TestFixture-task20-OutageBreed_${ts}`,
        description: 'Task 20 breed-data-outage regression fixture',
      },
    });

    const dobForAgeYears = ageYears => {
      const d = new Date();
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCDate(d.getUTCDate() - ageYears * 7);
      return d;
    };
    const adult = (name, sex) => ({
      ...fixtureColor(),
      name,
      sex,
      dateOfBirth: dobForAgeYears(5),
      age: 5,
      breedId: breed.id,
      userId: player.id,
      lastFedDate: new Date(),
      lastBredDate: null,
    });

    stallion = await prisma.horse.create({
      data: await testHorseData(prisma, adult(`TestFixture-task20-Sire_${ts}`, 'Stallion')),
    });
    mare = await prisma.horse.create({
      data: await testHorseData(prisma, adult(`TestFixture-task20-Dam_${ts}`, 'Mare')),
    });
  }, 120000);

  afterAll(() => cleanup.run(), 120000);

  function postFoals(body) {
    return request(app)
      .post('/api/v1/horses/foals')
      .set('Authorization', `Bearer ${playerToken}`)
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', playerCsrf.cookieHeader)
      .set('X-CSRF-Token', playerCsrf.csrfToken)
      .send(body);
  }

  it('returns 500 with the server-data message — not a 400 naming the breed — and claims no pregnancy', async () => {
    // No breedId supplied: the effective breed is DERIVED from the dam
    // (`supplied ?? dam.breedId`), which is exactly the "their own mare's
    // breed" scenario the commit's rationale describes.
    const res = await withBreedProfilesUnavailable(() => postFoals({ sireId: stallion.id, damId: mare.id }));

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Breed data is unavailable right now, so breeding cannot start. Try again later.');
    // The 400 (genuine-absence) message names the breed directly — assert the
    // outage message does NOT do that, since blaming the breed is exactly the
    // defect being fixed.
    expect(res.body.message).not.toContain(breed.name);

    // Fail-closed: an outage must not claim a pregnancy or spend the mare's
    // cooldown — the same invariant the 400 arms already prove in the
    // adjacent foalCreationMinimalPayload.test.mjs.
    const dbDam = await prisma.horse.findUnique({ where: { id: mare.id } });
    expect(dbDam.inFoalSinceDate).toBeNull();
    expect(dbDam.pregnancySireId).toBeNull();
    expect(dbDam.lastBredDate).toBeNull();
  });

  it('also 500s when the caller explicitly supplies the affected breedId', async () => {
    const res = await withBreedProfilesUnavailable(() =>
      postFoals({ sireId: stallion.id, damId: mare.id, breedId: breed.id }),
    );

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Breed data is unavailable right now, so breeding cannot start. Try again later.');

    const dbDam = await prisma.horse.findUnique({ where: { id: mare.id } });
    expect(dbDam.inFoalSinceDate).toBeNull();
  });
});
