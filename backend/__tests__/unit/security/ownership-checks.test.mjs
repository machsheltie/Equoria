/**
 * 🔒 INTEGRATION TESTS: Ownership Validation (real-DB)
 *
 * Tests for single-query ownership validation middleware. Exercises:
 *   - Owned resources allowed → req[resourceType] attached + next() called
 *   - Not-owned resources → 404 with ownership-disclosure-resistant message
 *   - Custom idParam routing
 *   - Resource-type → Prisma-model mapping (training-session → trainingLog,
 *     competition-entry → competitionResult, including the nested
 *     `horse.userId` ownerField path)
 *   - findOwnedResource / validateBatchOwnership helpers
 *
 * NO MOCKS. This file was rewritten on 2026-04-30 (Equoria-p6fx, the no-
 * mocks doctrine epic) from a jest.unstable_mockModule-based unit test
 * to a real-DB integration test against the equoria_test database. Per
 * CLAUDE.md "No mocks. Ever. All backend tests run against the real
 * test database. No mocked Prisma calls." A test that passes while the
 * production code is broken is worse than no test.
 *
 * Each test creates its own users + resources with collision-free
 * randomBytes(8).hex identifiers, validates the middleware behavior,
 * and cleans up its own rows in afterEach. No shared mutable state
 * across tests; suite-prefix scoped cleanup catches orphans from
 * crashed prior runs.
 *
 * @module __tests__/unit/security/ownership-checks
 */

