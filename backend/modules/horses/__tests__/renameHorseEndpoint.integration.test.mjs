/**
 * PATCH /api/v1/horses/:id/name — owner-scoped rename endpoint (Equoria-qkgfh.1)
 *
 * WHY THIS SUITE EXISTS
 *   Breeding derives a foal's name server-side as `<Dam> Foal`
 *   (foalingService.mjs `options.name || dam.pendingFoalName || `${dam.name} Foal``)
 *   because the client had no honest way to supply one. The owner ruled
 *   (2026-09-08) that a horse may be renamed at any time for any reason, and
 *   (2026-09-09) that names need NOT be unique — "if 20 players want to name
 *   their horse Fred, they can do so".
 *
 *   This suite pins the four properties that ruling implies, against the real
 *   database and the real Express app (no mocks anywhere):
 *
 *     1. An owner can rename their horse and the new name PERSISTS.
 *     2. Authorization collapses (CWE-639): a horse that does not exist and a
 *        horse owned by someone else must produce BYTE-IDENTICAL responses, so
 *        the endpoint cannot be used to enumerate other players' horse ids.
 *     3. Duplicate names are legal — within one stable and across stables.
 *     4. Validation is fail-closed: rejected names are rejected with a clear
 *        error and the stored name is left untouched (no truncation, no
 *        silent normalisation).
 *
 *   Plus the point of the whole task: a derived `<Dam> Foal` name produced by
 *   the REAL foaling service can actually be replaced.
 *
 * SCOPE
 *   Backend only. Where the rename control lives in the interface is the
 *   owner's decision and is deliberately absent from this change.
 *
 *   Five live paths let a player put a string into `horses.name`; four are gated
 *   by the shared rule and this suite covers them. The fifth,
 *   POST /api/v1/auth/advance-onboarding, is deliberately NOT gated and is NOT
 *   covered here — see the enumeration in routes/_validators.mjs.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createFoalFromPregnancy } from '../services/foalingService.mjs';
import { renameHorseById } from '../services/renameHorseService.mjs';
import { horseNameRejectionReason, unnamedNameIsAcceptable, UNNAMED_HORSE_NAME } from '../services/horseNamePolicy.mjs';

const ORIGIN = 'http://localhost:3000';
const FIXTURE_PREFIX = 'TestFixture-qkgfh1';
const DAY_MS = 24 * 60 * 60 * 1000;

const cleanup = createCleanupTracker();

/** Users created by this suite (owner + a second player). */
let owner;
let ownerToken;
let ownerCsrf;
let intruder;
let intruderToken;
let intruderCsrf;

/** Fixtures. */
let stable;
let breed;
let horseA; // owner's horse, the general rename subject
let horseB; // owner's second horse, same stable — duplicate-name proof
let intruderHorse; // second player's horse — collapse proof
let sire;
let dam;
let nonExistentHorseId;

const createdUserIds = [];
const createdHorseIds = [];

async function makeUser(suffix) {
  const tag = randomBytes(4).toString('hex');
  const user = await prisma.user.create({
    data: {
      username: `${FIXTURE_PREFIX}-${suffix}-${tag}`,
      email: `${FIXTURE_PREFIX}-${suffix}-${tag}@example.com`,
      password: 'irrelevant-hash',
      firstName: 'Rename',
      lastName: suffix,
      money: 0,
    },
  });
  createdUserIds.push(user.id);
  return user;
}

async function makeHorse(user, name, extra = {}) {
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name,
      sex: 'Mare',
      dateOfBirth: new Date(Date.now() - 5 * 365 * DAY_MS),
      age: 5,
      breedId: breed.id,
      userId: user.id,
      ...extra,
    },
  });
  createdHorseIds.push(horse.id);
  return horse;
}

/** Issue the rename request as a given player. */
function rename(id, body, { token, csrf }) {
  return request(app)
    .patch(`/api/v1/horses/${id}/name`)
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', ORIGIN)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .set('Content-Type', 'application/json')
    .send(body);
}

/** Read the stored name straight from the row — per-horse, never an aggregate. */
async function storedName(id) {
  const row = await prisma.horse.findUnique({ where: { id }, select: { name: true } });
  return row?.name ?? null;
}

