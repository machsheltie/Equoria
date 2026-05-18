/**
 * 🔒 INTEGRATION TESTS: Ownership Middleware — resource-type mapping coverage
 *
 * NO MOCKS. Rewritten 2026-04-30 (Equoria-p6fx, no-mocks doctrine epic)
 * from a jest.unstable_mockModule-based unit test to a real-DB
 * integration test.
 *
 * SECURITY: CWE-639 (Authorization Bypass Through User-Controlled Key)
 * SECURITY: TOCTOU (Time-of-Check-Time-of-Use) vulnerability prevention
 *
 * SCOPE NOTE: the broader behavior surface of requireOwnership /
 * findOwnedResource / validateBatchOwnership is exercised by
 * __tests__/unit/security/ownership-checks.test.mjs. This file focuses
 * on the cases that file does NOT cover:
 *   - foal resource type mapping (→ horse model with userId field)
 *   - breeding resource type mapping (→ horse model)
 *   - groom-assignment resource type mapping (→ groomAssignment model)
 *   - user.id === null (vs req.user === undefined) authentication edge
 *   - the ownership-disclosure-resistant 404 contract (CWE-639)
 *   - the user-id-from-token-not-params security contract (token ID
 *     wins over any ID in req.params; defends against `?userId=victim`
 *     parameter pollution)
 *
 * REMOVED: the prior "should handle database errors gracefully" test
 * mocked prisma.horse.findFirst to reject. Per the no-mocks doctrine,
 * fault injection of internal Prisma calls is not a permitted pattern.
 * The middleware's catch block IS still exercised in production by real
 * DB failures (connection drops, schema mismatches), and is observable
 * via real logs / sentry — that observability is the testable surface,
 * not synthetic Prisma rejections.
 *
 * @module __tests__/middleware/ownership
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../db/index.mjs';
import { requireOwnership } from '../../../middleware/ownership.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

const SUITE_PREFIX = 'mwown';

function makeReqRes(user) {
  let statusValue;
  let jsonValue;
  let nextCallCount = 0;
  let nextCalledWith;
  return {
    req: { user, params: {}, body: {}, validatedResources: undefined },
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
    nextCallCount() {
      return nextCallCount;
    },
    nextArg() {
      return nextCalledWith;
    },
  };
}

async function createUser() {
  const uid = randomBytes(8).toString('hex');
  return prisma.user.create({
    data: {
      id: `${SUITE_PREFIX}-${uid}`,
      username: `${SUITE_PREFIX}_${uid}`,
      email: `${SUITE_PREFIX}-${uid}@example.com`,
      firstName: 'Mw',
      lastName: 'Own',
      password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyGJ4lxPcxqy',
      emailVerified: true,
    },
  });
}

async function createHorse(userId) {
  return prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${SUITE_PREFIX}-horse-${randomBytes(4).toString('hex')}`,
      sex: 'Mare',
      dateOfBirth: new Date('2020-01-01'),
      user: { connect: { id: userId } },
    },
  });
}

async function createGroom(userId) {
  return prisma.groom.create({
    data: {
      name: `${SUITE_PREFIX}-groom-${randomBytes(4).toString('hex')}`,
      speciality: 'foal_care',
      personality: 'gentle',
      user: { connect: { id: userId } },
    },
  });
}

async function createGroomAssignment(groomId, horseId, userId) {
  return prisma.groomAssignment.create({
    data: {
      groom: { connect: { id: groomId } },
      foal: { connect: { id: horseId } },
      user: { connect: { id: userId } },
      isActive: true,
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
    await prisma.trainingLog.deleteMany({ where: { horseId: { in: horseIds } } });
    await prisma.competitionResult.deleteMany({ where: { horseId: { in: horseIds } } });
  }
  await prisma.horse.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.groom.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

describe('Ownership Middleware (real DB)', () => {
  beforeAll(cleanupSuite);
  afterAll(cleanupSuite);
  afterEach(cleanupSuite);

  describe('Authentication edge: user.id is null', () => {
    it('should return 401 when req.user.id is explicitly null (vs req.user being undefined)', async () => {
      const harness = makeReqRes({ id: null });
      harness.req.params.id = '1';

      await requireOwnership('horse')(harness.req, harness.res, harness.next);

      expect(harness.res.statusValue).toBe(401);
      expect(harness.res.jsonValue).toMatchObject({
        success: false,
        message: 'Authentication required',
      });
      expect(harness.nextCallCount()).toBe(0);
    });
  });

  describe('Resource type mapping: foal → horse model', () => {
    it('should resolve foal resource type via the horse table', async () => {
      const user = await createUser();
      const foal = await createHorse(user.id); // foal == horse in schema, mapping is at middleware layer
      const harness = makeReqRes({ id: user.id });
      harness.req.params.id = String(foal.id);

      await requireOwnership('foal')(harness.req, harness.res, harness.next);

      expect(harness.nextArg()).toBeUndefined();
      expect(harness.req.foal).toMatchObject({ id: foal.id, userId: user.id });
    });

    it('should reject foal access for non-owner', async () => {
      const owner = await createUser();
      const otherUser = await createUser();
      const foal = await createHorse(owner.id);
      const harness = makeReqRes({ id: otherUser.id });
      harness.req.params.id = String(foal.id);

      await requireOwnership('foal')(harness.req, harness.res, harness.next);

      expect(harness.res.statusValue).toBe(404);
    });
  });

  describe('Resource type mapping: breeding → horse model', () => {
    it('should resolve breeding resource type via the horse table', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const harness = makeReqRes({ id: user.id });
      harness.req.params.id = String(horse.id);

      await requireOwnership('breeding')(harness.req, harness.res, harness.next);

      expect(harness.nextArg()).toBeUndefined();
      expect(harness.req.breeding).toMatchObject({ id: horse.id, userId: user.id });
    });
  });

  describe('Resource type mapping: groom-assignment → groomAssignment model', () => {
    it('should resolve groom-assignment resource type via the groomAssignment table', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const groom = await createGroom(user.id);
      const assignment = await createGroomAssignment(groom.id, horse.id, user.id);
      const harness = makeReqRes({ id: user.id });
      harness.req.params.id = String(assignment.id);

      await requireOwnership('groom-assignment')(harness.req, harness.res, harness.next);

      expect(harness.nextArg()).toBeUndefined();
      expect(harness.req['groom-assignment']).toMatchObject({ id: assignment.id, userId: user.id });
    });

    it('should reject groom-assignment access for non-owner', async () => {
      const owner = await createUser();
      const otherUser = await createUser();
      const horse = await createHorse(owner.id);
      const groom = await createGroom(owner.id);
      const assignment = await createGroomAssignment(groom.id, horse.id, owner.id);
      const harness = makeReqRes({ id: otherUser.id });
      harness.req.params.id = String(assignment.id);

      await requireOwnership('groom-assignment')(harness.req, harness.res, harness.next);

      expect(harness.res.statusValue).toBe(404);
    });
  });

  describe('Security: CWE-639 ownership-disclosure resistance', () => {
    it('should return identical 404 envelope for not-found vs not-owned (no disclosure of which case applies)', async () => {
      const user = await createUser();
      const owner = await createUser();
      const ownedByOther = await createHorse(owner.id);

      // Case 1: ID does not exist at all.
      const h1 = makeReqRes({ id: user.id });
      h1.req.params.id = '999999999';
      await requireOwnership('horse')(h1.req, h1.res, h1.next);
      const responseNotFound = { status: h1.res.statusValue, body: h1.res.jsonValue };

      // Case 2: ID exists but is owned by someone else.
      const h2 = makeReqRes({ id: user.id });
      h2.req.params.id = String(ownedByOther.id);
      await requireOwnership('horse')(h2.req, h2.res, h2.next);
      const responseNotOwned = { status: h2.res.statusValue, body: h2.res.jsonValue };

      // The two responses must be byte-identical so an attacker cannot
      // distinguish "this ID exists but isn't yours" from "this ID does
      // not exist at all" — that distinction would let them enumerate
      // valid horse IDs.
      expect(responseNotFound).toEqual(responseNotOwned);
      expect(responseNotFound.status).toBe(404);
    });
  });

  describe('from: body — reads resource ID from req.body instead of req.params', () => {
    it('should attach req.horse and req.validatedResources.horse and call next when ID is in body and user owns the resource', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const harness = makeReqRes({ id: user.id });
      harness.req.body = { horseId: String(horse.id) };

      await requireOwnership('horse', { idParam: 'horseId', from: 'body' })(harness.req, harness.res, harness.next);

      expect(harness.nextArg()).toBeUndefined();
      expect(harness.req.horse).toMatchObject({ id: horse.id, userId: user.id });
      expect(harness.req.validatedResources).toMatchObject({ horse: { id: horse.id, userId: user.id } });
      expect(harness.nextCallCount()).toBe(1);
    });

    it('should handle a native integer body value (JSON-parsed number, not string)', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const harness = makeReqRes({ id: user.id });
      // express.json() parses {"horseId":42} as number, not string — this branch
      // requires the typeof rawId === 'number' path in isNumericId.
      harness.req.body = { horseId: horse.id };

      await requireOwnership('horse', { idParam: 'horseId', from: 'body' })(harness.req, harness.res, harness.next);

      expect(harness.nextArg()).toBeUndefined();
      expect(harness.req.horse).toMatchObject({ id: horse.id, userId: user.id });
      expect(harness.nextCallCount()).toBe(1);
    });

    it('should return 400 when the body field is absent', async () => {
      const user = await createUser();
      const harness = makeReqRes({ id: user.id });
      harness.req.body = {};

      await requireOwnership('horse', { idParam: 'horseId', from: 'body' })(harness.req, harness.res, harness.next);

      expect(harness.res.statusValue).toBe(400);
      expect(harness.nextCallCount()).toBe(0);
    });

    it('should return 400 when the body field is non-numeric', async () => {
      const user = await createUser();
      const harness = makeReqRes({ id: user.id });
      harness.req.body = { horseId: 'not-a-number' };

      await requireOwnership('horse', { idParam: 'horseId', from: 'body' })(harness.req, harness.res, harness.next);

      expect(harness.res.statusValue).toBe(400);
      expect(harness.nextCallCount()).toBe(0);
    });

    it('should return 404 when the resource is not owned by the authenticated user (CWE-639 safe)', async () => {
      const owner = await createUser();
      const attacker = await createUser();
      const horse = await createHorse(owner.id);
      const harness = makeReqRes({ id: attacker.id });
      harness.req.body = { horseId: String(horse.id) };

      await requireOwnership('horse', { idParam: 'horseId', from: 'body' })(harness.req, harness.res, harness.next);

      expect(harness.res.statusValue).toBe(404);
      expect(harness.nextCallCount()).toBe(0);
    });

    it('should still read from req.params when from is not specified (default unchanged)', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const harness = makeReqRes({ id: user.id });
      harness.req.params.id = String(horse.id);

      await requireOwnership('horse')(harness.req, harness.res, harness.next);

      expect(harness.nextArg()).toBeUndefined();
      expect(harness.req.horse).toMatchObject({ id: horse.id, userId: user.id });
    });

    it('should return 400 for oversized integer body value (> PostgreSQL int4 max) without reaching Prisma', async () => {
      const user = await createUser();
      const harness = makeReqRes({ id: user.id });
      // 2,147,483,648 = int4 max + 1 — would cause Prisma runtime error if it reached the DB
      harness.req.body = { horseId: 2_147_483_648 };

      await requireOwnership('horse', { idParam: 'horseId', from: 'body' })(harness.req, harness.res, harness.next);

      expect(harness.res.statusValue).toBe(400);
      expect(harness.nextCallCount()).toBe(0);
    });

    it('should return 400 for oversized integer string param value (> PostgreSQL int4 max) without reaching Prisma', async () => {
      const user = await createUser();
      const harness = makeReqRes({ id: user.id });
      harness.req.params.id = '2147483648';

      await requireOwnership('horse')(harness.req, harness.res, harness.next);

      expect(harness.res.statusValue).toBe(400);
      expect(harness.nextCallCount()).toBe(0);
    });
  });

  describe('Security: token-derived user ID wins over req.params.userId', () => {
    it('should ignore req.params.userId and use req.user.id from the token', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);

      // Attacker scenario: the URL has ?userId=<victim> in params, but
      // the authenticated session is `user`. The middleware must use
      // req.user.id (token-derived), NOT req.params.userId (attacker-
      // controlled). If the middleware were buggy and used params,
      // this assertion would fail because 'attacker-victim-id' doesn't
      // own the horse.
      const harness = makeReqRes({ id: user.id });
      harness.req.params.id = String(horse.id);
      harness.req.params.userId = 'attacker-victim-id';

      await requireOwnership('horse')(harness.req, harness.res, harness.next);

      expect(harness.nextArg()).toBeUndefined();
      expect(harness.req.horse).toMatchObject({ id: horse.id, userId: user.id });
    });
  });
});
