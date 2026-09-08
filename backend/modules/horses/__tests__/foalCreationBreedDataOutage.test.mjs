/**
 * Integration Test: POST /api/v1/horses/foals — breed-data OUTAGE arm
 * (Equoria-6w3ur, task 20 follow-up to commit c38aa0ab5)
 *
 * THE DEFECT THIS GUARDS
 *   `createFoal`'s breed-profile precondition (horseFoalingController.mjs) calls
 *   the real `getBreedProfile(breedName)` and branches on whether the thrown
 *   error carries a `cause`:
 *     - `cause` present  -> the profile DATA source failed to load (JSON parse/
 *       read failure at module init). This is a SERVER fault, not the player's
 *       mare's fault, so the route must answer 500 with a message that blames
 *       the server, not the breed.
 *     - `cause` absent   -> this specific breed genuinely has no profile. 400,
 *       naming the breed.
 *   Before this discriminator existed, EVERY breed-profile failure collapsed
 *   into one 400 naming the breed — so a total failure to load
 *   `backend/data/breedProfiles.json` told every player, breeding any horse,
 *   that THEIR OWN MARE's breed had no profile: a server outage rendered as a
 *   per-player, per-breed refusal instead of an honest "try again later".
 *
 * WHY THIS IS HARD TO PROVE HONESTLY
 *   `JSON_LOAD_ERROR` (backend/modules/horses/data/breedProfileLoader.mjs) is
 *   captured in a top-level try/catch around `readFileSync(PROFILES_PATH)`
 *   that runs the MOMENT the module is (re)imported. There is no env var, no
 *   injected path, and no Equoria-owned seam to redirect it — reaching the
 *   `cause`-present arm in process requires the real file to genuinely fail
 *   to read at the instant this module is loaded.
 *
 * HOW THIS TEST GETS THERE WITHOUT MOCKING
 *   Two facts about THIS suite's own Jest project make it possible to hit
 *   that instant honestly, on demand, per test, without mocking anything:
 *     1. `backend/modules/horses/routes/horseFoalRoutes.mjs`'s POST /foals
 *        handler does `const { createFoal } = await import(
 *        '../controllers/horseController.mjs')` INSIDE the request handler
 *        body — not once at route-registration time, but freshly resolved on
 *        every call through Node's ES module cache.
 *     2. `backend/jest.config.mjs` sets `resetModules: true` (CONTRIBUTING.md
 *        "Test-Run Resource Budget" mandates it repo-wide), which Jest
 *        documents as resetting the module registry before every test. That
 *        was confirmed empirically while building this file: with debug
 *        instrumentation temporarily added to the loader, its module-init
 *        `readFileSync` fired once per `it()` in this suite (plus once for
 *        the initial static-import graph) — i.e. the lazy import in (1) is
 *        NOT served from a stale cache across tests; it re-resolves and
 *        re-executes breedProfileLoader.mjs's top level fresh at the first
 *        request of every test.
 *   So each test that needs the outage renames the REAL
 *   `backend/data/breedProfiles.json` aside immediately before sending the
 *   one HTTP request that will trigger that fresh re-import, and restores it
 *   in a `finally` immediately after the response comes back — the
 *   corruption window is exactly one request's worth of module
 *   (re-)instantiation, not the whole file's run. This worktree is an
 *   isolated git worktree (confirmed via `git worktree list` before writing
 *   this test), so nothing here reaches the main checkout or any other
 *   agent's tree.
 *
 *   IMPORTANT, and the reason the file-level "rename once, import app.mjs
 *   once" approach that was tried FIRST did not work: importing `app.mjs`
 *   once at file load time and then restoring the file does NOT keep
 *   `JSON_LOAD_ERROR` set for later requests, precisely because of (1) and
 *   (2) above — the very NEXT request re-imports the controller chain fresh
 *   against whatever the file's *current* on-disk state is. That was caught
 *   by observing the loader's message land on the genuine-absence branch
 *   ("No breedProfiles.json entry…", no cause) instead of the outage branch
 *   during development of this file, which is exactly the kind of
 *   vacuous-test trap this task warned about. The corruption window in the
 *   final version below is deliberately scoped inside each `it()`.
 *
 *   No Equoria-owned module is mocked. No bypass flag. No `jest.mock(...)`.
 *   The DB breed-profile cache is never preloaded in this suite (see
 *   `backend/tests/setup.mjs`), so the JSON fallback is genuinely the only
 *   source `getBreedProfile` has for any breed here — the outage is real for
 *   every breed, matching the production scenario in the commit's rationale.
 *
 * WHAT THIS FILE DOES NOT PROVE
 *   The 400 (genuine-absence) arm. That is proven by the adjacent
 *   `foalCreationMinimalPayload.test.mjs` in this same directory, run against
 *   an UNCORRUPTED `breedProfiles.json` (that file never touches the on-disk
 *   fixture), including a sentinel that pins the loader contract this
 *   discriminator depends on (a genuine-absence throw carries no `cause`).
 *
 * Real DB, real app, real HTTP, the real breedProfileLoader.mjs. No mocks.
 */

