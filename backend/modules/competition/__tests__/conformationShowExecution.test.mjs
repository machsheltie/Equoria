/**
 * Integration tests for conformationShowController.mjs — execute + titles (Story 31F-3) — real DB
 *
 * NO MOCKS. Equoria-p6fx (no-mocks doctrine epic 2026-04-30): converted from
 * jest.unstable_mockModule of express-validator + ownership middleware +
 * prisma + conformationShowService + logger to a real-DB integration test.
 *
 * Sections:
 *   1. Pure helper unit tests (resolveReward, resolveTitle, applyBreedingValueBoost) —
 *      no mocking ever needed.
 *   2. Real-DB integration tests for executeConformationShowHandler and
 *      getConformationTitles. Real shows + entries + horses + grooms +
 *      assignments. The real service computes scores; tests assert on
 *      response shape and DB state without depending on exact placement
 *      values (which depend on internal scoring randomness).
 *
 * Removed (per doctrine):
 *   - Tests that hardcoded canned _mockExecuteResult arrays — those
 *     bypassed the real service entirely. Replaced with real-DB tests
 *     that exercise the full pipeline.
 *   - "returns 500 on unexpected service error" — required mocking the
 *     service to throw. Synthetic fault injection forbidden.
 *   - "returns 400 on express-validator errors" — controller-level
 *     validator runs in the route middleware chain, not the handler
 *     itself; covered by route-level tests when the routes are tested.
 *   - "show already executed returns 400" — covered by service-level
 *     test of executeConformationShow.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../db/index.mjs';
import { executeConformationShowHandler, getConformationTitles } from '../controllers/conformationShowController.mjs';
import {
  resolveReward,
  resolveTitle,
  applyBreedingValueBoost,
  executeConformationShow,
} from '../../../services/conformationShowService.mjs';

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
    data: {
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
    },
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
  const data = {
    name: `${SUITE_PREFIX}-show-${randomBytes(4).toString('hex')}`,
    discipline: 'Conformation',
    levelMin: 1,
    levelMax: 10,
    entryFee: 50,
    prize: 0,
    runDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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

// ===========================================================================
// Pure helper unit tests (no mocking needed)
// ===========================================================================

describe('resolveReward (AC1 reward table)', () => {
  it('returns Blue ribbon + 10 pts + 5% for 1st', () => {
    expect(resolveReward(1)).toEqual({ ribbon: 'Blue', titlePoints: 10, breedingBoostDelta: 0.05 });
  });
  it('returns Red ribbon + 7 pts + 3% for 2nd', () => {
    expect(resolveReward(2)).toEqual({ ribbon: 'Red', titlePoints: 7, breedingBoostDelta: 0.03 });
  });
  it('returns Yellow ribbon + 5 pts + 1% for 3rd', () => {
    expect(resolveReward(3)).toEqual({ ribbon: 'Yellow', titlePoints: 5, breedingBoostDelta: 0.01 });
  });
  it('returns White ribbon + 2 pts + 0% for 4th', () => {
    expect(resolveReward(4)).toEqual({ ribbon: 'White', titlePoints: 2, breedingBoostDelta: 0 });
  });
  it('returns White ribbon + 2 pts + 0% for 10th', () => {
    expect(resolveReward(10)).toEqual({ ribbon: 'White', titlePoints: 2, breedingBoostDelta: 0 });
  });
});

describe('resolveTitle (AC2 thresholds)', () => {
  it('returns null for 0 points', () => {
    expect(resolveTitle(0)).toBeNull();
  });
  it('returns null for 24 points', () => {
    expect(resolveTitle(24)).toBeNull();
  });
  it('returns Noteworthy at 25 points', () => {
    expect(resolveTitle(25)).toBe('Noteworthy');
  });
  it('returns Noteworthy at 49 points', () => {
    expect(resolveTitle(49)).toBe('Noteworthy');
  });
  it('returns Distinguished at 50 points', () => {
    expect(resolveTitle(50)).toBe('Distinguished');
  });
  it('returns Distinguished at 99 points', () => {
    expect(resolveTitle(99)).toBe('Distinguished');
  });
  it('returns Champion at 100 points', () => {
    expect(resolveTitle(100)).toBe('Champion');
  });
  it('returns Champion at 199 points', () => {
    expect(resolveTitle(199)).toBe('Champion');
  });
  it('returns Grand Champion at 200 points', () => {
    expect(resolveTitle(200)).toBe('Grand Champion');
  });
  it('returns Grand Champion at 500 points', () => {
    expect(resolveTitle(500)).toBe('Grand Champion');
  });
});

describe('applyBreedingValueBoost (AC3 cap)', () => {
  it('adds 5% for 1st place (0 → 0.05)', () => {
    expect(applyBreedingValueBoost(0, 0.05)).toBeCloseTo(0.05);
  });
  it('caps at 0.15 when adding 5% to 0.14', () => {
    expect(applyBreedingValueBoost(0.14, 0.05)).toBeCloseTo(0.15);
  });
  it('stays at 0.15 when already capped and adding 5%', () => {
    expect(applyBreedingValueBoost(0.15, 0.05)).toBeCloseTo(0.15);
  });
  it('returns unchanged boost for 4th place (delta=0)', () => {
    expect(applyBreedingValueBoost(0.08, 0)).toBeCloseTo(0.08);
  });
  it('caps at 0.15 when overflow would exceed cap', () => {
    expect(applyBreedingValueBoost(0.13, 0.05)).toBeCloseTo(0.15);
  });
});

// ===========================================================================
// executeConformationShowHandler — real DB integration
// ===========================================================================

describe('executeConformationShowHandler (real DB)', () => {
  beforeAll(cleanupSuite);
  afterAll(cleanupSuite);
  afterEach(cleanupSuite);

  describe('AC1 — successful execution', () => {
    it('returns 200 with results array for a show with 2 entries', async () => {
      const user = await createUser();
      const horse1 = await createHorse(user.id);
      const horse2 = await createHorse(user.id);
      const groom = await createGroom(user.id);
      await createGroomAssignment(groom.id, horse1.id, user.id);
      await createGroomAssignment(groom.id, horse2.id, user.id);
      const show = await createConformationShow({ hostUserId: user.id });
      await createShowEntry(show.id, horse1.id, user.id);
      await createShowEntry(show.id, horse2.id, user.id);

      const req = buildReq({ user: { id: user.id }, body: { showId: show.id } });
      const res = buildRes();

      await executeConformationShowHandler(req, res);

      expect(res.statusValue).toBe(200);
      const body = res.jsonValue;
      expect(body.success).toBe(true);
      expect(body.data.showId).toBe(show.id);
      expect(Array.isArray(body.data.results)).toBe(true);
      expect(body.data.results.length).toBe(2);

      // 1st place must have placement=1 and Blue ribbon (deterministic by table).
      const first = body.data.results.find(r => r.placement === 1);
      expect(first).toBeDefined();
      expect(first.ribbon).toBe('Blue');
      expect(first.titlePoints).toBe(10);
      expect(first.breedingValueBoost).toBeCloseTo(0.05);

      // 2nd place must have placement=2 and Red ribbon.
      const second = body.data.results.find(r => r.placement === 2);
      expect(second).toBeDefined();
      expect(second.ribbon).toBe('Red');
      expect(second.titlePoints).toBe(7);
    });

    it('zero entries returns 200 with empty results array', async () => {
      const user = await createUser();
      const show = await createConformationShow({ hostUserId: user.id });

      const req = buildReq({ user: { id: user.id }, body: { showId: show.id } });
      const res = buildRes();

      await executeConformationShowHandler(req, res);

      expect(res.statusValue).toBe(200);
      const body = res.jsonValue;
      expect(body.success).toBe(true);
      expect(body.data.results).toEqual([]);
    });
  });

  describe('AC4 — no prize money in conformation', () => {
    it('results array entries do not include prizeWon', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const groom = await createGroom(user.id);
      await createGroomAssignment(groom.id, horse.id, user.id);
      const show = await createConformationShow({ hostUserId: user.id });
      await createShowEntry(show.id, horse.id, user.id);

      const req = buildReq({ user: { id: user.id }, body: { showId: show.id } });
      const res = buildRes();

      await executeConformationShowHandler(req, res);

      const results = res.jsonValue.data.results;
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).not.toHaveProperty('prizeWon');
    });
  });

  describe('Error handling', () => {
    it('returns 404 when show does not exist (CWE-639: indistinguishable from non-host)', async () => {
      const user = await createUser();
      const req = buildReq({ user: { id: user.id }, body: { showId: 999999999 } });
      const res = buildRes();

      await executeConformationShowHandler(req, res);

      expect(res.statusValue).toBe(404);
      expect(res.jsonValue.success).toBe(false);
      expect(res.jsonValue.message).toMatch(/not found/i);
    });

    it('returns 400 when show is not a conformation show', async () => {
      const user = await createUser();
      const show = await prisma.show.create({
        data: {
          name: `${SUITE_PREFIX}-ridden-${randomBytes(4).toString('hex')}`,
          discipline: 'Dressage',
          levelMin: 1,
          levelMax: 10,
          entryFee: 50,
          prize: 100,
          runDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          showType: 'ridden',
          status: 'open',
          hostUserId: user.id,
        },
      });

      const req = buildReq({ user: { id: user.id }, body: { showId: show.id } });
      const res = buildRes();

      await executeConformationShowHandler(req, res);

      expect(res.statusValue).toBe(400);
      expect(res.jsonValue.message).toMatch(/conformation/i);
    });
  });

  // -----------------------------------------------------------------------
  // Equoria-dmec — Host authorization (31F-3)
  // -----------------------------------------------------------------------
  // SECURITY GAP fix: previously any authenticated user could execute any
  // conformation show by sending its showId, awarding ribbons / titlePoints /
  // breedingValueBoost on horses they don't own. Now the controller scopes
  // the show lookup by hostUserId and returns 404 (CWE-639, matching the
  // ridden-competition /execute pattern). Sentinel-positive: non-host gets
  // 404 even though the show exists; the host gets 200 (covered above).
  // No state mutation must occur when the call is rejected.
  describe('AC — host authorization (Equoria-dmec, CWE-639)', () => {
    it('returns 404 when caller is not the show host (state must NOT mutate)', async () => {
      const host = await createUser();
      const attacker = await createUser();

      // Set up a real show with horses + entries owned by the host.
      const horse = await createHorse(host.id, {
        titlePoints: 0,
        currentTitle: null,
        breedingValueBoost: 0,
      });
      const groom = await createGroom(host.id);
      await createGroomAssignment(groom.id, horse.id, host.id);
      const show = await createConformationShow({ hostUserId: host.id });
      await createShowEntry(show.id, horse.id, host.id);

      // Snapshot pre-call state to verify nothing mutated.
      const horseBefore = await prisma.horse.findUnique({ where: { id: horse.id } });
      const resultsBefore = await prisma.competitionResult.count({ where: { showId: show.id } });

      // Attacker invokes /execute with the host's showId.
      const req = buildReq({ user: { id: attacker.id }, body: { showId: show.id } });
      const res = buildRes();

      await executeConformationShowHandler(req, res);

      // CWE-639: 404 indistinguishable from not-found.
      expect(res.statusValue).toBe(404);
      expect(res.jsonValue.success).toBe(false);
      expect(res.jsonValue.message).toMatch(/not found/i);

      // State must NOT have mutated.
      const horseAfter = await prisma.horse.findUnique({ where: { id: horse.id } });
      expect(horseAfter.titlePoints).toBe(horseBefore.titlePoints);
      expect(horseAfter.currentTitle).toBe(horseBefore.currentTitle);
      expect(horseAfter.breedingValueBoost).toBeCloseTo(horseBefore.breedingValueBoost ?? 0);

      const resultsAfter = await prisma.competitionResult.count({ where: { showId: show.id } });
      expect(resultsAfter).toBe(resultsBefore);

      // Show must remain 'open' — not flipped to 'completed'.
      const showAfter = await prisma.show.findUnique({ where: { id: show.id } });
      expect(showAfter.status).toBe('open');
    });

    it('returns 404 when show has no host (null hostUserId)', async () => {
      // Legacy shows or shows imported without a host owner cannot be
      // executed by anyone via this endpoint. Same 404 shape.
      const user = await createUser();
      const show = await createConformationShow(); // no hostUserId set

      const req = buildReq({ user: { id: user.id }, body: { showId: show.id } });
      const res = buildRes();

      await executeConformationShowHandler(req, res);

      expect(res.statusValue).toBe(404);
      expect(res.jsonValue.message).toMatch(/not found/i);
    });

    it('returns 200 when caller IS the show host (sentinel-positive — fix did not over-restrict)', async () => {
      const host = await createUser();
      const horse = await createHorse(host.id);
      const groom = await createGroom(host.id);
      await createGroomAssignment(groom.id, horse.id, host.id);
      const show = await createConformationShow({ hostUserId: host.id });
      await createShowEntry(show.id, horse.id, host.id);

      const req = buildReq({ user: { id: host.id }, body: { showId: show.id } });
      const res = buildRes();

      await executeConformationShowHandler(req, res);

      expect(res.statusValue).toBe(200);
      expect(res.jsonValue.success).toBe(true);
      expect(res.jsonValue.data.showId).toBe(show.id);
    });
  });
});

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
