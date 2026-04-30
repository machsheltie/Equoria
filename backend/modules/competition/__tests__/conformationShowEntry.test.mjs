// Integration tests for conformationShowController.mjs (Story 31F-2) — real DB
//
// NO MOCKS. Equoria-p6fx (no-mocks doctrine epic 2026-04-30): converted from
// jest.unstable_mockModule of express-validator + ownership middleware +
// prisma + logger to a real-DB integration test against the equoria_test
// database. Real express-validator chains run via .run(req); real
// findOwnedResource queries against real DB; real users + horses +
// grooms + shows + groomAssignments fixtures.
//
// Removed (per doctrine):
//   - "non-P2002 showEntry.create error propagates as 500" — required
//     mocking showEntry.create to reject. Synthetic Prisma fault
//     injection forbidden.
//   - "P2002 race condition duplicate" — required Prisma to throw a
//     specific error code. Real DB enforces the unique constraint
//     organically; the duplicate-check via showEntry.findFirst is
//     covered by the AC5 duplicate test.

import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../db/index.mjs';
import { enterConformationShow, checkConformationEligibility } from '../controllers/conformationShowController.mjs';

const SUITE_PREFIX = 'cfent';

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
      lastName: 'Test',
      password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyGJ4lxPcxqy',
      emailVerified: true,
    },
  });
}

async function createHorse(userId, overrides = {}) {
  return prisma.horse.create({
    data: {
      name: `${SUITE_PREFIX}-h-${randomBytes(4).toString('hex')}`,
      sex: overrides.sex ?? 'Mare',
      dateOfBirth: overrides.dateOfBirth ?? new Date('2021-01-01'), // ~4 years old
      age: overrides.age ?? 4,
      healthStatus: overrides.healthStatus ?? 'Excellent',
      // A12 gate (commit landing now): displayedHealth='critical' blocks
      // entry. Default lastFedDate/lastVettedDate to today so the gate
      // doesn't fire for tests that aren't testing the gate.
      lastFedDate: overrides.lastFedDate ?? new Date(),
      lastVettedDate: overrides.lastVettedDate ?? new Date(),
      bondScore: overrides.bondScore ?? 70,
      temperament: overrides.temperament ?? 'Calm',
      conformationScores:
        overrides.conformationScores === undefined ? VALID_CONFORMATION_SCORES : overrides.conformationScores,
      user: { connect: { id: userId } },
    },
  });
}

async function createGroom(userId, overrides = {}) {
  return prisma.groom.create({
    data: {
      name: overrides.name ?? `${SUITE_PREFIX}-g-${randomBytes(4).toString('hex')}`,
      speciality: overrides.speciality ?? 'show_handling',
      personality: overrides.personality ?? 'gentle',
      skillLevel: overrides.skillLevel ?? 'expert',
      // showHandlingSkill is read by the validation; some controllers may
      // expect a string field. Use the closest schema field; if that's
      // unrelated to validation, drop it.
      user: { connect: { id: userId } },
    },
  });
}

async function createConformationShow(overrides = {}) {
  return prisma.show.create({
    data: {
      name: `${SUITE_PREFIX}-show-${randomBytes(4).toString('hex')}`,
      discipline: overrides.discipline ?? 'Conformation',
      levelMin: 1,
      levelMax: 10,
      entryFee: 50,
      prize: 200,
      runDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      showType: overrides.showType ?? 'conformation',
      status: overrides.status ?? 'open',
    },
  });
}