beforeAll(async () => {
  breed = await prisma.breed.upsert({
    where: { name: 'Thoroughbred' },
    update: {},
    create: { name: 'Thoroughbred', description: 'rename-suite breed' },
  });

  stable = await prisma.stable.create({
    data: { name: `${FIXTURE_PREFIX}-Stable-${randomBytes(4).toString('hex')}` },
  });

  owner = await makeUser('owner');
  intruder = await makeUser('intruder');

  horseA = await makeHorse(owner, `${FIXTURE_PREFIX}-HorseA`, { stableId: stable.id });
  horseB = await makeHorse(owner, `${FIXTURE_PREFIX}-HorseB`, { stableId: stable.id });
  intruderHorse = await makeHorse(intruder, `${FIXTURE_PREFIX}-IntruderHorse`);

  // Real pregnancy → real foaling, so the foal's name is derived by the actual
  // production code path rather than typed by the test.
  sire = await makeHorse(owner, `${FIXTURE_PREFIX}-Sire`, { sex: 'Stallion' });
  dam = await makeHorse(owner, `${FIXTURE_PREFIX}-Dam`, {
    inFoalSinceDate: new Date(Date.now() - 8 * DAY_MS),
    pregnancySireId: sire.id,
    pregnancyFeedingsByTier: {},
  });

  // An id that provably holds no row. The aggregate only picks a CANDIDATE; the
  // absence is then read per row, because on a shared database another session
  // could occupy any id an aggregate suggests. Fails loudly rather than silently
  // testing the wrong thing.
  const maxId = await prisma.horse.aggregate({ _max: { id: true } });
  let candidate = (maxId._max.id ?? 0) + 5000;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const occupied = await prisma.horse.findUnique({ where: { id: candidate }, select: { id: true } });
    if (!occupied) {
      break;
    }
    candidate += 5000;
  }
  const stillOccupied = await prisma.horse.findUnique({
    where: { id: candidate },
    select: { id: true },
  });
  if (stillOccupied) {
    throw new Error(`[rename suite] could not find an unoccupied horse id near ${candidate}`);
  }
  nonExistentHorseId = candidate;

  ownerToken = generateTestToken({ id: owner.id, email: owner.email, role: 'user' });
  intruderToken = generateTestToken({ id: intruder.id, email: intruder.email, role: 'user' });
  ownerCsrf = await fetchCsrf(app, { extraCookies: [`accessToken=${ownerToken}`] });
  intruderCsrf = await fetchCsrf(app, { extraCookies: [`accessToken=${intruderToken}`] });

  // Scoped, fail-loud cleanup registered in dependency order: child rows that
  // reference a horse, then the foal, then the parents/horses, then the stable
  // and the users. Every delete is scoped by id or by this suite's prefix.
  cleanup.add(() => prisma.notification.deleteMany({ where: { userId: { in: createdUserIds } } }), 'notifications');
  cleanup.add(() => prisma.horseXpEvent.deleteMany({ where: { horseId: { in: createdHorseIds } } }), 'horseXpEvents');
  cleanup.add(
    () => prisma.foalDevelopment.deleteMany({ where: { foalId: { in: createdHorseIds } } }),
    'foalDevelopment',
  );
  cleanup.add(
    () =>
      prisma.horse.updateMany({
        where: { id: { in: createdHorseIds } },
        data: { sireId: null, damId: null, pregnancySireId: null },
      }),
    'detachParentage',
  );
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } }), 'horses');
  // Safety net for the POST /horses cases below: if a create the suite EXPECTS to
  // be rejected ever succeeds, the row would have an id this file never learned.
  // Scoped to this suite's own two users, so it can only ever remove fixtures
  // this suite is responsible for.
  cleanup.add(() => prisma.horse.deleteMany({ where: { userId: { in: createdUserIds } } }), 'horsesByFixtureOwner');
  cleanup.add(() => prisma.stable.deleteMany({ where: { id: stable.id } }), 'stable');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }), 'users');
}, 120000);

afterAll(async () => {
  await cleanup.run();
}, 120000);

