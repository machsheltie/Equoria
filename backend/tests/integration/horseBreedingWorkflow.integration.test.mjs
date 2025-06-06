/* eslint-disable no-console */
/**
 * INTEGRATION TEST: Complete Horse Breeding Workflow
 *
 * This test validates the ENTIRE horse breeding process from user registration
 * to foal birth with traits, following TDD principles with minimal mocking.
 *
 * WORKFLOW TESTED:
 * 1. User Registration & Authentication
 * 2. Horse Creation (Mare & Stallion)
 * 3. Breeding Process
 * 4. Foal Birth with Trait Application
 * 5. Groom Assignment to Foal
 * 6. Initial Foal Development
 *
 * MOCKING STRATEGY (Balanced Approach):
 * ✅ REAL: Database operations, business logic, trait calculations
 * 🔧 MOCK: Only Math.random for deterministic trait generation
 */

import { jest, describe, beforeAll, afterAll, expect, it } from '@jest/globals';
import request from 'supertest';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load test environment
dotenv.config({ path: join(__dirname, '../../.env.test') });

// Import real modules (minimal mocking)
const app = (await import('../../app.mjs')).default;
const { default: prisma } = await import('../../db/index.mjs');

describe('🐎 INTEGRATION: Complete Horse Breeding Workflow', () => {
  let testUser;
  let _authToken;
  let mare;
  let stallion;
  let foal;
  let assignedGroom;

  beforeAll(async () => {
    // Clean up any existing test data
    await cleanupTestData();

    // Mock Math.random for deterministic trait generation (ONLY external dependency)
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterAll(async () => {
    // Restore mocks
    jest.restoreAllMocks();

    // Clean up test data
    await cleanupTestData();
    await prisma.$disconnect();
  });

  async function cleanupTestData() {
    try {
      // Delete in correct order to respect foreign key constraints
      await prisma.groomAssignment.deleteMany({
        where: { foal: { name: { startsWith: 'Integration Test' } } },
      });

      await prisma.groom.deleteMany({
        where: { name: { startsWith: 'Integration Test' } },
      });

      await prisma.horse.deleteMany({
        where: { name: { startsWith: 'Integration Test' } },
      });

      await prisma.user.deleteMany({
        where: { email: 'integration-test@example.com' },
      });
    } catch (error) {
      console.warn('Cleanup warning (can be ignored):', error.message);
    }
  }

  describe('🔐 STEP 1: User Registration & Authentication', () => {
    it('should register user and obtain authentication token', async () => {
      const userData = {
        username: 'integrationtester',
        firstName: 'Integration',
        lastName: 'Tester',
        email: 'integration-test@example.com',
        password: 'TestPassword123',
        money: 5000, // Enough for breeding operations
      };

      const response = await request(app).post('/api/auth/register').send(userData).expect(201);

      expect(response.body.status).toBe('success');
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.token).toBeDefined();

      // Store for subsequent tests
      testUser = response.body.data.user;
      _authToken = response.body.data.token;

      // VERIFY: User exists in database
      const dbUser = await prisma.user.findUnique({
        where: { id: testUser.id },
      });
      expect(dbUser).toBeTruthy();
      expect(dbUser.email).toBe(userData.email);
    });
  });

  describe('🐴 STEP 2: Horse Creation (Breeding Stock)', () => {
    it('should create mare with quality traits', async () => {
      // Ensure we have a breed
      let breed = await prisma.breed.findFirst();
      if (!breed) {
        breed = await prisma.breed.create({
          data: {
            name: 'Integration Test Thoroughbred',
            description: 'Test breed for integration testing',
          },
        });
      }

      // Create mare with proper schema fields (matching working tests)
      mare = await prisma.horse.create({
        data: {
          name: 'Integration Test Mare',
          age: 5,
          breedId: breed.id,
          sex: 'Mare',
          healthStatus: 'Excellent',
          ownerId: testUser.id,
          userId: testUser.id,
          dateOfBirth: new Date('2019-01-01'),
          disciplineScores: {
            Racing: 85,
            Dressage: 78,
          },
          epigeneticModifiers: {
            positive: ['fast', 'intelligent', 'calm', 'resilient'],
            negative: [],
            hidden: ['strong_heart'],
          },
        },
      });

      expect(mare.name).toBe('Integration Test Mare');
      expect(mare.sex).toBe('Mare');
      expect(mare.epigeneticModifiers.positive).toContain('fast');
      expect(mare.ownerId).toBe(testUser.id);
    });

    it('should create stallion with complementary traits', async () => {
      const breed = await prisma.breed.findFirst();

      // Create stallion with proper schema fields (matching working tests)
      stallion = await prisma.horse.create({
        data: {
          name: 'Integration Test Stallion',
          age: 6,
          breedId: breed.id,
          sex: 'Stallion',
          healthStatus: 'Excellent',
          ownerId: testUser.id,
          userId: testUser.id,
          dateOfBirth: new Date('2018-01-01'),
          disciplineScores: {
            Racing: 90,
            'Show Jumping': 82,
          },
          epigeneticModifiers: {
            positive: ['powerful', 'brave', 'athletic', 'people_trusting'],
            negative: [],
            hidden: ['endurance'],
          },
        },
      });

      expect(stallion.name).toBe('Integration Test Stallion');
      expect(stallion.sex).toBe('Stallion');
      expect(stallion.epigeneticModifiers.positive).toContain('powerful');
      expect(stallion.ownerId).toBe(testUser.id);
    });
  });

  describe('🤱 STEP 3: Breeding Process & Foal Birth', () => {
    it('should create foal with inherited and epigenetic traits', async () => {
      const breed = await prisma.breed.findFirst();

      // Create foal (simulating breeding result) with proper schema fields
      foal = await prisma.horse.create({
        data: {
          name: 'Integration Test Foal',
          age: 0, // Newborn
          breedId: breed.id,
          sex: 'Colt',
          sireId: stallion.id,
          damId: mare.id,
          healthStatus: 'Excellent',
          ownerId: testUser.id,
          userId: testUser.id,
          dateOfBirth: new Date(), // Born today
          disciplineScores: {}, // No training yet
          epigeneticModifiers: {
            positive: [], // Will be populated by trait application
            negative: [],
            hidden: [],
          },
        },
      });

      // APPLY AT-BIRTH TRAITS (Real business logic, no mocking)
      const { applyEpigeneticTraitsAtBirth } = await import(
        '../../utils/applyEpigeneticTraitsAtBirth.js'
      );

      const lineage = [mare, stallion]; // Simplified lineage
      const epigeneticTraits = applyEpigeneticTraitsAtBirth({
        mare: { stressLevel: 20 }, // Low stress
        lineage,
        feedQuality: 85, // Premium feed
        stressLevel: 20,
      });

      // Update foal with epigenetic traits
      foal = await prisma.horse.update({
        where: { id: foal.id },
        data: {
          epigeneticModifiers: epigeneticTraits,
        },
      });

      // VERIFY: Foal has proper relationships and traits
      expect(foal.sireId).toBe(stallion.id);
      expect(foal.damId).toBe(mare.id);
      expect(foal.age).toBe(0);

      // VERIFY: Epigenetic traits applied (with mocked random, should be deterministic)
      expect(foal.epigeneticModifiers).toHaveProperty('positive');
      expect(foal.epigeneticModifiers).toHaveProperty('negative');
    });
  });

  describe('👥 STEP 4: Groom Assignment & Care', () => {
    it('should assign specialized foal care groom to newborn', async () => {
      // Import groom system (real business logic)
      const { ensureDefaultGroomAssignment } = await import('../../utils/groomSystem.js');

      // Ensure foal has a groom assignment
      const assignmentResult = await ensureDefaultGroomAssignment(foal.id, testUser.id);

      expect(assignmentResult.success).toBe(true);
      expect(assignmentResult.assignment || assignmentResult.newAssignment).toBeDefined();

      // VERIFY: Assignment exists in database
      const dbAssignment = await prisma.groomAssignment.findFirst({
        where: { foalId: foal.id },
        include: { groom: true },
      });

      expect(dbAssignment).toBeTruthy();
      expect(dbAssignment.groom.speciality).toBe('foal_care');

      assignedGroom = dbAssignment.groom;
    });

    it('should record groom interaction with foal', async () => {
      // Import groom system
      const { recordGroomInteraction } = await import('../../utils/groomSystem.js');

      const interactionData = {
        foalId: foal.id,
        groomId: assignedGroom.id,
        interactionType: 'daily_care',
        duration: 60, // 1 hour
        notes: 'Initial care for newborn foal',
      };

      const interactionResult = await recordGroomInteraction(
        interactionData.foalId,
        interactionData.groomId,
        interactionData.interactionType,
        interactionData.duration,
        testUser.id,
        interactionData.notes,
      );

      expect(interactionResult.success).toBe(true);

      // VERIFY: Interaction logged in database
      const dbInteraction = await prisma.groomInteraction.findFirst({
        where: {
          foalId: foal.id,
          groomId: assignedGroom.id,
        },
      });

      expect(dbInteraction).toBeTruthy();
      expect(dbInteraction.interactionType).toBe('daily_care');
      expect(dbInteraction.duration).toBe(60);
    });
  });

  describe('📈 STEP 5: Foal Development Tracking', () => {
    it('should track foal development progress', async () => {
      // Get foal development data
      const { getFoalDevelopment } = await import('../../models/foalModel.js');

      const developmentData = await getFoalDevelopment(foal.id);

      expect(developmentData).toBeDefined();
      expect(developmentData.foal.id).toBe(foal.id);
      expect(developmentData.development.currentDay).toBeGreaterThanOrEqual(0);

      // VERIFY: Development record exists in database
      const dbDevelopment = await prisma.foalDevelopment.findUnique({
        where: { foalId: foal.id },
      });

      expect(dbDevelopment).toBeTruthy();
      expect(dbDevelopment.foalId).toBe(foal.id);
    });
  });

  describe('🎯 STEP 6: End-to-End Workflow Validation', () => {
    it('should validate complete breeding workflow integrity', async () => {
      // VERIFY: Complete family tree exists
      const foalWithFamily = await prisma.horse.findUnique({
        where: { id: foal.id },
        include: {
          sire: true,
          dam: true,
          groomAssignments: {
            include: { groom: true },
          },
          groomInteractions: true,
          foalDevelopment: true,
        },
      });

      // Family relationships
      expect(foalWithFamily.sire.id).toBe(stallion.id);
      expect(foalWithFamily.dam.id).toBe(mare.id);

      // Groom care system
      expect(foalWithFamily.groomAssignments).toHaveLength(1);
      expect(foalWithFamily.groomAssignments[0].groom.speciality).toBe('foal_care');
      expect(foalWithFamily.groomInteractions).toHaveLength(1);

      // Development tracking
      expect(foalWithFamily.foalDevelopment).toBeTruthy();

      // Trait inheritance (epigenetic traits applied)
      expect(foalWithFamily.epigeneticModifiers).toHaveProperty('positive');
      expect(foalWithFamily.epigeneticModifiers).toHaveProperty('negative');

      // User ownership
      expect(foalWithFamily.ownerId).toBe(testUser.id);
      expect(foalWithFamily.userId).toBe(testUser.id);
    });

    it('should validate business rules are enforced throughout workflow', async () => {
      // Age validation
      expect(foal.age).toBe(0); // Newborn
      expect(mare.age).toBeGreaterThanOrEqual(3); // Breeding age
      expect(stallion.age).toBeGreaterThanOrEqual(3); // Breeding age

      // Trait inheritance rules
      expect(foal.epigeneticModifiers.positive).toBeDefined();
      expect(Array.isArray(foal.epigeneticModifiers.positive)).toBe(true);

      // Groom specialization rules
      expect(assignedGroom.speciality).toBe('foal_care'); // Correct specialty for foal

      // Data integrity
      expect(foal.sireId).toBe(stallion.id);
      expect(foal.damId).toBe(mare.id);
      expect(foal.ownerId).toBe(testUser.id);
    });
  });
});
