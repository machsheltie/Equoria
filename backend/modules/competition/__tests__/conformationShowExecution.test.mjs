/**
 * conformationShowExecution.test.mjs — controller-harness COMPONENT suite
 * (real DB, controller-only) — Story 31F-3
 *
 * ⚠️ NOT AN INTEGRATION TEST. Equoria-1zpd reclassification: this file was
 * formerly mislabeled "Integration tests" while its primary path drives
 * the controller directly through a buildReq/buildRes fake harness
 * (controller-only — no Express middleware chain, no HTTP, no supertest).
 * Per .claude/rules test-architecture doctrine a controller-harness suite
 * is a COMPONENT test, not an integration test, and MUST NOT be cited as
 * integration or beta-readiness evidence. The host-triggered POST /execute
 * handler it used to drive was removed (Equoria-mwjst); see the note below.
 *
 * The pure-helper unit assertions (resolveReward / resolveTitle /
 * applyBreedingValueBoost) were SPLIT OUT into
 * conformationShowRewards.unit.test.mjs (Equoria-1zpd) — they are pure,
 * DB-free, harness-free and belong in a unit-named file.
 *
 * NO MOCKS. Equoria-p6fx (no-mocks doctrine epic 2026-04-30): converted from
 * jest.unstable_mockModule of express-validator + ownership middleware +
 * prisma + conformationShowService + logger to real DB. Real shows +
 * entries + horses + grooms + assignments; the real service computes
 * scores; tests assert on response shape and DB state without depending on
 * exact placement values (which depend on internal scoring randomness).
 *
 * Removed (per doctrine):
 *   - Tests that hardcoded canned _mockExecuteResult arrays — those
 *     bypassed the real service entirely. Replaced with real-DB tests
 *     that exercise the full pipeline.
 *   - "returns 500 on unexpected service error" — required mocking the
 *     service to throw. Synthetic fault injection forbidden.
 *   - "returns 400 on express-validator errors" — controller-level
 *     validator runs in the route middleware chain, not the handler
 *     itself; covered by the real HTTP integration suite.
 *   - "show already executed returns 400" — covered by service-level
 *     test of executeConformationShow.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { getConformationTitles } from '../controllers/conformationShowController.mjs';
import { executeConformationShow } from '../services/conformationShowService.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';

const SUITE_PREFIX = 'cfexe';

function buildReq({ body = {}, params = {}, user }) {
  return { body, params, user };
}

function buildRes() {
  let _status = 200;
  let _body = null;
  return {
    status(c) {
      _status = c;
      return this;
    },
    json(b) {
      _body = b;
      return this;
    },
    get statusValue() {
      return _status;
    },
    get jsonValue() {
      return _body;
    },
  };
}

const VALID_CONFORMATION_SCORES = {
  head: 80,
  neck: 75,
  shoulders: 70,
  back: 85,
  legs: 78,
  hooves: 72,
  topline: 80,
  hindquarters: 76,
  overallConformation: 78,
};

async function createUser() {
  const uid = randomBytes(8).toString('hex');
  return prisma.user.create({
    data: {
      id: `${SUITE_PREFIX}-${uid}`,
      username: `${SUITE_PREFIX}_${uid}`,
      email: `${SUITE_PREFIX}-${uid}@example.com`,
      firstName: 'Cf',
      lastName: 'Exe',
      password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyGJ4lxPcxqy',
      emailVerified: true,
    },
  });
}

async function createHorse(userId, overrides = {}) {
  return prisma.horse.create({
    data: await testHorseData(prisma, {
      ...fixtureColor(),
      name: overrides.name ?? `${SUITE_PREFIX}-h-${randomBytes(4).toString('hex')}`,
      sex: overrides.sex ?? 'Mare',
      dateOfBirth: new Date('2021-01-01'),
      age: overrides.age ?? 4,
      healthStatus: overrides.healthStatus ?? 'Excellent',
      bondScore: 70,
      temperament: 'Calm',
      conformationScores: VALID_CONFORMATION_SCORES,
      titlePoints: overrides.titlePoints ?? 0,
      currentTitle: overrides.currentTitle ?? null,
      breedingValueBoost: overrides.breedingValueBoost ?? 0,
      user: { connect: { id: userId } },
    }),
  });
}

async function createGroom(userId) {
  return prisma.groom.create({
    data: {
      name: `${SUITE_PREFIX}-g-${randomBytes(4).toString('hex')}`,
      speciality: 'show_handling',
      personality: 'gentle',
      skillLevel: 'expert',
      user: { connect: { id: userId } },
    },
  });
}

async function createConformationShow(overrides = {}) {
  // Equoria-mwjst: a show settles only once its closeDate has passed (owner
  // ruling 2026-10-05: 7 days from creation, nightly job). These idempotency
  // fixtures model a show whose week is already over: opened 7 days and an
  // hour ago, closed an hour ago. They used to model a show still seven days
  // from due, which only "settled" because the old code never checked.
  const closeDate = new Date(Date.now() - 60 * 60 * 1000);
  const data = {
    name: `${SUITE_PREFIX}-show-${randomBytes(4).toString('hex')}`,
    discipline: 'Conformation',
    levelMin: 1,
    levelMax: 10,
    entryFee: 50,
    prize: 0,
    openDate: new Date(closeDate.getTime() - 7 * 24 * 60 * 60 * 1000),
    closeDate,
    runDate: closeDate,
    showType: 'conformation',
    status: overrides.status ?? 'open',
  };
  if (overrides.hostUserId !== undefined) {
    data.hostUserId = overrides.hostUserId;
  }
  return prisma.show.create({ data });
}

async function createGroomAssignment(groomId, foalId, userId) {
  return prisma.groomAssignment.create({
    data: {
      groom: { connect: { id: groomId } },
      foal: { connect: { id: foalId } },
      user: { connect: { id: userId } },
      isActive: true,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
  });
}

async function createShowEntry(showId, horseId, userId) {
  return prisma.showEntry.create({
    data: {
      show: { connect: { id: showId } },
      horse: { connect: { id: horseId } },
      user: { connect: { id: userId } },
      feePaid: 50,
    },
  });
}

async function cleanupSuite() {
  const users = await prisma.user.findMany({
    where: { id: { startsWith: SUITE_PREFIX } },
    select: { id: true },
  });
  if (users.length === 0) {
    return;
  }
  const userIds = users.map(u => u.id);
  const horses = await prisma.horse.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const horseIds = horses.map(h => h.id);
  const grooms = await prisma.groom.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const groomIds = grooms.map(g => g.id);
  if (groomIds.length > 0) {
    await prisma.groomAssignment.deleteMany({ where: { groomId: { in: groomIds } } });
  }
  if (horseIds.length > 0) {
    await prisma.competitionResult.deleteMany({ where: { horseId: { in: horseIds } } });
    await prisma.showEntry.deleteMany({ where: { horseId: { in: horseIds } } });
  }
  await prisma.show.deleteMany({ where: { name: { startsWith: SUITE_PREFIX } } });
  await prisma.horse.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.groom.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

// NOTE (Equoria-1zpd): the pure-helper unit tests for resolveReward /
// resolveTitle / applyBreedingValueBoost were SPLIT OUT of this file into
// conformationShowRewards.unit.test.mjs. They are pure (no DB, no harness)
// and belong in a unit-named file, not here.

// ===========================================================================
// executeConformationShowHandler — REMOVED (Equoria-mwjst)
// ===========================================================================
//
// This file used to drive the host-triggered POST /execute handler through a
// controller harness, including "returns 200 when caller IS the show host" for
// a show whose runDate was seven days away. That was the vulnerable contract
// (Codex scan 2026-10-02 Finding 2): a host could pay out titles and
// breeding-value boosts the moment they asked. Owner ruling 2026-10-05: the
// nightly show job settles conformation shows once closeDate passes; there is
// no player settlement route, so the handler and its harness tests are gone.
// Their behavioural coverage moved with the behaviour: result shape, no prize
// money, the not-due refusal and exactly-once settlement run through the real
// nightly executor in conformationShowSettlementServerAuthoritative
// .integration.test.mjs; the empty-show and wrong-show-type service branches
// stay in conformationShowService.test.mjs; idempotency stays below.

// ===========================================================================
// getConformationTitles — real DB integration
// ===========================================================================

describe('getConformationTitles (real DB)', () => {
  beforeAll(cleanupSuite);
  afterAll(cleanupSuite);
  afterEach(cleanupSuite);

  describe('AC5 — returns accumulated title data', () => {
    it('returns 200 with horseId, horseName, titlePoints, currentTitle, breedingValueBoost', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id, {
        name: 'Starlight',
        titlePoints: 55,
        currentTitle: 'Distinguished',
        breedingValueBoost: 0.08,
      });

      const req = buildReq({ user: { id: user.id }, params: { horseId: String(horse.id) } });
      const res = buildRes();

      await getConformationTitles(req, res);

      expect(res.statusValue).toBe(200);
      const data = res.jsonValue.data;
      expect(data.horseId).toBe(horse.id);
      expect(data.horseName).toBe('Starlight');
      expect(data.titlePoints).toBe(55);
      expect(data.currentTitle).toBe('Distinguished');
      expect(data.breedingValueBoost).toBeCloseTo(0.08);
    });

    it('returns null currentTitle and 0 titlePoints for untitled horse', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id, {
        name: 'Nova',
        titlePoints: 0,
        currentTitle: null,
        breedingValueBoost: 0,
      });

      const req = buildReq({ user: { id: user.id }, params: { horseId: String(horse.id) } });
      const res = buildRes();

      await getConformationTitles(req, res);

      expect(res.statusValue).toBe(200);
      const data = res.jsonValue.data;
      expect(data.titlePoints).toBe(0);
      expect(data.currentTitle).toBeNull();
    });
  });

  describe('AC5 — IDOR: returns 404 for unowned horse', () => {
    it('returns 404 when horse belongs to a different user', async () => {
      const owner = await createUser();
      const otherUser = await createUser();
      const horse = await createHorse(owner.id);

      const req = buildReq({ user: { id: otherUser.id }, params: { horseId: String(horse.id) } });
      const res = buildRes();

      await getConformationTitles(req, res);

      expect(res.statusValue).toBe(404);
      expect(res.jsonValue.success).toBe(false);
    });

    it('returns 404 when horse does not exist', async () => {
      const user = await createUser();
      const req = buildReq({ user: { id: user.id }, params: { horseId: '999999999' } });
      const res = buildRes();

      await getConformationTitles(req, res);

      expect(res.statusValue).toBe(404);
    });
  });
});

// ===========================================================================
// Idempotency — Equoria-08ln (executeConformationShow service)
// ===========================================================================
//
// The first call to executeConformationShow() for an `open` show must run
// to completion and flip Show.status to 'completed' atomically inside the
// $transaction. The second call must reject with statusCode=400 and must
// NOT mutate Horse.titlePoints / Horse.breedingValueBoost or insert any
// additional CompetitionResult rows.
//
// Sentinel-positive test pair per OPTIMAL_FIX_DISCIPLINE §2:
//   - first call: status open → completes, status:'completed'
//   - second call: status already 'completed' → throws Show already executed
//
// Real DB. No mocks. No bypass headers.

describe('executeConformationShow — idempotency (Equoria-08ln)', () => {
  beforeAll(cleanupSuite);
  afterAll(cleanupSuite);
  afterEach(cleanupSuite);

  it('first call completes and marks show.status === "completed"', async () => {
    const user = await createUser();
    const horse = await createHorse(user.id);
    const groom = await createGroom(user.id);
    await createGroomAssignment(groom.id, horse.id, user.id);
    const show = await createConformationShow();
    await createShowEntry(show.id, horse.id, user.id);

    const results = await executeConformationShow(show.id);

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(1);

    const showAfter = await prisma.show.findUnique({ where: { id: show.id } });
    expect(showAfter.status).toBe('completed');
  });

  it('second call on the same showId throws "Show already executed" with statusCode 400', async () => {
    const user = await createUser();
    const horse = await createHorse(user.id);
    const groom = await createGroom(user.id);
    await createGroomAssignment(groom.id, horse.id, user.id);
    const show = await createConformationShow();
    await createShowEntry(show.id, horse.id, user.id);

    await executeConformationShow(show.id);

    // Second call MUST throw — not silently re-distribute rewards.
    let caught;
    try {
      await executeConformationShow(show.id);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(caught.statusCode).toBe(400);
    expect(String(caught.message)).toMatch(/already executed/i);
  });

  it('second call leaves Horse.titlePoints and Horse.breedingValueBoost unchanged', async () => {
    const user = await createUser();
    const horse = await createHorse(user.id);
    const groom = await createGroom(user.id);
    await createGroomAssignment(groom.id, horse.id, user.id);
    const show = await createConformationShow();
    await createShowEntry(show.id, horse.id, user.id);

    await executeConformationShow(show.id);
    const horseAfterFirst = await prisma.horse.findUnique({ where: { id: horse.id } });
    const tpAfterFirst = horseAfterFirst.titlePoints;
    const bvbAfterFirst = horseAfterFirst.breedingValueBoost;

    try {
      await executeConformationShow(show.id);
    } catch {
      /* expected throw */
    }

    const horseAfterSecond = await prisma.horse.findUnique({ where: { id: horse.id } });
    expect(horseAfterSecond.titlePoints).toBe(tpAfterFirst);
    expect(horseAfterSecond.breedingValueBoost).toBeCloseTo(bvbAfterFirst);
  });

  it('second call creates no additional CompetitionResult rows', async () => {
    const user = await createUser();
    const horse = await createHorse(user.id);
    const groom = await createGroom(user.id);
    await createGroomAssignment(groom.id, horse.id, user.id);
    const show = await createConformationShow();
    await createShowEntry(show.id, horse.id, user.id);

    await executeConformationShow(show.id);
    const countAfterFirst = await prisma.competitionResult.count({ where: { showId: show.id } });
    expect(countAfterFirst).toBe(1);

    try {
      await executeConformationShow(show.id);
    } catch {
      /* expected throw */
    }

    const countAfterSecond = await prisma.competitionResult.count({ where: { showId: show.id } });
    expect(countAfterSecond).toBe(1);
  });

  it('rejects a show that was created with status already === "completed"', async () => {
    // Sentinel: covers the case where some other path (admin override, data
    // import, manual fixture) sets status=completed without going through
    // executeConformationShow. The idempotency guard must trust the
    // persisted status and refuse, not double-distribute.
    const user = await createUser();
    const horse = await createHorse(user.id);
    const groom = await createGroom(user.id);
    await createGroomAssignment(groom.id, horse.id, user.id);
    const show = await createConformationShow({ status: 'completed' });
    await createShowEntry(show.id, horse.id, user.id);

    let caught;
    try {
      await executeConformationShow(show.id);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(caught.statusCode).toBe(400);
    expect(String(caught.message)).toMatch(/already executed/i);
  });
});