describe('PATCH /api/v1/horses/:id/name — the owner can rename', () => {
  it('renames the horse and persists the new name', async () => {
    const newName = `${FIXTURE_PREFIX}-Renamed-${randomBytes(3).toString('hex')}`;

    const res = await rename(horseA.id, { name: newName }, { token: ownerToken, csrf: ownerCsrf });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Exact payload: `data` carries the id and the committed name and NOTHING
    // else. `toEqual` (not `toMatchObject`) is the point — it fails if any extra
    // field is added back, including the pre-write echo field this endpoint
    // deliberately does not have (Equoria-qkgfh.1 fix round: a field read before
    // the write can report a superseded name, and no client consumed it).
    expect(res.body.data).toEqual({ id: horseA.id, name: newName });

    // Persisted-state assertion on THIS horse's own row.
    expect(await storedName(horseA.id)).toBe(newName);
  }, 60000);

  it('accepts a name at the 40-character maximum and stores it verbatim', async () => {
    // OWNER RULING 2026-09-14 (Equoria-zalyb): "Limit: 40 characters for horse
    // names". This asserted 100 before; the bound moved, so the proof moved with
    // it rather than being left asserting a rule the system no longer has.
    const maxName = 'M'.repeat(40);

    const res = await rename(horseA.id, { name: maxName }, { token: ownerToken, csrf: ownerCsrf });

    expect(res.status).toBe(200);
    expect(await storedName(horseA.id)).toBe(maxName);
  }, 60000);

  it("accepts apostrophes and non-ASCII letters (O'Malley, Étoile)", async () => {
    const fancy = "O'Malley's Étoile";

    const res = await rename(horseA.id, { name: fancy }, { token: ownerToken, csrf: ownerCsrf });

    expect(res.status).toBe(200);
    expect(await storedName(horseA.id)).toBe(fancy);
  }, 60000);

  // The ratified scope is narrow ON PURPOSE (Equoria-du5qe, owner 2026-09-14):
  // '<' is refused as boundary hygiene because it opens a tag; a lone '>' cannot,
  // so it stays a legal character in a horse's name. Without this case, widening
  // the policy to `name.includes('>')` would pass every test in the tree and only
  // the comment in horseNamePolicy.mjs would contradict it.
  it("accepts a closing angle bracket — only '<' is refused, and only as boundary hygiene", async () => {
    const withGt = 'Fred > Barney';

    const res = await rename(horseA.id, { name: withGt }, { token: ownerToken, csrf: ownerCsrf });

    expect(res.status).toBe(200);
    expect(await storedName(horseA.id)).toBe(withGt);
  }, 60000);
  it('replaces the `unnamed` name the real foaling service gives a newborn foal', async () => {
    const { foal } = await createFoalFromPregnancy({
      damId: dam.id,
      sireId: sire.id,
      options: { userId: owner.id },
    });
    createdHorseIds.push(foal.id);

    // OWNER RULING 2026-09-14 (Equoria-4fnro): a foal nobody named is born
    // 'unnamed' and stays so until the player names her. This asserted
    // `<Dam> Foal` before — a generated name that read like a choice.
    expect(foal.name).toBe(UNNAMED_HORSE_NAME);
    expect(foal.name).toBe('unnamed');

    const chosenName = 'Fred';
    const res = await rename(foal.id, { name: chosenName }, { token: ownerToken, csrf: ownerCsrf });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: foal.id, name: chosenName });
    expect(await storedName(foal.id)).toBe(chosenName);
  }, 120000);

  it("the birth name is one the game's own rule accepts, and a second unnamed foal is not a collision", async () => {
    // Two claims the birth name depends on, neither of them safe to leave as a
    // comment. (1) 'unnamed' satisfies the policy, so the game never mints a
    // name it would refuse on the way in. (2) names are not unique, so a second
    // unnamed foal in the same stable is simply a second horse waiting for a
    // name — if a unique index or a name lookup ever appeared, this fails.
    expect(unnamedNameIsAcceptable()).toBe(true);
    expect(horseNameRejectionReason(UNNAMED_HORSE_NAME)).toBeNull();

    // Two dams of this case's own — the shared `dam` fixture's pregnancy is
    // consumed by whichever foaling case runs first.
    const inFoal = () => ({
      inFoalSinceDate: new Date(Date.now() - 8 * DAY_MS),
      pregnancySireId: sire.id,
      pregnancyFeedingsByTier: {},
    });
    const firstDam = await makeHorse(owner, `${FIXTURE_PREFIX}-DamA`, inFoal());
    const secondDam = await makeHorse(owner, `${FIXTURE_PREFIX}-DamB`, inFoal());

    const { foal: firstFoal } = await createFoalFromPregnancy({
      damId: firstDam.id,
      sireId: sire.id,
      options: { userId: owner.id },
    });
    createdHorseIds.push(firstFoal.id);

    const { foal: secondFoal } = await createFoalFromPregnancy({
      damId: secondDam.id,
      sireId: sire.id,
      options: { userId: owner.id },
    });
    createdHorseIds.push(secondFoal.id);

    expect(firstFoal.name).toBe(UNNAMED_HORSE_NAME);
    expect(secondFoal.name).toBe(UNNAMED_HORSE_NAME);
    expect(secondFoal.id).not.toBe(firstFoal.id);

    // And naming one leaves the other exactly as she was.
    const res = await rename(firstFoal.id, { name: `${FIXTURE_PREFIX}-Named` }, { token: ownerToken, csrf: ownerCsrf });
    expect(res.status).toBe(200);
    expect(await storedName(secondFoal.id)).toBe(UNNAMED_HORSE_NAME);
  }, 120000);
});