async function createGroomAssignment(groomId, foalId, userId, overrides = {}) {
  return prisma.groomAssignment.create({
    data: {
      groom: { connect: { id: groomId } },
      foal: { connect: { id: foalId } },
      user: { connect: { id: userId } },
      isActive: true,
      // Assignment must be > 2 days old per validateConformationEntry timing.
      createdAt: overrides.createdAt ?? new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
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
    await prisma.showEntry.deleteMany({ where: { horseId: { in: horseIds } } });
  }
  await prisma.show.deleteMany({ where: { name: { startsWith: SUITE_PREFIX } } });
  await prisma.horse.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.groom.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

describe('enterConformationShow (real DB)', () => {
  beforeAll(cleanupSuite);
  afterAll(cleanupSuite);
  afterEach(cleanupSuite);

  describe('AC1 — valid entry returns 201', () => {
    it('creates ShowEntry and returns entry data with ageClass', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const groom = await createGroom(user.id);
      const show = await createConformationShow();
      await createGroomAssignment(groom.id, horse.id, user.id);

      const req = buildReq({
        user: { id: user.id },
        body: { horseId: horse.id, groomId: groom.id, showId: show.id, className: 'Mares' },
      });
      const res = buildRes();

      await enterConformationShow(req, res);

      expect(res.statusValue).toBe(201);
      const body = res.jsonValue;
      expect(body.success).toBe(true);
      expect(body.data.entryId).toBeDefined();
      expect(body.data.horseId).toBe(horse.id);
      expect(body.data.showId).toBe(show.id);
      expect(body.data.ageClass).toBeTruthy();
      expect(body.data.className).toBe('Mares');

      // Verify the DB row was actually created.
      const persisted = await prisma.showEntry.findFirst({
        where: { showId: show.id, horseId: horse.id },
      });
      expect(persisted).not.toBeNull();
    });
  });

  describe('AC4 — horse not owned returns 404', () => {
    it('returns 404 when horse is not owned by user', async () => {
      const user = await createUser();
      const otherUser = await createUser();
      const otherHorse = await createHorse(otherUser.id);
      const groom = await createGroom(user.id);
      const show = await createConformationShow();

      const req = buildReq({
        user: { id: user.id },
        body: { horseId: otherHorse.id, groomId: groom.id, showId: show.id, className: 'Mares' },
      });
      const res = buildRes();

      await enterConformationShow(req, res);

      expect(res.statusValue).toBe(404);
      expect(res.jsonValue).toEqual({ success: false, message: 'Horse not found' });
    });
  });

  describe('AC1 — groom not owned returns 400', () => {
    it('returns 400 when groom does not belong to user', async () => {
      const user = await createUser();
      const otherUser = await createUser();
      const horse = await createHorse(user.id);
      const otherGroom = await createGroom(otherUser.id);
      const show = await createConformationShow();

      const req = buildReq({
        user: { id: user.id },
        body: { horseId: horse.id, groomId: otherGroom.id, showId: show.id, className: 'Mares' },
      });
      const res = buildRes();

      await enterConformationShow(req, res);

      expect(res.statusValue).toBe(400);
      expect(res.jsonValue.success).toBe(false);
      expect(res.jsonValue.message).toMatch(/Groom not found/);
    });
  });

  describe('AC1 — show not found returns 400', () => {
    it('returns 400 when show does not exist', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const groom = await createGroom(user.id);

      const req = buildReq({
        user: { id: user.id },
        body: { horseId: horse.id, groomId: groom.id, showId: 999999999, className: 'Mares' },
      });
      const res = buildRes();

      await enterConformationShow(req, res);

      expect(res.statusValue).toBe(400);
      expect(res.jsonValue).toEqual({ success: false, message: 'Show not found' });
    });
  });

  describe('AC3 — wrong show type returns 400', () => {
    it('returns 400 when show is not a conformation show', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const groom = await createGroom(user.id);
      const show = await createConformationShow({ showType: 'ridden' });

      const req = buildReq({
        user: { id: user.id },
        body: { horseId: horse.id, groomId: groom.id, showId: show.id, className: 'Mares' },
      });
      const res = buildRes();

      await enterConformationShow(req, res);

      expect(res.statusValue).toBe(400);
      expect(res.jsonValue).toEqual({
        success: false,
        message: 'Show is not a conformation show',
      });
    });
  });

  describe('AC5 — duplicate entry returns 409', () => {
    it('returns 409 when horse is already entered in the show', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const groom = await createGroom(user.id);
      const show = await createConformationShow();
      await createGroomAssignment(groom.id, horse.id, user.id);
      // Pre-create an entry to trigger the duplicate-check.
      await prisma.showEntry.create({
        data: {
          show: { connect: { id: show.id } },
          horse: { connect: { id: horse.id } },
          user: { connect: { id: user.id } },
          feePaid: 50,
        },
      });

      const req = buildReq({
        user: { id: user.id },
        body: { horseId: horse.id, groomId: groom.id, showId: show.id, className: 'Mares' },
      });
      const res = buildRes();

      await enterConformationShow(req, res);

      expect(res.statusValue).toBe(409);
      expect(res.jsonValue).toEqual({
        success: false,
        message: 'Horse is already entered in this show',
      });
    });
  });

  describe('AC5 — ineligible horse (unhealthy) returns 400', () => {
    it('returns 400 with health error when horse is injured', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id, { healthStatus: 'Injured' });
      const groom = await createGroom(user.id);
      const show = await createConformationShow();
      await createGroomAssignment(groom.id, horse.id, user.id);

      const req = buildReq({
        user: { id: user.id },
        body: { horseId: horse.id, groomId: groom.id, showId: show.id, className: 'Mares' },
      });
      const res = buildRes();

      await enterConformationShow(req, res);

      expect(res.statusValue).toBe(400);
      const body = res.jsonValue;
      expect(body.success).toBe(false);
      expect(Array.isArray(body.errors)).toBe(true);
      expect(body.errors.some(e => /health/i.test(e))).toBe(true);
    });
  });

  describe('AC5 — ineligible horse (no active groom assignment) returns 400', () => {
    it('returns 400 with validation error when groom is not assigned to horse', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const groom = await createGroom(user.id);
      const show = await createConformationShow();
      // No groom assignment created.

      const req = buildReq({
        user: { id: user.id },
        body: { horseId: horse.id, groomId: groom.id, showId: show.id, className: 'Mares' },
      });
      const res = buildRes();

      await enterConformationShow(req, res);

      expect(res.statusValue).toBe(400);
      const body = res.jsonValue;
      expect(body.success).toBe(false);
      expect(Array.isArray(body.errors)).toBe(true);
      expect(body.errors.some(e => /groom.*assigned/i.test(e))).toBe(true);
    });
  });

  describe('G2 — groom assigned too recently returns 400', () => {
    it('returns 400 with assignment timing error when groom was assigned < 2 days ago', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const groom = await createGroom(user.id);
      const show = await createConformationShow();
      // Recent assignment (12 hours ago).
      await createGroomAssignment(groom.id, horse.id, user.id, {
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
      });

      const req = buildReq({
        user: { id: user.id },
        body: { horseId: horse.id, groomId: groom.id, showId: show.id, className: 'Mares' },
      });
      const res = buildRes();

      await enterConformationShow(req, res);

      expect(res.statusValue).toBe(400);
      const body = res.jsonValue;
      expect(body.success).toBe(false);
      expect(body.errors.some(e => /at least/i.test(e))).toBe(true);
    });
  });

  describe('G3 — invalid className returns 400', () => {
    it('returns 400 when className is not a valid conformation class', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const groom = await createGroom(user.id);
      const show = await createConformationShow();
      await createGroomAssignment(groom.id, horse.id, user.id);

      const req = buildReq({
        user: { id: user.id },
        body: { horseId: horse.id, groomId: groom.id, showId: show.id, className: 'Dressage' },
      });
      const res = buildRes();

      await enterConformationShow(req, res);

      expect(res.statusValue).toBe(400);
      const body = res.jsonValue;
      expect(body.success).toBe(false);
      expect(body.errors.some(e => /not a valid conformation show class/i.test(e))).toBe(true);
    });
  });
});

