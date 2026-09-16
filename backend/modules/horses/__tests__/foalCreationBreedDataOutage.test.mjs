/**
 * Integration Test: POST /api/v1/horses/foals — breed-data OUTAGE arm
 * (Equoria-6w3ur, task 20 follow-up to commit c38aa0ab5; reworked under
 * Equoria-rlvgn)
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
 *   captured in a top-level try/catch around `readFileSync(PROFILES_PATH)` that
 *   runs the MOMENT the module is (re)imported. Mocking an Equoria-owned module
 *   is forbidden, so reaching the `cause`-present arm in process requires a real
 *   file to genuinely fail to read at the instant that module is loaded.
 *
 * THE FILE THAT FAILS TO READ IS THIS SUITE'S OWN COPY — NEVER THE TRACKED ONE
 *   OWNER RULING 2026-09-14 10:23 (Equoria-rlvgn): "Tests may not rename tracked
 *   data files at all; the affected suite works on a copy."
 *
 *   Earlier versions of this file renamed the TRACKED
 *   `backend/data/breedProfiles.json` aside for the duration of one request and
 *   restored it in a `finally`. That window was short, but a hard kill inside it
 *   (SIGINT, an OOM, a taskkill) left the tracked file missing from the shared
 *   working tree, and every breed-dependent path then 500'd with no explanation
 *   until this same suite ran again and self-healed. This campaign already hit
 *   one OOM death, so it was not hypothetical.
 *
 *   It no longer happens, because the tracked file is now only ever READ, once,
 *   to make a copy:
 *     1. At module load this suite copies `backend/data/breedProfiles.json` into
 *        a fresh `mkdtempSync` directory under the OS temp dir — outside the
 *        repository entirely, so nothing it does can show up in `git status`.
 *     2. It sets `BREED_PROFILES_PATH` to that copy. That is the loader's
 *        ordinary path configuration — read the same way in every environment,
 *        defaulting to the repository file when unset (see
 *        breedProfileLoader.mjs) — not a test-only seam. So for every fresh
 *        re-import in this suite the real `readFileSync` reads the copy instead
 *        of the tracked file.
 *     3. An outage window DELETES the copy for exactly one request and restores
 *        it — by copying the tracked file again — in a `finally`. Nothing is
 *        renamed and no tracked path is written to, so a kill inside the window
 *        leaves only an absent file in a temp directory the OS reclaims.
 *
 *   What is still real: the read, the parse failure, the captured
 *   `JSON_LOAD_ERROR`, the cause-bearing throw, the controller's discriminator,
 *   the route, the app, the HTTP request and the database. The seam changes
 *   WHERE the file is read from, and nothing else. No Equoria-owned module is
 *   mocked, no `jest.mock(...)`, no bypass flag.
 *
 * WHY A PER-TEST WINDOW STILL WORKS
 *   Two facts about THIS suite's own Jest project make the outage reproducible
 *   on demand, per test:
 *     1. `backend/modules/horses/routes/horseFoalRoutes.mjs`'s POST /foals
 *        handler does `const { createFoal } = await import(
 *        '../controllers/horseController.mjs')` INSIDE the request handler body
 *        — freshly resolved on every call through Node's ES module cache.
 *     2. `backend/jest.config.mjs` sets `resetModules: true` (CONTRIBUTING.md
 *        "Test-Run Resource Budget" mandates it repo-wide), so the module
 *        registry is reset before every test and breedProfileLoader.mjs's top
 *        level re-executes at the first request of each test.
 *   This is why the "delete once at file load, import app.mjs once" shape does
 *   NOT work: the very next request re-imports the controller chain fresh
 *   against whatever the configured path holds at that moment. The window is
 *   deliberately scoped inside each `it()`.
 *
 * WHAT THIS FILE DOES NOT PROVE
 *   The 400 (genuine-absence) arm. That is proven by the adjacent
 *   `foalCreationMinimalPayload.test.mjs` in this same directory, run against an
 *   uncorrupted profile source, including a sentinel that pins the loader
 *   contract this discriminator depends on (a genuine-absence throw carries no
 *   `cause`).
 *
 * Real DB, real app, real HTTP, the real breedProfileLoader.mjs. No mocks.
 */

import { describe, beforeAll, afterAll, expect, it } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

// Mirrors breedProfileLoader.mjs's own default resolution from
// backend/modules/horses/data/ -> backend/data/breedProfiles.json. Computed
// independently (not imported from the loader) so this test never has to import
// the loader itself to find the file. THIS PATH IS READ ONLY — never renamed,
// never written, never deleted.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TRACKED_PROFILES_PATH = resolve(__dirname, '../../../data/breedProfiles.json');

if (!existsSync(TRACKED_PROFILES_PATH)) {
  throw new Error(
    '[foalCreationBreedDataOutage.test.mjs] Expected the tracked breed profile file at ' +
      `${TRACKED_PROFILES_PATH}. This suite only ever reads it, so its absence is not this ` +
      "suite's doing. An OLD revision of this file renamed it aside and may have left a " +
      '".equoria-task20-outage-backup" sibling: restore with ' +
      '"git checkout -- backend/data/breedProfiles.json" and delete the stray backup. ' +
      'Refusing to start.',
  );
}

// The disposable copy the loader is pointed at, in a fresh OS temp directory —
// outside the repository, so no state this suite creates can reach the working
// tree or another agent's checkout.
const COPY_DIR = mkdtempSync(join(tmpdir(), 'equoria-breed-profiles-'));
const COPY_PATH = join(COPY_DIR, 'breedProfiles.json');
copyFileSync(TRACKED_PROFILES_PATH, COPY_PATH);
process.env.BREED_PROFILES_PATH = COPY_PATH;

const app = (await import('../../../app.mjs')).default;
const rand = () => randomBytes(4).toString('hex');

/**
 * Deletes THIS SUITE'S COPY of the profile source, awaits `fn`, then restores the
 * copy from the tracked file — even if `fn` throws. `fn` must be the thing that
 * triggers the fresh lazy re-import of breedProfileLoader.mjs (see the banner):
 * one HTTP request through `postFoals` below.
 *
 * The restore is unconditional and UNGUARDED: if it cannot happen the run must
 * fail loudly here, while there is still a stack to read. No startup self-heal
 * sits behind it any more — a process killed inside this window loses only a
 * file in an OS temp directory, and the tracked tree is untouched either way.
 */
async function withBreedProfilesUnreadable(fn) {
  rmSync(COPY_PATH);
  try {
    return await fn();
  } finally {
    copyFileSync(TRACKED_PROFILES_PATH, COPY_PATH);
  }
}

// The copy and the env pointer belong to this file alone; drop both when it
// finishes so no later suite in the same worker inherits a redirected path.
afterAll(() => {
  delete process.env.BREED_PROFILES_PATH;
  rmSync(COPY_DIR, { recursive: true, force: true });
});

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