import { describe, beforeAll, afterAll, expect, it } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { renameSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const app = (await import('../../../app.mjs')).default;
const rand = () => randomBytes(4).toString('hex');

// Mirrors backend/modules/horses/data/breedProfileLoader.mjs's own
// `resolve(__dirname, '../../../data/breedProfiles.json')` from
// backend/modules/horses/data/ -> backend/data/breedProfiles.json. Computed
// independently (not imported from the loader) so this test never has to
// import the loader itself to find the file.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROFILES_PATH = resolve(__dirname, '../../../data/breedProfiles.json');
const BACKUP_PATH = `${PROFILES_PATH}.equoria-task20-outage-backup`;

if (!existsSync(PROFILES_PATH)) {
  throw new Error(
    `[foalCreationBreedDataOutage.test.mjs] Expected the real breed profile file at ${PROFILES_PATH} ` +
      'before this suite runs (each outage test moves it aside for one request and restores it ' +
      'immediately). Refusing to start.',
  );
}
if (existsSync(BACKUP_PATH)) {
  throw new Error(
    `[foalCreationBreedDataOutage.test.mjs] Found a leftover backup at ${BACKUP_PATH} from a previous ` +
      'interrupted run. Restore it to backend/data/breedProfiles.json by hand before re-running.',
  );
}

/**
 * Renames the real breedProfiles.json aside, awaits `fn`, then restores it —
 * even if `fn` throws. `fn` must be the thing that triggers the fresh
 * lazy re-import of breedProfileLoader.mjs (see the file banner): one HTTP
 * request through `postFoals` below.
 */
async function withBreedProfilesUnreadable(fn) {
  renameSync(PROFILES_PATH, BACKUP_PATH);
  try {
    return await fn();
  } finally {
    renameSync(BACKUP_PATH, PROFILES_PATH);
  }
}

describe("POST /horses/foals — breed-data outage reports 500, not the breed's fault (Equoria-6w3ur)", () => {
  const cleanup = createCleanupTracker();
  const ts = `${rand()}_${rand()}`;

  let player, playerToken, playerCsrf;
  let breed, stallion, mare;

  beforeAll(async () => {
    const hashedPassword = await bcrypt.hash('TestPw123!', 1);

    player = await prisma.user.create({
      data: {
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

    // An ordinary breed row. Its name does not matter: with the JSON source
    // unreadable and the DB cache never preloaded in this suite, EVERY breed
    // name fails `getBreedProfile` with a cause-bearing error — a total
    // outage, not a per-breed gap.
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
      data: adult(`TestFixture-task20-Sire_${ts}`, 'Stallion'),
    });
    mare = await prisma.horse.create({
      data: adult(`TestFixture-task20-Dam_${ts}`, 'Mare'),
    });

    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: player.id } }), 'fixtureHorses');
    cleanup.add(() => prisma.breed.deleteMany({ where: { id: breed.id } }), 'outageBreed');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: player.id } }), 'user');
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
    const res = await withBreedProfilesUnreadable(() => postFoals({ sireId: stallion.id, damId: mare.id }));

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
    expect(dbDam.pendingFoalBreedId).toBeNull();
  });

  it('also 500s when the caller explicitly supplies the affected breedId', async () => {
    const res = await withBreedProfilesUnreadable(() =>
      postFoals({ sireId: stallion.id, damId: mare.id, breedId: breed.id }),
    );

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Breed data is unavailable right now, so breeding cannot start. Try again later.');

    const dbDam = await prisma.horse.findUnique({ where: { id: mare.id } });
    expect(dbDam.inFoalSinceDate).toBeNull();
  });
});