describe('PATCH /api/v1/horses/:id/name — authorization collapses (CWE-639)', () => {
  it('refuses a non-owner and returns a response identical to a horse that does not exist', async () => {
    const attempt = `${FIXTURE_PREFIX}-Stolen`;

    const notMine = await rename(horseB.id, { name: attempt }, { token: intruderToken, csrf: intruderCsrf });
    const notReal = await rename(nonExistentHorseId, { name: attempt }, { token: intruderToken, csrf: intruderCsrf });

    expect(notMine.status).toBe(404);
    expect(notReal.status).toBe(404);
    // The load-bearing assertion: the two bodies must be indistinguishable, so
    // the endpoint reveals nothing about which horse ids exist.
    expect(notMine.body).toEqual(notReal.body);
    // And pin the shape itself, so the service's TOCTOU-window 404 (asserted
    // below) can be compared against a fixed target rather than against whatever
    // the middleware happens to emit.
    expect(notMine.body).toEqual({
      success: false,
      message: 'Horse not found',
      status: 'fail',
    });

    // And the refusal was real — HorseB still carries its original name.
    expect(await storedName(horseB.id)).toBe(`${FIXTURE_PREFIX}-HorseB`);
  }, 60000);

  it('refuses an unauthenticated request', async () => {
    const res = await request(app)
      .patch(`/api/v1/horses/${horseA.id}/name`)
      .set('Origin', ORIGIN)
      .set('Content-Type', 'application/json')
      .send({ name: `${FIXTURE_PREFIX}-Anon` });

    expect([401, 403]).toContain(res.status);
    expect(await storedName(horseA.id)).not.toBe(`${FIXTURE_PREFIX}-Anon`);
  }, 60000);
});

describe('renameHorseService — the write itself re-asserts ownership', () => {
  /**
   * The route's requireOwnership read happens BEFORE the write, so a horse sold
   * or gifted in the gap would still be renamed by a stale decision. These call
   * the service directly — no HTTP, no middleware — so the guard inside the
   * UPDATE's own WHERE clause is what is under test. Delete the `userId` from
   * that WHERE clause and the first case turns green-on-a-lie; it must not.
   */
  it('refuses to rename a horse the given user does not own, and leaves the row alone', async () => {
    const before = await storedName(intruderHorse.id);

    const result = await renameHorseById(intruderHorse.id, owner.id, 'Stolen By Service');

    expect(result.status).toBe(404);
    // Byte-identical to the middleware's 404 asserted in the collapse case above,
    // `status: 'fail'` included — so the refusal is indistinguishable whichever
    // layer produces it.
    expect(result.body).toEqual({
      success: false,
      message: 'Horse not found',
      status: 'fail',
    });
    expect(await storedName(intruderHorse.id)).toBe(before);
  }, 60000);

  it('refuses a policy-violating name at the WRITE site, not only at the route', async () => {
    // Defence in depth: the route validates first, so this is unreachable over
    // HTTP. It matters because the service is the write site, and
    // check-horse-name-gated.mjs flagged that this file wrote horses.name while
    // knowing nothing about the rule.
    //
    // Deleting the service-layer guard fails THIS case. It does NOT redden the
    // doctrine check unless the `horseNamePolicy` import goes with it — measured,
    // not assumed: with the guard removed and the import left in place the check
    // still reports OK and exits 0. That is the check's file-level limit showing
    // up in this suite's own subject, and it is why this test exists rather than
    // leaning on the gate.
    const before = await storedName(horseB.id);

    const result = await renameHorseById(horseB.id, owner.id, 'L'.repeat(41));

    expect(result.status).toBe(400);
    expect(result.body.message).toBe('Horse name must be between 1 and 40 characters');
    expect(await storedName(horseB.id)).toBe(before);
  }, 60000);

  it('renames when the user does own the horse', async () => {
    const result = await renameHorseById(horseB.id, owner.id, 'Service Renamed');

    expect(result.status).toBe(200);
    expect(result.body.data).toEqual({ id: horseB.id, name: 'Service Renamed' });
    expect(await storedName(horseB.id)).toBe('Service Renamed');
  }, 60000);
});

