/**
 * Groom Workflow Integration Tests
 *
 * Tests the groom management workflow (assign) end-to-end against the real DB.
 * No mocks of any kind. The hire section went with the player-built
 * POST /grooms/hire (Equoria-bvddn.7: players never create grooms).
 *
 * Fixtures:
 *   - Breed, User, Horses created in beforeEach; deleted in afterEach
 *   - Grooms / Assignments / Interactions tracked per-test via Set<id>
 *
 * Cleanup: createdIds sets + afterEach cleanupTestData()
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../packages/database/prismaClient.mjs';
import { assignGroom } from '../../modules/grooms/controllers/groomAssignmentHandlers.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../helpers/fixtureColor.mjs';
import { gameCalendarDate } from '../../utils/gameTime.mjs';

// ─── plain response capture ───────────────────────────────────────────────────

function makeRes() {
  return {
    _status: null,
    _json: null,
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._json = body;
      return this;
    },
  };
}

// ─── suite state ──────────────────────────────────────────────────────────────

describe('Groom Workflow Integration Tests', () => {
  let testUser = null;
  let testFoal = null;
  let testYoungHorse = null;
  let testAdultHorse = null;
  let testBreed = null;

  const createdInteractionIds = new Set();
  const createdAssignmentIds = new Set();
  const createdGroomIds = new Set();
  const createdHorseIds = new Set();
  const createdUserIds = new Set();
  const createdBreedIds = new Set();

  const cleanupTestData = async () => {
    try {
      if (createdInteractionIds.size > 0) {
        await prisma.groomInteraction.deleteMany({
          where: { id: { in: Array.from(createdInteractionIds) } },
        });
        createdInteractionIds.clear();
      }
      if (createdAssignmentIds.size > 0) {
        await prisma.groomAssignment.deleteMany({
          where: { id: { in: Array.from(createdAssignmentIds) } },
        });
        createdAssignmentIds.clear();
      }
      if (createdGroomIds.size > 0) {
        await prisma.groom.deleteMany({
          where: { id: { in: Array.from(createdGroomIds) } },
        });
        createdGroomIds.clear();
      }
      if (createdHorseIds.size > 0) {
        await prisma.horse.deleteMany({
          where: { id: { in: Array.from(createdHorseIds) } },
        });
        createdHorseIds.clear();
      }
      if (createdUserIds.size > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: Array.from(createdUserIds) } },
        });
        createdUserIds.clear();
      }
      if (createdBreedIds.size > 0) {
        await prisma.breed.deleteMany({
          where: { id: { in: Array.from(createdBreedIds) } },
        });
        createdBreedIds.clear();
      }
    } catch (error) {
      console.error('Cleanup error:', error.message);
    }
  };

  beforeEach(async () => {
    await cleanupTestData();

    // Clean stale test data from previous runs by name pattern
    await prisma.groom.deleteMany({
      where: {
        OR: [
          { name: { contains: 'Sarah Johnson' } },
          { name: { contains: 'Test Assignment Groom' } },
          { name: { contains: 'Age Test Groom' } },
          { name: { contains: 'Expert Groom' } },
          { name: { contains: 'Novice Groom' } },
        ],
      },
    });

    const suffix = `${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`;

    testBreed = await prisma.breed.create({
      data: {
        name: `Test Breed ${suffix}`,
        description: 'Test breed for integration testing',
      },
    });
    createdBreedIds.add(testBreed.id);

    testUser = await prisma.user.create({
      data: {
        id: `user-groom-int-${suffix}`,
        username: `groomtestuser_${suffix}`,
        email: `groomtest_${suffix}@example.com`,
        password: 'TestPassword123!',
        firstName: 'Groom',
        lastName: 'Tester',
        money: 5000,
      },
    });
    createdUserIds.add(testUser.id);

    testFoal = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `Test Foal ${suffix}`,
        sex: 'Filly',
        dateOfBirth: gameCalendarDate(new Date(), -365),
        age: 1, // 1 game-year (post Equoria-son6: Horse.age is game-years; foal does enrichment tasks 0-2yr)
        user: { connect: { id: testUser.id } },
        breed: { connect: { id: testBreed.id } },
        bondScore: 50,
        taskLog: null,
        lastGroomed: null,
        daysGroomedInARow: 0,
        consecutiveDaysFoalCare: 0,
        epigeneticModifiers: {},
      },
    });
    createdHorseIds.add(testFoal.id);

    testYoungHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `Test Young Horse ${suffix}`,
        sex: 'Colt',
        dateOfBirth: gameCalendarDate(new Date(), -2 * 365),
        age: 2, // 2 game-years (post Equoria-son6: Horse.age is game-years; does foal grooming tasks 1-3yr)
        user: { connect: { id: testUser.id } },
        breed: { connect: { id: testBreed.id } },
        bondScore: 60,
        taskLog: null,
        lastGroomed: null,
        daysGroomedInARow: 0,
        consecutiveDaysFoalCare: 0,
        epigeneticModifiers: {},
      },
    });
    createdHorseIds.add(testYoungHorse.id);

    testAdultHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `Test Adult Horse ${suffix}`,
        sex: 'Mare',
        dateOfBirth: gameCalendarDate(new Date(), -4 * 365),
        age: 28,
        user: { connect: { id: testUser.id } },
        breed: { connect: { id: testBreed.id } },
        bondScore: 70,
        taskLog: null,
        lastGroomed: null,
        daysGroomedInARow: 0,
        consecutiveDaysFoalCare: 0,
        epigeneticModifiers: {},
      },
    });
    createdHorseIds.add(testAdultHorse.id);
  });

  afterEach(async () => {
    if (testUser) {
      const grooms = await prisma.groom.findMany({ where: { userId: testUser.id } });
      grooms.forEach(g => createdGroomIds.add(g.id));

      const assignments = await prisma.groomAssignment.findMany({ where: { userId: testUser.id } });
      assignments.forEach(a => createdAssignmentIds.add(a.id));
    }

    const foalIds = [testFoal?.id, testYoungHorse?.id, testAdultHorse?.id].filter(Boolean);
    if (foalIds.length > 0) {
      const interactions = await prisma.groomInteraction.findMany({
        where: { foalId: { in: foalIds } },
      });
      interactions.forEach(i => createdInteractionIds.add(i.id));
    }

    await cleanupTestData();
  });

  // ─── 2. Groom Assignment Management ─────────────────────────────────────────

  describe('2. Groom Assignment Management', () => {
    let testGroom = null;

    beforeEach(async () => {
      testGroom = await prisma.groom.create({
        data: {
          name: 'Test Assignment Groom',
          speciality: 'foalCare',
          skillLevel: 'intermediate',
          personality: 'gentle',
          sessionRate: 20.0,
          userId: testUser.id,
        },
      });
    });

    it('assigns a groom to a foal with proper validation', async () => {
      const req = {
        body: {
          foalId: testFoal.id,
          groomId: testGroom.id,
        },
        user: { id: testUser.id },
      };
      const res = makeRes();

      await assignGroom(req, res);

      expect(res._status).toBe(201);
      expect(res._json).toMatchObject({
        success: true,
        data: {
          foalId: testFoal.id,
          groomId: testGroom.id,
          isActive: true,
        },
      });
      // Equoria-ekrab: no priority level and no notes on an assignment.
      expect(res._json.data).not.toHaveProperty('priority');
      expect(res._json.data).not.toHaveProperty('notes');

      const assignment = await prisma.groomAssignment.findFirst({
        where: { foalId: testFoal.id, groomId: testGroom.id },
      });
      expect(assignment).toBeTruthy();
      expect(assignment.isActive).toBe(true);
    });

    // Equoria-ekrab: no priority level; a new groom replaces the foal's active
    // groom. Old contract: it replaced the previous priority-1 assignment.
    it('ends the previous assignment when a new one is created', async () => {
      await prisma.groomAssignment.create({
        data: {
          foalId: testFoal.id,
          groomId: testGroom.id,
          userId: testUser.id,
          isActive: true,
        },
      });

      const secondGroom = await prisma.groom.create({
        data: {
          name: 'Second Test Groom',
          speciality: 'foalCare',
          skillLevel: 'expert',
          personality: 'patient',
          sessionRate: 25.0,
          userId: testUser.id,
        },
      });

      const req = {
        body: {
          foalId: testFoal.id,
          groomId: secondGroom.id,
        },
        user: { id: testUser.id },
      };
      const res = makeRes();

      await assignGroom(req, res);

      expect(res._status).toBe(201);

      const firstAssignment = await prisma.groomAssignment.findFirst({
        where: { foalId: testFoal.id, groomId: testGroom.id },
      });
      expect(firstAssignment.isActive).toBe(false);

      const secondAssignment = await prisma.groomAssignment.findFirst({
        where: { foalId: testFoal.id, groomId: secondGroom.id },
      });
      expect(secondAssignment.isActive).toBe(true);
    });

    it('returns 500 when the groom belongs to a different user (service-level ownership check)', async () => {
      const otherUser = await prisma.user.create({
        data: {
          id: `other-user-groom-${Date.now()}`,
          username: `otheruser_${Date.now()}`,
          email: `other_${Date.now()}@example.com`,
          password: 'password',
          firstName: 'Other',
          lastName: 'User',
          money: 1000,
        },
      });
      createdUserIds.add(otherUser.id);

      const req = {
        body: { foalId: testFoal.id, groomId: testGroom.id },
        user: { id: otherUser.id },
      };
      const res = makeRes();

      await assignGroom(req, res);

      // Route middleware enforces ownership (CWE-639). Calling the controller
      // directly bypasses it; the underlying service throws a non-disclosing
      // error that the controller converts to 500.
      expect(res._status).toBe(500);
    });
  });

  // Section 3 ('Age-Based Task Validation') drove recordInteraction with the
  // old per-age task lists. That door is retired (Equoria-l7xag): "groom horse"
  // is the only way to groom, and a foal's choices come from the one band
  // schedule (owner rulings 2026-10-20, 2026-10-26 q70). Covered by
  // modules/grooms/__tests__/groomCareRoutes.integration.test.mjs.
});
