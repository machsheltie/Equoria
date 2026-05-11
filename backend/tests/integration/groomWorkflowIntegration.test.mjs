/**
 * Groom Workflow Integration Tests
 *
 * Tests the complete groom management workflow (hire → assign → interact)
 * end-to-end against the real DB. No mocks of any kind.
 *
 * Fixtures:
 *   - Breed, User, Horses created in beforeEach; deleted in afterEach
 *   - Grooms / Assignments / Interactions tracked per-test via Set<id>
 *
 * Cleanup: createdIds sets + afterEach cleanupTestData()
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import prisma from '../../db/index.mjs';
import { hireGroom, assignGroom, recordInteraction } from '../../controllers/groomController.mjs';

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

    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

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
        name: `Test Foal ${suffix}`,
        sex: 'Filly',
        dateOfBirth: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        age: 365,
        user: { connect: { id: testUser.id } },
        breed: { connect: { id: testBreed.id } },
        bondScore: 50,
        stressLevel: 20,
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
        name: `Test Young Horse ${suffix}`,
        sex: 'Colt',
        dateOfBirth: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000),
        age: 730,
        user: { connect: { id: testUser.id } },
        breed: { connect: { id: testBreed.id } },
        bondScore: 60,
        stressLevel: 15,
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
        name: `Test Adult Horse ${suffix}`,
        sex: 'Mare',
        dateOfBirth: new Date(Date.now() - 4 * 365 * 24 * 60 * 60 * 1000),
        age: 28,
        user: { connect: { id: testUser.id } },
        breed: { connect: { id: testBreed.id } },
        bondScore: 70,
        stressLevel: 10,
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

  // ─── 1. Complete Groom Hiring Workflow ───────────────────────────────────────

  describe('1. Complete Groom Hiring Workflow', () => {
    it('hires a groom with proper skill calculations and validation', async () => {
      const req = {
        body: {
          name: 'Sarah Johnson',
          speciality: 'foal_care',
          skill_level: 'expert',
          personality: 'gentle',
          experience: 8,
          session_rate: 25.0,
          bio: 'Experienced foal care specialist',
        },
        user: { id: testUser.id },
      };
      const res = makeRes();

      await hireGroom(req, res);

      expect(res._status).toBe(201);
      expect(res._json.success).toBe(true);
      expect(res._json.message).toBe('Successfully hired Sarah Johnson');
      expect(res._json.data).toMatchObject({
        name: 'Sarah Johnson',
        speciality: 'foal_care',
        skillLevel: 'expert',
        personality: 'gentle',
        experience: 8,
        userId: testUser.id,
      });
      expect(res._json.data.sessionRate).toBeDefined();

      const groom = await prisma.groom.findFirst({ where: { name: 'Sarah Johnson' } });
      expect(groom).toBeTruthy();
      expect(groom.speciality).toBe('foal_care');
      expect(groom.skillLevel).toBe('expert');
    });

    it('rejects a hire request with missing required fields', async () => {
      const req = {
        body: { name: 'Invalid Groom' },
        user: { id: testUser.id },
      };
      const res = makeRes();

      await hireGroom(req, res);

      expect(res._status).toBe(400);
      expect(res._json).toMatchObject({
        success: false,
        message: 'name, speciality, skill_level, and personality are required',
      });
    });

    it('charges a higher session rate for an expert groom than a novice groom', async () => {
      const expertReq = {
        body: {
          name: 'Expert Groom',
          speciality: 'foal_care',
          skill_level: 'expert',
          personality: 'gentle',
        },
        user: { id: testUser.id },
      };
      const noviceReq = {
        body: {
          name: 'Novice Groom',
          speciality: 'general',
          skill_level: 'novice',
          personality: 'patient',
        },
        user: { id: testUser.id },
      };

      await hireGroom(expertReq, makeRes());
      await hireGroom(noviceReq, makeRes());

      const expertGroom = await prisma.groom.findFirst({ where: { name: 'Expert Groom' } });
      const noviceGroom = await prisma.groom.findFirst({ where: { name: 'Novice Groom' } });

      expect(parseFloat(expertGroom.sessionRate)).toBeGreaterThan(parseFloat(noviceGroom.sessionRate));
    });
  });

  // ─── 2. Groom Assignment Management ─────────────────────────────────────────

  describe('2. Groom Assignment Management', () => {
    let testGroom = null;

    beforeEach(async () => {
      testGroom = await prisma.groom.create({
        data: {
          name: 'Test Assignment Groom',
          speciality: 'foal_care',
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
          priority: 1,
          notes: 'Primary caregiver for daily enrichment',
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
          priority: 1,
          notes: 'Primary caregiver for daily enrichment',
          isActive: true,
        },
      });

      const assignment = await prisma.groomAssignment.findFirst({
        where: { foalId: testFoal.id, groomId: testGroom.id },
      });
      expect(assignment).toBeTruthy();
      expect(assignment.isActive).toBe(true);
    });

    it('deactivates the previous priority-1 assignment when a new one is created', async () => {
      await prisma.groomAssignment.create({
        data: {
          foalId: testFoal.id,
          groomId: testGroom.id,
          userId: testUser.id,
          priority: 1,
          isActive: true,
          notes: 'First assignment',
        },
      });

      const secondGroom = await prisma.groom.create({
        data: {
          name: 'Second Test Groom',
          speciality: 'foal_care',
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
          priority: 1,
          notes: 'New primary caregiver',
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
        body: { foalId: testFoal.id, groomId: testGroom.id, priority: 1 },
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

  // ─── 3. Age-Based Task Validation ────────────────────────────────────────────

  describe('3. Age-Based Task Validation', () => {
    let testGroom = null;

    beforeEach(async () => {
      testGroom = await prisma.groom.create({
        data: {
          name: 'Age Test Groom',
          speciality: 'foal_care',
          skillLevel: 'expert',
          personality: 'gentle',
          sessionRate: 25.0,
          userId: testUser.id,
        },
      });

      await Promise.all([
        prisma.groomAssignment.create({
          data: {
            foalId: testFoal.id,
            groomId: testGroom.id,
            userId: testUser.id,
            priority: 1,
            isActive: true,
          },
        }),
        prisma.groomAssignment.create({
          data: {
            foalId: testYoungHorse.id,
            groomId: testGroom.id,
            userId: testUser.id,
            priority: 1,
            isActive: true,
          },
        }),
        prisma.groomAssignment.create({
          data: {
            foalId: testAdultHorse.id,
            groomId: testGroom.id,
            userId: testUser.id,
            priority: 1,
            isActive: true,
          },
        }),
      ]);
    });

    it('allows enrichment tasks for foals (0-2 years)', async () => {
      const req = {
        body: {
          foalId: testFoal.id,
          groomId: testGroom.id,
          interactionType: 'trust_building',
          duration: 30,
          notes: 'Building trust with young foal',
        },
        user: { id: testUser.id },
      };
      const res = makeRes();

      await recordInteraction(req, res);

      expect(res._status).toBe(200);
      expect(res._json).toMatchObject({
        success: true,
        data: {
          interaction: { interactionType: 'trust_building' },
        },
      });

      const interaction = await prisma.groomInteraction.findFirst({
        where: { foalId: testFoal.id, interactionType: 'trust_building' },
      });
      expect(interaction).toBeTruthy();
    });

    it('allows grooming tasks for horses 1-3 years old', async () => {
      const req = {
        body: {
          foalId: testYoungHorse.id,
          groomId: testGroom.id,
          interactionType: 'hoof_handling',
          duration: 30,
          notes: 'Handling hooves for young horse',
        },
        user: { id: testUser.id },
      };
      const res = makeRes();

      await recordInteraction(req, res);

      expect(res._status).toBe(200);
      expect(res._json).toMatchObject({
        success: true,
        data: {
          interaction: { interactionType: 'hoof_handling' },
        },
      });

      const interaction = await prisma.groomInteraction.findFirst({
        where: { foalId: testYoungHorse.id, interactionType: 'hoof_handling' },
      });
      expect(interaction).toBeTruthy();
    });

    it('allows grooming tasks for horses over 3 years old', async () => {
      const req = {
        body: {
          foalId: testAdultHorse.id,
          groomId: testGroom.id,
          interactionType: 'brushing',
          duration: 60,
          notes: 'Brushing for adult horse',
        },
        user: { id: testUser.id },
      };
      const res = makeRes();

      await recordInteraction(req, res);

      expect(res._status).toBe(200);
      expect(res._json).toMatchObject({
        success: true,
        data: {
          interaction: { interactionType: 'brushing' },
        },
      });

      const interaction = await prisma.groomInteraction.findFirst({
        where: { foalId: testAdultHorse.id, interactionType: 'brushing' },
      });
      expect(interaction).toBeTruthy();
    });
  });
});