import { describe, it, expect, afterEach, afterAll, beforeAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../db/index.mjs';
import { requireOwnership, findOwnedResource, validateBatchOwnership } from '../../../middleware/ownership.mjs';

const SUITE_PREFIX = 'ochk';

// Fresh per-test response/next harness — scoped inside `describe` so each
// `it` gets a clean trio without cross-test mutation.
function makeReqRes(user) {
  let nextCalledWith;
  let nextCallCount = 0;
  let statusValue;
  let jsonValue;

  return {
    req: {
      user,
      params: {},
      validatedResources: undefined,
    },
    res: {
      status(code) {
        statusValue = code;
        return this;
      },
      json(body) {
        jsonValue = body;
        return this;
      },
      get statusValue() {
        return statusValue;
      },
      get jsonValue() {
        return jsonValue;
      },
    },
    next(arg) {
      nextCallCount += 1;
      nextCalledWith = arg;
    },
    nextWasCalled() {
      return nextCallCount > 0;
    },
    nextWasCalledWithoutError() {
      return nextCallCount > 0 && nextCalledWith === undefined;
    },
  };
}

// Test-fixture helpers. Each creates a real DB row and returns it.
// IDs use randomBytes for collision-free uniqueness across parallel
// workers (per Equoria-3gti — Date.now()+Math.random() collisions
// were the prior flake source).

async function createUser() {
  const uid = randomBytes(8).toString('hex');
  return prisma.user.create({
    data: {
      id: `${SUITE_PREFIX}-${uid}`,
      username: `${SUITE_PREFIX}_${uid}`,
      email: `${SUITE_PREFIX}-${uid}@example.com`,
      firstName: 'Ownership',
      lastName: 'Test',
      password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyGJ4lxPcxqy',
      emailVerified: true,
    },
  });
}

async function createHorse(userId, overrides = {}) {
  return prisma.horse.create({
    data: {
      name: overrides.name ?? `${SUITE_PREFIX}-horse-${randomBytes(4).toString('hex')}`,
      sex: overrides.sex ?? 'Mare',
      dateOfBirth: overrides.dateOfBirth ?? new Date('2020-01-01'),
      user: { connect: { id: userId } },
    },
  });
}

async function createGroom(userId, overrides = {}) {
  return prisma.groom.create({
    data: {
      name: overrides.name ?? `${SUITE_PREFIX}-groom-${randomBytes(4).toString('hex')}`,
      speciality: overrides.speciality ?? 'foal_care',
      personality: overrides.personality ?? 'gentle',
      user: { connect: { id: userId } },
    },
  });
}

async function createTrainingLog(horseId) {
  return prisma.trainingLog.create({
    data: {
      discipline: 'Dressage',
      horse: { connect: { id: horseId } },
    },
  });
}

async function createCompetitionResult(horseId, showId) {
  return prisma.competitionResult.create({
    data: {
      score: 75.5,
      placement: '3rd',
      discipline: 'Dressage',
      runDate: new Date(),
      showName: `${SUITE_PREFIX}-show-${randomBytes(4).toString('hex')}`,
      horse: { connect: { id: horseId } },
      show: { connect: { id: showId } },
    },
  });
}

async function createShow() {
  return prisma.show.create({
    data: {
      name: `${SUITE_PREFIX}-show-${randomBytes(4).toString('hex')}`,
      discipline: 'Dressage',
      levelMin: 1,
      levelMax: 10,
      entryFee: 50,
      prize: 200,
      runDate: new Date(),
    },
  });
}

// Suite-scoped cleanup: deletes everything this suite created that's
// reachable via the SUITE_PREFIX. Cascade handles child rows where
// the schema declares onDelete: Cascade; explicit deletes elsewhere.
async function cleanupSuite() {
  // Find users by suite prefix; cascade through training/competition
  // via horse FKs.
  const users = await prisma.user.findMany({
    where: { id: { startsWith: SUITE_PREFIX } },
    select: { id: true },
  });
  if (users.length === 0) {
    return;
  }
  const userIds = users.map(u => u.id);
  // Find horses owned by these users for cascade-cleanup of dependents.
  const horses = await prisma.horse.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const horseIds = horses.map(h => h.id);
  if (horseIds.length > 0) {
    await prisma.trainingLog.deleteMany({ where: { horseId: { in: horseIds } } });
    await prisma.competitionResult.deleteMany({ where: { horseId: { in: horseIds } } });
  }
  await prisma.show.deleteMany({ where: { name: { startsWith: SUITE_PREFIX } } });
  await prisma.horse.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.groom.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

describe('Ownership Validation Integration Tests (real DB)', () => {
  beforeAll(cleanupSuite);
  afterAll(cleanupSuite);
  // Per-test cleanup is also done so a mid-suite failure doesn't leak
  // into the next test's row counts. afterEach handles the routine
  // happy-path; afterAll/beforeAll handle crash-recovery.
  afterEach(cleanupSuite);

  describe('Owned Resource Scenarios', () => {
    it('should allow access to owned horse', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const harness = makeReqRes({ id: user.id });
      harness.req.params.id = String(horse.id);

      await requireOwnership('horse')(harness.req, harness.res, harness.next);

      expect(harness.nextWasCalledWithoutError()).toBe(true);
      expect(harness.req.horse).toMatchObject({ id: horse.id, userId: user.id });
      expect(harness.res.statusValue).toBeUndefined(); // never sent an error response
    });

    it('should allow access to owned groom', async () => {
      const user = await createUser();
      const groom = await createGroom(user.id);
      const harness = makeReqRes({ id: user.id });
      harness.req.params.id = String(groom.id);

      await requireOwnership('groom')(harness.req, harness.res, harness.next);

      expect(harness.nextWasCalledWithoutError()).toBe(true);
      expect(harness.req.groom).toMatchObject({ id: groom.id, userId: user.id });
    });

    it('should attach resource to req[type] AND req.validatedResources', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id, { name: 'AttachTest' });
      const harness = makeReqRes({ id: user.id });
      harness.req.params.id = String(horse.id);

      await requireOwnership('horse')(harness.req, harness.res, harness.next);

      expect(harness.req.horse).toBeDefined();
      expect(harness.req.horse.name).toBe('AttachTest');
      expect(harness.req.validatedResources).toBeDefined();
      expect(harness.req.validatedResources.horse).toMatchObject({ id: horse.id });
    });

    it('should accept a custom idParam', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const harness = makeReqRes({ id: user.id });
      harness.req.params.horseId = String(horse.id);

      await requireOwnership('horse', { idParam: 'horseId' })(harness.req, harness.res, harness.next);

      expect(harness.nextWasCalledWithoutError()).toBe(true);
      expect(harness.req.horse.id).toBe(horse.id);
    });
  });

  describe('Not-Owned Resource Scenarios', () => {
    it('should return 404 for horse owned by a different user', async () => {
      const owner = await createUser();
      const otherUser = await createUser();
      const horse = await createHorse(owner.id);
      const harness = makeReqRes({ id: otherUser.id });
      harness.req.params.id = String(horse.id);

      await requireOwnership('horse')(harness.req, harness.res, harness.next);

      expect(harness.nextWasCalled()).toBe(false);
      expect(harness.res.statusValue).toBe(404);
      expect(harness.res.jsonValue).toMatchObject({
        success: false,
        message: 'Horse not found',
      });
    });

    it('should return 404 for groom owned by a different user', async () => {
      const owner = await createUser();
      const otherUser = await createUser();
      const groom = await createGroom(owner.id);
      const harness = makeReqRes({ id: otherUser.id });
      harness.req.params.id = String(groom.id);

      await requireOwnership('groom')(harness.req, harness.res, harness.next);

      expect(harness.res.statusValue).toBe(404);
      expect(harness.res.jsonValue).toMatchObject({
        success: false,
        message: 'Groom not found',
      });
    });

    it('should return 404 for non-existent horse ID (no ownership disclosure)', async () => {
      const user = await createUser();
      const harness = makeReqRes({ id: user.id });
      harness.req.params.id = '999999999';

      await requireOwnership('horse')(harness.req, harness.res, harness.next);

      expect(harness.res.statusValue).toBe(404);
      expect(harness.res.jsonValue).toMatchObject({
        success: false,
        message: 'Horse not found',
      });
    });
  });

  describe('Resource Type Mapping (nested ownerField paths)', () => {
    it('should resolve training-session via trainingLog with horse.userId path', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const log = await createTrainingLog(horse.id);
      const harness = makeReqRes({ id: user.id });
      harness.req.params.id = String(log.id);

      await requireOwnership('training-session')(harness.req, harness.res, harness.next);

      expect(harness.nextWasCalledWithoutError()).toBe(true);
      expect(harness.req['training-session']).toMatchObject({ id: log.id });
    });

    it('should reject training-session for non-owner via horse.userId path', async () => {
      const owner = await createUser();
      const otherUser = await createUser();
      const horse = await createHorse(owner.id);
      const log = await createTrainingLog(horse.id);
      const harness = makeReqRes({ id: otherUser.id });
      harness.req.params.id = String(log.id);

      await requireOwnership('training-session')(harness.req, harness.res, harness.next);

      expect(harness.res.statusValue).toBe(404);
    });

    it('should resolve competition-entry via competitionResult with horse.userId path', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const show = await createShow();
      const result = await createCompetitionResult(horse.id, show.id);
      const harness = makeReqRes({ id: user.id });
      harness.req.params.id = String(result.id);

      await requireOwnership('competition-entry')(harness.req, harness.res, harness.next);

      expect(harness.nextWasCalledWithoutError()).toBe(true);
      expect(harness.req['competition-entry']).toMatchObject({ id: result.id });
    });
  });

  describe('Authentication & Input-Validation Errors', () => {
    it('should reject when req.user is missing (401)', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const harness = makeReqRes(undefined);
      harness.req.params.id = String(horse.id);

      await requireOwnership('horse')(harness.req, harness.res, harness.next);

      expect(harness.res.statusValue).toBe(401);
      expect(harness.res.jsonValue).toMatchObject({
        success: false,
        message: 'Authentication required',
      });
    });

    it('should reject non-numeric resource IDs (400)', async () => {
      const user = await createUser();
      const harness = makeReqRes({ id: user.id });
      harness.req.params.id = 'not-a-number';

      await requireOwnership('horse')(harness.req, harness.res, harness.next);

      expect(harness.res.statusValue).toBe(400);
      expect(harness.res.jsonValue).toMatchObject({
        success: false,
        message: 'Invalid horse ID',
      });
    });
  });

  describe('findOwnedResource Helper Function', () => {
    it('should find owned horse', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);

      const result = await findOwnedResource('horse', horse.id, user.id);

      expect(result).toMatchObject({ id: horse.id, userId: user.id });
    });

    it('should return null for not-owned horse', async () => {
      const owner = await createUser();
      const otherUser = await createUser();
      const horse = await createHorse(owner.id);

      const result = await findOwnedResource('horse', horse.id, otherUser.id);

      expect(result).toBeNull();
    });

    it('should find owned groom', async () => {
      const user = await createUser();
      const groom = await createGroom(user.id);

      const result = await findOwnedResource('groom', groom.id, user.id);

      expect(result).toMatchObject({ id: groom.id, userId: user.id });
    });
  });

  describe('validateBatchOwnership Helper Function', () => {
    it('should return all owned horses from a batch', async () => {
      const user = await createUser();
      const h1 = await createHorse(user.id);
      const h2 = await createHorse(user.id);

      const result = await validateBatchOwnership('horse', [h1.id, h2.id], user.id);

      expect(result).toHaveLength(2);
      const ids = result.map(r => r.id).sort((a, b) => a - b);
      expect(ids).toEqual([h1.id, h2.id].sort((a, b) => a - b));
    });

    it('should exclude horses owned by other users from the batch', async () => {
      const owner = await createUser();
      const otherUser = await createUser();
      const ownedHorse = await createHorse(owner.id);
      const otherHorse = await createHorse(otherUser.id);

      const result = await validateBatchOwnership('horse', [ownedHorse.id, otherHorse.id], owner.id);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(ownedHorse.id);
    });

    it('should return empty array when caller owns none of the requested IDs', async () => {
      const owner = await createUser();
      const otherUser = await createUser();
      const horse = await createHorse(owner.id);

      const result = await validateBatchOwnership('horse', [horse.id], otherUser.id);

      expect(result).toEqual([]);
    });
  });
});