describe('PATCH /api/v1/horses/:id/name — duplicate names are legal (owner ruling)', () => {
  it('lets two horses in the SAME stable hold the same name', async () => {
    const shared = 'Fred';

    const first = await rename(horseA.id, { name: shared }, { token: ownerToken, csrf: ownerCsrf });
    const second = await rename(horseB.id, { name: shared }, { token: ownerToken, csrf: ownerCsrf });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const rows = await prisma.horse.findMany({
      where: { id: { in: [horseA.id, horseB.id] } },
      select: { id: true, name: true, stableId: true },
      orderBy: { id: 'asc' },
    });
    expect(rows.every(r => r.name === shared)).toBe(true);
    expect(rows.every(r => r.stableId === stable.id)).toBe(true);
  }, 60000);

  it('lets horses in DIFFERENT stables (different owners) hold the same name', async () => {
    const shared = 'Fred';

    const mine = await rename(horseA.id, { name: shared }, { token: ownerToken, csrf: ownerCsrf });
    const theirs = await rename(intruderHorse.id, { name: shared }, { token: intruderToken, csrf: intruderCsrf });

    expect(mine.status).toBe(200);
    expect(theirs.status).toBe(200);
    expect(await storedName(horseA.id)).toBe(shared);
    expect(await storedName(intruderHorse.id)).toBe(shared);
  }, 60000);
});

