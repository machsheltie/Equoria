/**
 * riderController.test.mjs — real DB
 *
 * NO MOCKS. Equoria-p6fx (no-mocks doctrine epic 2026-04-30): converted
 * from jest.unstable_mockModule of prismaClient + logger to a real-DB
 * integration test against the equoria_test database.
 *
 * Coverage: getUserRiders, getRiderAssignments, assignRider,
 * deleteRiderAssignment, dismissRider.
 *
 * Removed (per doctrine):
 *   - "returns 500 on database error" tests that mocked Prisma to
 *     reject. Synthetic Prisma fault injection is not permitted.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../db/index.mjs';
import {
  getUserRiders,
  getRiderAssignments,
  assignRider,
  deleteRiderAssignment,
  dismissRider,
} from '../controllers/riderController.mjs';

const SUITE_PREFIX = 'rctrl';

function makeReqRes(userId, overrides = {}) {
  let _status = 200;
  let _body = null;
  return {
    req: { user: { id: userId }, body: {}, params: {}, query: {}, ...overrides },
    res: {
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
      firstName: 'Rc',
      lastName: 'Test',
      password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyGJ4lxPcxqy',
      emailVerified: true,
    },
  });
}

async function createHorse(userId) {
  return prisma.horse.create({
    data: {
      name: `${SUITE_PREFIX}-h-${randomBytes(4).toString('hex')}`,
      sex: 'Mare',
      dateOfBirth: new Date('2020-01-01'),
      user: { connect: { id: userId } },
    },
  });
}

async function createRider(userId, overrides = {}) {
  return prisma.rider.create({
    data: {
      firstName: overrides.firstName ?? 'Maria',
      lastName: overrides.lastName ?? 'Garcia',
      personality: 'methodical',
      skillLevel: 'experienced',
      speciality: 'Dressage',
      retired: overrides.retired ?? false,
      user: { connect: { id: userId } },
    },
  });
}

async function createAssignment(riderId, horseId, userId) {
  return prisma.riderAssignment.create({
    data: {
      rider: { connect: { id: riderId } },
      horse: { connect: { id: horseId } },
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
  const riders = await prisma.rider.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const riderIds = riders.map(r => r.id);
  if (riderIds.length > 0) {
    await prisma.riderAssignment.deleteMany({ where: { riderId: { in: riderIds } } });
  }
  await prisma.rider.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.horse.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

describe('riderController (real DB)', () => {
  beforeAll(cleanupSuite);
  afterAll(cleanupSuite);
  afterEach(cleanupSuite);

  describe('getUserRiders', () => {
    it('returns formatted riders with name and assignedHorseId', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const rider = await createRider(user.id, { firstName: 'Maria', lastName: 'Garcia' });
      await createAssignment(rider.id, horse.id, user.id);

      const h = makeReqRes(user.id);
      await getUserRiders(h.req, h.res);

      expect(h.res.statusValue).toBe(200);
      const data = h.res.jsonValue.data;
      expect(data[0]).toMatchObject({
        name: 'Maria Garcia',
        assignedHorseId: horse.id,
      });
    });

    it('returns assignedHorseId as null when rider has no active assignment', async () => {
      const user = await createUser();
      await createRider(user.id, { firstName: 'Sam', lastName: 'Lee' });

      const h = makeReqRes(user.id);
      await getUserRiders(h.req, h.res);

      const data = h.res.jsonValue.data;
      expect(data[0].assignedHorseId).toBeNull();
    });

    it('only returns non-retired riders for the authenticated user', async () => {
      const user = await createUser();
      const otherUser = await createUser();
      await createRider(user.id, { firstName: 'Mine' });
      await createRider(user.id, { firstName: 'Retired', retired: true });
      await createRider(otherUser.id, { firstName: 'Theirs' });

      const h = makeReqRes(user.id);
      await getUserRiders(h.req, h.res);

      const data = h.res.jsonValue.data;
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe('Mine Garcia');
    });
  });

  describe('getRiderAssignments', () => {
    it('returns formatted assignments with horse and rider names', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const rider = await createRider(user.id, { firstName: 'Maria', lastName: 'Garcia' });
      await createAssignment(rider.id, horse.id, user.id);

      const h = makeReqRes(user.id);
      await getRiderAssignments(h.req, h.res);

      expect(h.res.statusValue).toBe(200);
      const data = h.res.jsonValue.data;
      expect(data[0]).toMatchObject({
        horseName: horse.name,
        riderName: 'Maria Garcia',
      });
    });

    it('returns empty array when user has no assignments', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id);
      await getRiderAssignments(h.req, h.res);

      expect(h.res.statusValue).toBe(200);
      expect(h.res.jsonValue.data).toEqual([]);
    });
  });

  describe('assignRider', () => {
    it('creates assignment and returns 201', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const rider = await createRider(user.id);

      const h = makeReqRes(user.id, { body: { riderId: rider.id, horseId: horse.id } });
      await assignRider(h.req, h.res);

      expect(h.res.statusValue).toBe(201);
      expect(h.res.jsonValue.success).toBe(true);

      const created = await prisma.riderAssignment.findFirst({
        where: { riderId: rider.id, horseId: horse.id, isActive: true },
      });
      expect(created).not.toBeNull();
    });

    it('returns 404 when rider does not belong to user', async () => {
      const user = await createUser();
      const otherUser = await createUser();
      const horse = await createHorse(user.id);
      const otherRider = await createRider(otherUser.id);

      const h = makeReqRes(user.id, { body: { riderId: otherRider.id, horseId: horse.id } });
      await assignRider(h.req, h.res);

      expect(h.res.statusValue).toBe(404);
      expect(h.res.jsonValue).toMatchObject({ success: false, message: 'Rider not found' });
    });

    it('returns 404 when horse does not belong to user', async () => {
      const user = await createUser();
      const otherUser = await createUser();
      const rider = await createRider(user.id);
      const otherHorse = await createHorse(otherUser.id);

      const h = makeReqRes(user.id, { body: { riderId: rider.id, horseId: otherHorse.id } });
      await assignRider(h.req, h.res);

      expect(h.res.statusValue).toBe(404);
      expect(h.res.jsonValue).toMatchObject({ success: false, message: 'Horse not found' });
    });

    it('returns 400 when rider is already assigned to another horse', async () => {
      const user = await createUser();
      const horse1 = await createHorse(user.id);
      const horse2 = await createHorse(user.id);
      const rider = await createRider(user.id);
      await createAssignment(rider.id, horse1.id, user.id);

      const h = makeReqRes(user.id, { body: { riderId: rider.id, horseId: horse2.id } });
      await assignRider(h.req, h.res);

      expect(h.res.statusValue).toBe(400);
      expect(h.res.jsonValue).toMatchObject({
        success: false,
        message: expect.stringContaining('already assigned'),
      });
    });

    it('deactivates any existing rider on the target horse before assigning new one', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const oldRider = await createRider(user.id, { firstName: 'OldRider' });
      const newRider = await createRider(user.id, { firstName: 'NewRider' });
      const oldAssignment = await createAssignment(oldRider.id, horse.id, user.id);

      const h = makeReqRes(user.id, { body: { riderId: newRider.id, horseId: horse.id } });
      await assignRider(h.req, h.res);

      expect(h.res.statusValue).toBe(201);

      const oldAfter = await prisma.riderAssignment.findUnique({ where: { id: oldAssignment.id } });
      expect(oldAfter.isActive).toBe(false);

      const newAssignment = await prisma.riderAssignment.findFirst({
        where: { riderId: newRider.id, horseId: horse.id, isActive: true },
      });
      expect(newAssignment).not.toBeNull();
    });
  });

  describe('deleteRiderAssignment', () => {
    it('deactivates assignment and returns success', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const rider = await createRider(user.id);
      const assignment = await createAssignment(rider.id, horse.id, user.id);

      const h = makeReqRes(user.id, { params: { id: String(assignment.id) } });
      await deleteRiderAssignment(h.req, h.res);

      expect(h.res.statusValue).toBe(200);

      const after = await prisma.riderAssignment.findUnique({ where: { id: assignment.id } });
      expect(after.isActive).toBe(false);
    });

    it('returns 404 when assignment does not exist', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, { params: { id: '999999999' } });
      await deleteRiderAssignment(h.req, h.res);

      expect(h.res.statusValue).toBe(404);
      expect(h.res.jsonValue).toMatchObject({ success: false, message: 'Assignment not found' });
    });

    it('returns 404 when assignment belongs to a different user', async () => {
      const owner = await createUser();
      const otherUser = await createUser();
      const horse = await createHorse(owner.id);
      const rider = await createRider(owner.id);
      const assignment = await createAssignment(rider.id, horse.id, owner.id);

      const h = makeReqRes(otherUser.id, { params: { id: String(assignment.id) } });
      await deleteRiderAssignment(h.req, h.res);

      expect(h.res.statusValue).toBe(404);
    });
  });

  describe('dismissRider', () => {
    it('marks rider retired and deactivates all active assignments', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const rider = await createRider(user.id);
      const assignment = await createAssignment(rider.id, horse.id, user.id);

      const h = makeReqRes(user.id, { params: { id: String(rider.id) } });
      await dismissRider(h.req, h.res);

      expect(h.res.statusValue).toBe(200);

      const riderAfter = await prisma.rider.findUnique({ where: { id: rider.id } });
      expect(riderAfter.retired).toBe(true);
      const assignmentAfter = await prisma.riderAssignment.findUnique({ where: { id: assignment.id } });
      expect(assignmentAfter.isActive).toBe(false);
    });

    it('returns 404 when rider does not belong to user', async () => {
      const owner = await createUser();
      const otherUser = await createUser();
      const rider = await createRider(owner.id);

      const h = makeReqRes(otherUser.id, { params: { id: String(rider.id) } });
      await dismissRider(h.req, h.res);

      expect(h.res.statusValue).toBe(404);

      const riderAfter = await prisma.rider.findUnique({ where: { id: rider.id } });
      expect(riderAfter.retired).toBe(false);
    });
  });
});
