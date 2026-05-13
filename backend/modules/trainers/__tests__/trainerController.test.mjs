/**
 * trainerController.test.mjs — real DB
 *
 * NO MOCKS. Equoria-p6fx (no-mocks doctrine epic 2026-04-30): converted
 * from jest.unstable_mockModule of prismaClient + logger to a real-DB
 * integration test against the equoria_test database.
 *
 * Coverage: getUserTrainers, getTrainerAssignments, assignTrainer,
 * deleteTrainerAssignment, dismissTrainer.
 *
 * Removed (per doctrine):
 *   - "returns 500 on database error" tests that mocked Prisma to
 *     reject. Synthetic Prisma fault injection is not permitted; the
 *     catch path is observable via real DB outage / sentry.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../db/index.mjs';
import {
  getUserTrainers,
  getTrainerAssignments,
  assignTrainer,
  deleteTrainerAssignment,
  dismissTrainer,
  getTrainerDiscovery,
} from '../controllers/trainerController.mjs';

const SUITE_PREFIX = 'tctrl';

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
      firstName: 'Tc',
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

async function createTrainer(userId, overrides = {}) {
  return prisma.trainer.create({
    data: {
      firstName: overrides.firstName ?? 'Alice',
      lastName: overrides.lastName ?? 'Smith',
      personality: overrides.personality ?? 'patient',
      skillLevel: 'expert',
      speciality: overrides.speciality ?? 'Dressage',
      level: overrides.level ?? 1,
      retired: overrides.retired ?? false,
      user: { connect: { id: userId } },
    },
  });
}

async function createAssignment(trainerId, horseId, userId) {
  return prisma.trainerAssignment.create({
    data: {
      trainer: { connect: { id: trainerId } },
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
  const trainers = await prisma.trainer.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const trainerIds = trainers.map(t => t.id);
  if (trainerIds.length > 0) {
    await prisma.trainerAssignment.deleteMany({ where: { trainerId: { in: trainerIds } } });
  }
  await prisma.trainer.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.horse.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

describe('trainerController (real DB)', () => {
  beforeAll(cleanupSuite);
  afterAll(cleanupSuite);
  afterEach(cleanupSuite);

  describe('getUserTrainers', () => {
    it('returns formatted trainers with name and assignedHorseId', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const trainer = await createTrainer(user.id, { firstName: 'Alice', lastName: 'Smith' });
      await createAssignment(trainer.id, horse.id, user.id);

      const h = makeReqRes(user.id);
      await getUserTrainers(h.req, h.res);

      expect(h.res.statusValue).toBe(200);
      const data = h.res.jsonValue.data;
      expect(data[0]).toMatchObject({
        name: 'Alice Smith',
        assignedHorseId: horse.id,
      });
    });

    it('returns assignedHorseId as null when no active assignment', async () => {
      const user = await createUser();
      await createTrainer(user.id, { firstName: 'Bob', lastName: 'Jones' });

      const h = makeReqRes(user.id);
      await getUserTrainers(h.req, h.res);

      const data = h.res.jsonValue.data;
      expect(data[0].assignedHorseId).toBeNull();
    });

    it('only returns non-retired trainers for the authenticated user', async () => {
      const user = await createUser();
      const otherUser = await createUser();
      await createTrainer(user.id, { firstName: 'Mine' });
      await createTrainer(user.id, { firstName: 'Retired', retired: true });
      await createTrainer(otherUser.id, { firstName: 'Theirs' });

      const h = makeReqRes(user.id);
      await getUserTrainers(h.req, h.res);

      const data = h.res.jsonValue.data;
      expect(data).toHaveLength(1);
      expect(data[0].name).toBe('Mine Smith');
    });
  });

  describe('getTrainerAssignments', () => {
    it('returns formatted active assignments with horse and trainer names', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const trainer = await createTrainer(user.id, { firstName: 'Alice', lastName: 'Smith' });
      await createAssignment(trainer.id, horse.id, user.id);

      const h = makeReqRes(user.id);
      await getTrainerAssignments(h.req, h.res);

      expect(h.res.statusValue).toBe(200);
      const data = h.res.jsonValue.data;
      expect(data[0]).toMatchObject({
        horseName: horse.name,
        trainerName: 'Alice Smith',
      });
    });

    it('returns empty array when user has no assignments', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id);
      await getTrainerAssignments(h.req, h.res);

      expect(h.res.statusValue).toBe(200);
      expect(h.res.jsonValue.data).toEqual([]);
    });
  });

  describe('assignTrainer', () => {
    it('creates assignment and returns 201', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const trainer = await createTrainer(user.id);

      const h = makeReqRes(user.id, { body: { trainerId: trainer.id, horseId: horse.id } });
      await assignTrainer(h.req, h.res);

      expect(h.res.statusValue).toBe(201);
      expect(h.res.jsonValue.success).toBe(true);

      // Verify the DB row was actually created.
      const created = await prisma.trainerAssignment.findFirst({
        where: { trainerId: trainer.id, horseId: horse.id },
      });
      expect(created).not.toBeNull();
      expect(created.isActive).toBe(true);
    });

    it('returns 404 when trainer does not belong to user', async () => {
      const user = await createUser();
      const otherUser = await createUser();
      const horse = await createHorse(user.id);
      const otherTrainer = await createTrainer(otherUser.id);

      const h = makeReqRes(user.id, { body: { trainerId: otherTrainer.id, horseId: horse.id } });
      await assignTrainer(h.req, h.res);

      expect(h.res.statusValue).toBe(404);
      expect(h.res.jsonValue).toMatchObject({ success: false, message: 'Trainer not found' });
    });

    it('returns 404 when horse does not belong to user', async () => {
      const user = await createUser();
      const otherUser = await createUser();
      const trainer = await createTrainer(user.id);
      const otherHorse = await createHorse(otherUser.id);

      const h = makeReqRes(user.id, { body: { trainerId: trainer.id, horseId: otherHorse.id } });
      await assignTrainer(h.req, h.res);

      expect(h.res.statusValue).toBe(404);
      expect(h.res.jsonValue).toMatchObject({ success: false, message: 'Horse not found' });
    });

    it('returns 400 when trainer is already assigned to another horse', async () => {
      const user = await createUser();
      const horse1 = await createHorse(user.id);
      const horse2 = await createHorse(user.id);
      const trainer = await createTrainer(user.id);
      await createAssignment(trainer.id, horse1.id, user.id);

      const h = makeReqRes(user.id, { body: { trainerId: trainer.id, horseId: horse2.id } });
      await assignTrainer(h.req, h.res);

      expect(h.res.statusValue).toBe(400);
      expect(h.res.jsonValue).toMatchObject({
        success: false,
        message: expect.stringContaining('already assigned'),
      });
    });
  });

  describe('deleteTrainerAssignment', () => {
    it('deactivates assignment and returns success', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const trainer = await createTrainer(user.id);
      const assignment = await createAssignment(trainer.id, horse.id, user.id);

      const h = makeReqRes(user.id, { params: { id: String(assignment.id) } });
      await deleteTrainerAssignment(h.req, h.res);

      expect(h.res.statusValue).toBe(200);

      // Verify the DB was actually updated.
      const after = await prisma.trainerAssignment.findUnique({ where: { id: assignment.id } });
      expect(after.isActive).toBe(false);
    });

    it('returns 404 when assignment does not exist', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, { params: { id: '999999999' } });
      await deleteTrainerAssignment(h.req, h.res);

      expect(h.res.statusValue).toBe(404);
      expect(h.res.jsonValue).toMatchObject({ success: false, message: 'Assignment not found' });
    });

    it('returns 404 when assignment belongs to a different user', async () => {
      const owner = await createUser();
      const otherUser = await createUser();
      const horse = await createHorse(owner.id);
      const trainer = await createTrainer(owner.id);
      const assignment = await createAssignment(trainer.id, horse.id, owner.id);

      const h = makeReqRes(otherUser.id, { params: { id: String(assignment.id) } });
      await deleteTrainerAssignment(h.req, h.res);

      expect(h.res.statusValue).toBe(404);
    });
  });

  describe('dismissTrainer', () => {
    it('marks trainer as retired and deactivates all assignments', async () => {
      const user = await createUser();
      const horse = await createHorse(user.id);
      const trainer = await createTrainer(user.id);
      const assignment = await createAssignment(trainer.id, horse.id, user.id);

      const h = makeReqRes(user.id, { params: { id: String(trainer.id) } });
      await dismissTrainer(h.req, h.res);

      expect(h.res.statusValue).toBe(200);

      // Verify DB state.
      const trainerAfter = await prisma.trainer.findUnique({ where: { id: trainer.id } });
      expect(trainerAfter.retired).toBe(true);
      const assignmentAfter = await prisma.trainerAssignment.findUnique({ where: { id: assignment.id } });
      expect(assignmentAfter.isActive).toBe(false);
    });

    it('returns 404 when trainer does not belong to user', async () => {
      const owner = await createUser();
      const otherUser = await createUser();
      const trainer = await createTrainer(owner.id);

      const h = makeReqRes(otherUser.id, { params: { id: String(trainer.id) } });
      await dismissTrainer(h.req, h.res);

      expect(h.res.statusValue).toBe(404);

      // Trainer should NOT be retired.
      const trainerAfter = await prisma.trainer.findUnique({ where: { id: trainer.id } });
      expect(trainerAfter.retired).toBe(false);
    });
  });

  describe('getTrainerDiscovery', () => {
    it('returns 404 when trainer does not exist', async () => {
      const user = await createUser();
      const h = makeReqRes(user.id, { params: { id: '999999999' } });
      await getTrainerDiscovery(h.req, h.res);
      expect(h.res.statusValue).toBe(404);
    });

    it('returns 404 when trainer belongs to another user', async () => {
      const owner = await createUser();
      const other = await createUser();
      const trainer = await createTrainer(owner.id);

      const h = makeReqRes(other.id, { params: { id: String(trainer.id) } });
      await getTrainerDiscovery(h.req, h.res);
      expect(h.res.statusValue).toBe(404);
    });

    it('returns 6 slots with unique, non-generic trait labels', async () => {
      const user = await createUser();
      const trainer = await createTrainer(user.id, { speciality: 'Dressage', personality: 'patient', level: 4 });

      const h = makeReqRes(user.id, { params: { id: String(trainer.id) } });
      await getTrainerDiscovery(h.req, h.res);

      expect(h.res.statusValue).toBe(200);
      const { data } = h.res.jsonValue;
      expect(data.totalSlots).toBe(6);
      expect(data.slots).toHaveLength(6);

      // The 2 discovered slots must have meaningful labels (not the old generic "X Focus" pattern)
      const discovered = data.slots.filter(s => s.discovered);
      expect(discovered).toHaveLength(2);
      discovered.forEach(s => {
        expect(s.trait).toBeDefined();
        expect(s.trait.label).not.toMatch(/Focus$/);
        expect(s.trait.icon).not.toBe('🎓');
        expect(s.trait.description).toBeTruthy();
      });
    });

    it('persists slots so repeated calls return identical trait labels', async () => {
      const user = await createUser();
      const trainer = await createTrainer(user.id, { speciality: 'Dressage', personality: 'patient', level: 4 });

      const h1 = makeReqRes(user.id, { params: { id: String(trainer.id) } });
      await getTrainerDiscovery(h1.req, h1.res);

      const h2 = makeReqRes(user.id, { params: { id: String(trainer.id) } });
      await getTrainerDiscovery(h2.req, h2.res);

      const slots1 = h1.res.jsonValue.data.slots;
      const slots2 = h2.res.jsonValue.data.slots;

      // Discovered slot labels must be identical across both calls
      slots1
        .filter(s => s.discovered)
        .forEach((s, i) => {
          expect(s.trait.label).toBe(slots2.filter(x => x.discovered)[i].trait.label);
          expect(s.trait.icon).toBe(slots2.filter(x => x.discovered)[i].trait.icon);
        });
    });

    it('respects level threshold — level 1 yields 0 discovered slots', async () => {
      const user = await createUser();
      const trainer = await createTrainer(user.id, { level: 1 });

      const h = makeReqRes(user.id, { params: { id: String(trainer.id) } });
      await getTrainerDiscovery(h.req, h.res);

      expect(h.res.statusValue).toBe(200);
      const { data } = h.res.jsonValue;
      expect(data.discoveredCount).toBe(0);
      expect(data.slots.every(s => !s.discovered)).toBe(true);
      expect(data.slots.every(s => s.trait === undefined)).toBe(true);
    });

    it('uses different discipline trait labels for different specialities', async () => {
      const user = await createUser();
      const dressage = await createTrainer(user.id, { speciality: 'Dressage', personality: 'patient', level: 2 });
      const jumping = await createTrainer(user.id, { speciality: 'Show Jumping', personality: 'patient', level: 2 });

      const hD = makeReqRes(user.id, { params: { id: String(dressage.id) } });
      await getTrainerDiscovery(hD.req, hD.res);

      const hJ = makeReqRes(user.id, { params: { id: String(jumping.id) } });
      await getTrainerDiscovery(hJ.req, hJ.res);

      const dSlot0 = hD.res.jsonValue.data.slots[0].trait;
      const jSlot0 = hJ.res.jsonValue.data.slots[0].trait;

      expect(dSlot0.label).not.toBe(jSlot0.label);
    });

    it('includes nextDiscoveryAt when slots remain undiscovered', async () => {
      const user = await createUser();
      const trainer = await createTrainer(user.id, { level: 2 });

      const h = makeReqRes(user.id, { params: { id: String(trainer.id) } });
      await getTrainerDiscovery(h.req, h.res);

      expect(h.res.jsonValue.data.nextDiscoveryAt).toBeDefined();
    });
  });
});