describe('PATCH /api/v1/horses/:id/name — validation is fail-closed', () => {
  const settle = 'Settled-Name';

  // Re-settle before EVERY case so each rejection is proved in isolation. Without
  // this, one rule that stops rejecting would corrupt the stored name and every
  // later case would fail too, hiding which rule actually broke.
  beforeEach(async () => {
    await prisma.horse.update({ where: { id: horseA.id }, data: { name: settle } });
  }, 60000);

  // The stated policy is "rejected with a message naming the rule", so each case
  // pins the EXACT message. A refactor collapsing all three into one generic
  // string would now fail here instead of staying green.
  const TYPE_MSG = 'Horse name must be a string';
  const LENGTH_MSG = 'Horse name must be between 1 and 40 characters';
  const CHAR_MSG = 'Horse name may not contain < or a null character';

  const rejected = [
    ['a non-string name', { name: 42 }, TYPE_MSG],
    ['a null name', { name: null }, TYPE_MSG],
    ['a missing name', {}, TYPE_MSG],
    ['an empty name', { name: '' }, LENGTH_MSG],
    ['a whitespace-only name', { name: '   ' }, LENGTH_MSG],
    ['a name longer than 40 characters', { name: 'L'.repeat(41) }, LENGTH_MSG],
    // Boundary hygiene, not a naming rule: '<' is refused so a name can never be
    // interpreted as markup by a surface that renders it unescaped. Ratified by the
    // owner 2026-09-14 (Equoria-du5qe); see horseNamePolicy.mjs for why, and do not
    // widen or delete the rule without an owner ruling.
    [
      'a name containing an angle bracket (boundary hygiene against unescaped rendering surfaces)',
      { name: '<script>Fred' },
      CHAR_MSG,
    ],
    ['a name containing a NUL byte', { name: 'Fred\u0000Bell' }, CHAR_MSG],
    ['an unexpected extra field', { name: 'Fred', userId: 'someone-else' }, 'Invalid rename payload: unexpected field'],
  ];

  it.each(rejected)(
    'rejects %s with 400, the message naming the rule, and the stored name untouched',
    async (_label, body, expectedMessage) => {
      const res = await rename(horseA.id, body, { token: ownerToken, csrf: ownerCsrf });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe(expectedMessage);
      expect(await storedName(horseA.id)).toBe(settle);
    },
    60000,
  );

  it('rejects a non-JSON content type', async () => {
    const res = await request(app)
      .patch(`/api/v1/horses/${horseA.id}/name`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Origin', ORIGIN)
      .set('Cookie', ownerCsrf.cookieHeader)
      .set('X-CSRF-Token', ownerCsrf.csrfToken)
      .set('Content-Type', 'text/plain')
      .send('name=Fred');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid rename payload');
    expect(await storedName(horseA.id)).toBe(settle);
  }, 60000);
});

describe('one name rule governs every GATED horse-name path', () => {
  /**
   * The parity property: no live path may accept a name the rename endpoint would
   * refuse, or a player could own a horse they cannot rename to anything
   * resembling what it is.
   *
   * REBASE NOTE (Equoria-qkgfh.1, round 3). These cases used to drive
   * `POST /api/v1/horses`. On this base that endpoint is CLOSED — it returns 403
   * before any validation runs (Finding 2 / Equoria-6p398.2), so
   * `validateHorseCreation` is dead code and asserting a 400 there would have been
   * asserting against a route no player can reach. The live gated creation path is
   * `POST /api/v1/horses/foals`, so parity is proved there instead. Its `name` is
   * OPTIONAL (Equoria-6w3ur) — absent passes, supplied is held to the full policy —
   * which is exactly the contract these cases pin.
   */
  // 42 UTF-16 units, 21 code points - over the 40-unit cap by the RAW count the
  // policy uses, and under it by validator.js's code-point count. That gap is why
  // the policy measures raw `.length` (Equoria-zalyb moved the bound from 100 to
  // 40; the arithmetic it guards is unchanged).
  const EMOJI_OVER_CAP = '\u{1F600}'.repeat(21);

  /** Breed with a supplied name. Validation runs before ownership/eligibility. */
  function breedWithName(name) {
    return request(app)
      .post('/api/v1/horses/foals')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Origin', ORIGIN)
      .set('Cookie', ownerCsrf.cookieHeader)
      .set('X-CSRF-Token', ownerCsrf.csrfToken)
      .set('Content-Type', 'application/json')
      .send({ sireId: sire.id, damId: horseB.id, name });
  }

  /** Read the mare's own row — never an aggregate — to prove nothing happened. */
  async function pregnancyStateOf(horseId) {
    return prisma.horse.findUnique({
      where: { id: horseId },
      select: { inFoalSinceDate: true, pendingFoalName: true },
    });
  }

  it('POST /horses/foals refuses a whitespace-only name, as rename does', async () => {
    const res = await breedWithName('   ');

    expect(res.status).toBe(400);
    // Same rule; this path reports it through express-validator's errors array.
    expect(JSON.stringify(res.body)).toContain('Horse name must be between 1 and 40');

    // Per-row: no pregnancy claimed on the mare, and no such horse exists.
    const mare = await pregnancyStateOf(horseB.id);
    expect(mare.inFoalSinceDate).toBeNull();
    expect(mare.pendingFoalName).toBeNull();
    expect(await prisma.horse.count({ where: { userId: owner.id, name: '   ' } })).toBe(0);
  }, 60000);

  it('POST /horses/foals refuses an emoji name over the raw 40-unit cap, as rename does', async () => {
    const res = await breedWithName(EMOJI_OVER_CAP);

    expect(res.status).toBe(400);
    const mare = await pregnancyStateOf(horseB.id);
    expect(mare.inFoalSinceDate).toBeNull();
    expect(mare.pendingFoalName).toBeNull();
  }, 60000);

  it('rename refuses that same emoji name, so no gated path can mint an unrenameable horse', async () => {
    const res = await rename(horseA.id, { name: EMOJI_OVER_CAP }, { token: ownerToken, csrf: ownerCsrf });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Horse name must be between 1 and 40 characters');
  }, 60000);

  it('rename still accepts 20 emoji (exactly 40 UTF-16 units, at the cap)', async () => {
    const twenty = '\u{1F600}'.repeat(20);
    expect(twenty.length).toBe(40);

    const res = await rename(horseA.id, { name: twenty }, { token: ownerToken, csrf: ownerCsrf });

    expect(res.status).toBe(200);
    expect(await storedName(horseA.id)).toBe(twenty);
  }, 60000);

  it('POST /api/v1/horses is closed, so its validator is dead code on this base', async () => {
    // Pinned so a future reopening of that endpoint has to confront the parity
    // question deliberately, rather than silently restoring an ungated creation
    // path while this suite still claims every gated path agrees.
    const res = await request(app)
      .post('/api/v1/horses')
      .set('Authorization', `Bearer ${ownerToken}`)
      .set('Origin', ORIGIN)
      .set('Cookie', ownerCsrf.cookieHeader)
      .set('X-CSRF-Token', ownerCsrf.csrfToken)
      .set('Content-Type', 'application/json')
      .send({ name: '   ', breedId: breed.id, sex: 'Mare' });

    expect(res.status).toBe(403);
  }, 60000);
});