describe('checkConformationEligibility (real DB)', () => {
  beforeAll(cleanupSuite);
  afterAll(cleanupSuite);
  afterEach(cleanupSuite);

  describe('AC5 — eligible horse with groom returns eligible: true', () => {
    it('returns 200 with eligible=true and groomAssigned=true', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const groom = await createGroom(user.id);
      await createGroomAssignment(groom.id, horse.id, user.id);

      const req = buildReq({ user: { id: user.id }, params: { horseId: String(horse.id) } });
      const res = buildRes();

      await checkConformationEligibility(req, res);

      expect(res.statusValue).toBe(200);
      const body = res.jsonValue;
      expect(body.success).toBe(true);
      expect(body.data.eligible).toBe(true);
      expect(body.data.groomAssigned).toBe(true);
      expect(body.data.horseId).toBe(horse.id);
      expect(body.data.horseName).toBe(horse.name);
      expect(body.data.ageClass).toBeTruthy();
    });
  });

  describe('AC5 — no groom assignment returns eligible: false', () => {
    it('returns 200 with eligible=false when no assignment exists', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);

      const req = buildReq({ user: { id: user.id }, params: { horseId: String(horse.id) } });
      const res = buildRes();

      await checkConformationEligibility(req, res);

      expect(res.statusValue).toBe(200);
      const body = res.jsonValue;
      expect(body.success).toBe(true);
      expect(body.data.eligible).toBe(false);
      expect(body.data.groomAssigned).toBe(false);
      expect(body.data.errors.some(e => /groom/i.test(e))).toBe(true);
    });
  });

  describe('AC5 — unhealthy horse returns eligible: false', () => {
    it('returns 200 with eligible=false containing health error', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id, { healthStatus: 'Injured' });
      const groom = await createGroom(user.id);
      await createGroomAssignment(groom.id, horse.id, user.id);

      const req = buildReq({ user: { id: user.id }, params: { horseId: String(horse.id) } });
      const res = buildRes();

      await checkConformationEligibility(req, res);

      expect(res.statusValue).toBe(200);
      const body = res.jsonValue;
      expect(body.data.eligible).toBe(false);
      expect(body.data.errors.some(e => /health/i.test(e))).toBe(true);
    });
  });

  describe('AC4 — unowned horse returns 404', () => {
    it('returns 404 when horse is not owned by user', async () => {
      const owner = await createUser();
      const otherUser = await createUser();
      const horse = await createHorse(owner.id);

      const req = buildReq({ user: { id: otherUser.id }, params: { horseId: String(horse.id) } });
      const res = buildRes();

      await checkConformationEligibility(req, res);

      expect(res.statusValue).toBe(404);
      expect(res.jsonValue).toEqual({ success: false, message: 'Horse not found' });
    });
  });

  describe('AC2 — response shape', () => {
    it('response includes horseId, horseName, eligible, errors, warnings, ageClass, groomAssigned', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const groom = await createGroom(user.id);
      await createGroomAssignment(groom.id, horse.id, user.id);

      const req = buildReq({ user: { id: user.id }, params: { horseId: String(horse.id) } });
      const res = buildRes();

      await checkConformationEligibility(req, res);

      const body = res.jsonValue;
      expect(body.data).toHaveProperty('horseId');
      expect(body.data).toHaveProperty('horseName');
      expect(body.data).toHaveProperty('eligible');
      expect(body.data).toHaveProperty('errors');
      expect(body.data).toHaveProperty('warnings');
      expect(body.data).toHaveProperty('ageClass');
      expect(body.data).toHaveProperty('groomAssigned');
    });
  });

  describe('AC5 — horse with no conformationScores returns eligible with warning', () => {
    it('returns 200 with eligible=true and a conformation scores warning', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id, { conformationScores: null });
      const groom = await createGroom(user.id);
      await createGroomAssignment(groom.id, horse.id, user.id);

      const req = buildReq({ user: { id: user.id }, params: { horseId: String(horse.id) } });
      const res = buildRes();

      await checkConformationEligibility(req, res);

      expect(res.statusValue).toBe(200);
      const body = res.jsonValue;
      expect(body.success).toBe(true);
      expect(body.data.eligible).toBe(true);
      expect(body.data.warnings.some(w => /conformation scores/i.test(w))).toBe(true);
    });
  });
});
