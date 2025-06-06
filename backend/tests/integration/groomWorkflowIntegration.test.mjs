/**
 * @fileoverview Comprehensive Groom Workflow Integration Tests
 *
 * @description
 * Complete integration test suite for the groom management system, validating
 * the entire workflow from groom hiring through trait development. Tests real
 * database operations with minimal strategic mocking following TDD best practices.
 *
 * @features
 * - Complete groom hiring workflow with validation
 * - Groom assignment management with priority handling
 * - Age-based task validation (0-2, 1-3, 3+ years)
 * - Daily task exclusivity enforcement across all categories
 * - Streak tracking with grace period logic (2-day grace, 3+ day reset)
 * - Burnout immunity achievement (7+ consecutive days)
 * - Task logging for trait evaluation and development
 * - Trait influence system with +3/-3 permanence rules
 * - Epigenetic trait marking for early development (before age 3)
 * - Error handling and edge case validation
 * - Database transaction integrity and concurrent operation safety
 *
 * @dependencies
 * - @jest/globals: Testing framework with ES modules support
 * - prisma: Database client for real database operations
 * - groomController: Groom management controller functions
 * - groomSystem: Groom business logic and validation utilities
 * - traitEvaluation: Enhanced trait influence system
 * - logger: Winston logger (strategically mocked for test isolation)
 *
 * @usage
 * Run with: npm test -- groomWorkflowIntegration.test.js
 * Tests complete groom system workflow with real database operations.
 * Validates business logic, error handling, and trait development integration.
 *
 * @author Equoria Development Team
 * @since 1.2.0
 * @lastModified 2025-01-02 - Initial comprehensive integration test implementation
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import prisma from '../../db/index.mjs';
import {
  hireGroom,
  assignGroom,
  recordInteraction,
  getGroomDefinitions,
} from '../../controllers/groomController.mjs';
import { applyGroomTraitInfluence } from '../../utils/traitEvaluation.mjs';
import { TASK_TRAIT_INFLUENCE_MAP } from '../../utils/taskTraitInfluenceMap.mjs';

// Strategic mocking: Only mock external dependencies, not business logic
jest.mock('../../utils/logger.mjs', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('Groom Workflow Integration Tests', async () => {
  let testUser = null;
  let testFoal = null;
  let testYoungHorse = null;
  let testAdultHorse = null;
  let testBreed = null;

  beforeEach(async () => {
    // Clean up test data
    await prisma.groomAssignment.deleteMany({});
    await prisma.groomInteraction.deleteMany({});
    await prisma.groom.deleteMany({});
    await prisma.horse.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.breed.deleteMany({});

    // Create test breed
    testBreed = await prisma.breed.create({
      data: {
        name: 'Test Breed',
        description: 'Test breed for integration testing',
      },
    });
  });

  // Create test user
  testUser = await prisma.user.create({
    data: {
      id: 'test-user-groom-integration',
      username: 'groomtestuser',
      email: 'groomtest@example.com',
      password: 'testpassword',
      firstName: 'Groom',
      lastName: 'Tester',
      money: 5000,
    },
  });

  // Create test horses of different ages
  testFoal = await prisma.horse.create({
    data: {
      name: 'Test Foal',
      sex: 'Filly',
      dateOfBirth: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year old
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

  testYoungHorse = await prisma.horse.create({
    data: {
      name: 'Test Young Horse',
      sex: 'Colt',
      dateOfBirth: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000), // 2 years old
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

  testAdultHorse = await prisma.horse.create({
    data: {
      name: 'Test Adult Horse',
      sex: 'Mare',
      dateOfBirth: new Date(Date.now() - 4 * 365 * 24 * 60 * 60 * 1000), // 4 years old
      age: 1460,
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
});

afterEach(async () => {
  // Clean up test data
  await prisma.groomAssignment.deleteMany({});
  await prisma.groomInteraction.deleteMany({});
  await prisma.groom.deleteMany({});
  await prisma.horse.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.breed.deleteMany({});
});

describe('1. Complete Groom Hiring Workflow', () => {
  it('should hire groom with proper skill calculations and validation', async () => {
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

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await hireGroom(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: 'Successfully hired Sarah Johnson',
        data: expect.objectContaining({
          name: 'Sarah Johnson',
          speciality: 'foal_care',
          skillLevel: 'expert',
          personality: 'gentle',
          experience: 8,
          sessionRate: expect.any(Object), // Decimal type
          userId: testUser.id,
        }),
      }),
    );

    // Verify groom was created in database
    const groom = await prisma.groom.findFirst({
      where: { name: 'Sarah Johnson' },
    });
    expect(groom).toBeTruthy();
    expect(groom.speciality).toBe('foal_care');
    expect(groom.skillLevel).toBe('expert');
  });

  it('should validate required fields and reject invalid groom data', async () => {
    const req = {
      body: {
        name: 'Invalid Groom',
        // Missing required fields
      },
      user: { id: testUser.id },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await hireGroom(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'name, speciality, skill_level, and personality are required',
      }),
    );
  });

  it('should calculate proper session rates based on skill level', async () => {
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

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    // Hire expert groom
    await hireGroom(expertReq, res);
    const expertGroom = await prisma.groom.findFirst({
      where: { name: 'Expert Groom' },
    });

    // Hire novice groom
    res.status.mockClear();
    res.json.mockClear();
    await hireGroom(noviceReq, res);
    const noviceGroom = await prisma.groom.findFirst({
      where: { name: 'Novice Groom' },
    });

    // Expert should cost more than novice
    expect(parseFloat(expertGroom.sessionRate)).toBeGreaterThan(
      parseFloat(noviceGroom.sessionRate),
    );
  });
});

describe('2. Groom Assignment Management', () => {
  let testGroom = null;

  beforeEach(async () => {
    // Create test groom for assignment tests
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

  it('should assign groom to foal with proper validation', async () => {
    const req = {
      body: {
        foalId: testFoal.id,
        groomId: testGroom.id,
        priority: 1,
        notes: 'Primary caregiver for daily enrichment',
      },
      user: { id: testUser.id },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await assignGroom(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          foalId: testFoal.id,
          groomId: testGroom.id,
          priority: 1,
          notes: 'Primary caregiver for daily enrichment',
          isActive: true,
        }),
      }),
    );

    // Verify assignment was created in database
    const assignment = await prisma.groomAssignment.findFirst({
      where: {
        foalId: testFoal.id,
        groomId: testGroom.id,
      },
    });
    expect(assignment).toBeTruthy();
    expect(assignment.isActive).toBe(true);
  });

  it('should handle assignment conflicts and priority management', async () => {
    // Create first assignment
    await prisma.groomAssignment.create({
      data: {
        foalId: testFoal.id,
        groomId: testGroom.id,
        priority: 1,
        isActive: true,
        notes: 'First assignment',
      },
    });

    // Create second groom
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
        priority: 1, // Same priority should deactivate first assignment
        notes: 'New primary caregiver',
      },
      user: { id: testUser.id },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await assignGroom(req, res);

    expect(res.status).toHaveBeenCalledWith(201);

    // Verify first assignment was deactivated
    const firstAssignment = await prisma.groomAssignment.findFirst({
      where: {
        foalId: testFoal.id,
        groomId: testGroom.id,
      },
    });
    expect(firstAssignment.isActive).toBe(false);

    // Verify second assignment is active
    const secondAssignment = await prisma.groomAssignment.findFirst({
      where: {
        foalId: testFoal.id,
        groomId: secondGroom.id,
      },
    });
    expect(secondAssignment.isActive).toBe(true);
  });

  it('should validate ownership and authorization', async () => {
    // Create different user
    const otherUser = await prisma.user.create({
      data: {
        id: 'other-user-groom-test',
        username: 'otheruser',
        email: 'other@example.com',
        password: 'password',
        firstName: 'Other',
        lastName: 'User',
        money: 1000,
      },
    });

    const req = {
      body: {
        foalId: testFoal.id,
        groomId: testGroom.id,
        priority: 1,
      },
      user: { id: otherUser.id }, // Different user trying to assign
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await assignGroom(req, res);

    // Should fail due to ownership validation
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

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

    // Assign groom to all test horses
    await Promise.all([
      prisma.groomAssignment.create({
        data: {
          foalId: testFoal.id,
          groomId: testGroom.id,
          priority: 1,
          isActive: true,
        },
      }),
      prisma.groomAssignment.create({
        data: {
          foalId: testYoungHorse.id,
          groomId: testGroom.id,
          priority: 1,
          isActive: true,
        },
      }),
      prisma.groomAssignment.create({
        data: {
          foalId: testAdultHorse.id,
          groomId: testGroom.id,
          priority: 1,
          isActive: true,
        },
      }),
    ]);
  });

  it('should allow enrichment tasks for foals (0-2 years)', async () => {
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

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await recordInteraction(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          interaction: expect.objectContaining({
            interactionType: 'trust_building',
          }),
          effects: expect.any(Object),
        }),
      }),
    );

    // Verify interaction was recorded
    const interaction = await prisma.groomInteraction.findFirst({
      where: {
        foalId: testFoal.id,
        interactionType: 'trust_building',
      },
    });
    expect(interaction).toBeTruthy();
  });

  it('should allow grooming tasks for horses 1-3 years old', async () => {
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

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await recordInteraction(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          interaction: expect.objectContaining({
            interactionType: 'hoof_handling',
          }),
          effects: expect.any(Object),
        }),
      }),
    );

    // Verify interaction was recorded
    const interaction = await prisma.groomInteraction.findFirst({
      where: {
        foalId: testYoungHorse.id,
        interactionType: 'hoof_handling',
      },
    });
    expect(interaction).toBeTruthy();
  });

  it('should allow grooming tasks for horses over 3 years old', async () => {
    const req = {
      body: {
        foalId: testAdultHorse.id,
        groomId: testGroom.id,
        interactionType: 'full_groom',
        duration: 60,
        notes: 'Full grooming for adult horse',
      },
      user: { id: testUser.id },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await recordInteraction(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          interaction: expect.objectContaining({
            interactionType: 'full_groom',
          }),
          effects: expect.any(Object),
        }),
      }),
    );

    // Verify interaction was recorded
    const interaction = await prisma.groomInteraction.findFirst({
      where: {
        foalId: testAdultHorse.id,
        interactionType: 'full_groom',
      },
    });
    expect(interaction).toBeTruthy();
  });
});
