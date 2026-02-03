/**
 * Groom Bonus Traits Test Suite
 *
 * Tests the groom bonus trait system that provides probability bonuses for rare trait acquisition.
 * This system allows grooms to have hidden perk traits that improve the likelihood of specific
 * rare or high-value traits when working with foals during milestone evaluations.
 *
 * Features tested:
 * - Groom bonus trait assignment and validation
 * - Probability modifier calculations
 * - Integration with milestone evaluation system
 * - Business rules enforcement (bond > 60, 75% window coverage)
 * - API endpoints for bonus trait management
 *
 * Testing approach: Real database operations with zero mocking to validate actual business logic
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.mjs';
import prisma from '../db/index.mjs';

describe('Groom Bonus Traits System', () => {
  let testUser;
  let testGroom;
  let testHorse;
  let testBreed;
  let authToken;

  beforeEach(async () => {
    // Create test breed first
    testBreed = await prisma.breed.create({
      data: {
        name: `TestBreed_${Date.now()}`,
        description: 'Test breed for bonus traits tests',
      },
    });

    // Create test user
    testUser = await prisma.user.create({
      data: {
        username: `testuser_${Date.now()}`,
        firstName: 'Test',
        lastName: 'User',
        email: `test_${Date.now()}@example.com`,
        password: 'hashedpassword',
        money: 10000,
        xp: 100,
        level: 2,
      },
    });

    // Create test groom with bonus traits
    testGroom = await prisma.groom.create({
      data: {
        name: `TestGroom_${Date.now()}`,
        speciality: 'foal_care',
        experience: 10,
        skillLevel: 'expert',
        personality: 'calm',
        groomPersonality: 'calm',
        sessionRate: 25.0,
        bonusTraitMap: {
          sensitive: 0.2,
          noble: 0.1,
          quick_learner: 0.15,
        },
        user: { connect: { id: testUser.id } },
      },
    });

    // Create test horse (foal)
    testHorse = await prisma.horse.create({
      data: {
        name: `TestHorse_${Date.now()}`,
        sex: 'colt',
        dateOfBirth: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days old
        temperament: 'spirited',
        user: { connect: { id: testUser.id } },
        breed: { connect: { id: testBreed.id } },
        epigeneticModifiers: { positive: [], negative: [], hidden: [] },
      },
    });

    // Create auth token
    const tokenPayload = {
      id: testUser.id,
      username: testUser.username,
      email: testUser.email,
    };
    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only-32chars',
      {
        expiresIn: '1h',
      }
    );
    authToken = `Bearer ${token}`;
  });

  afterEach(async () => {
    // Clean up test data
    if (testHorse) {
      await prisma.horse.delete({ where: { id: testHorse.id } });
    }
    if (testGroom) {
      await prisma.groom.delete({ where: { id: testGroom.id } });
    }
    if (testUser) {
      await prisma.user.delete({ where: { id: testUser.id } });
    }
    if (testBreed) {
      await prisma.breed.delete({ where: { id: testBreed.id } });
    }
  });

  describe('Groom Bonus Trait Management', () => {
    it('should assign bonus traits to a groom', async () => {
      const bonusTraits = {
        confident: 0.25,
        athletic: 0.15,
        intelligent: 0.2,
      };

      // Test will fail initially - need to implement groomBonusTraitService
      const { assignBonusTraits } = await import('../services/groomBonusTraitService.mjs');

      const result = await assignBonusTraits(testGroom.id, bonusTraits);

      expect(result.success).toBe(true);
      expect(result.bonusTraits).toEqual(bonusTraits);

      // Verify in database
      const updatedGroom = await prisma.groom.findUnique({
        where: { id: testGroom.id },
        select: { bonusTraitMap: true },
      });

      expect(updatedGroom.bonusTraitMap).toEqual(bonusTraits);
    });

    it('should validate bonus trait constraints', async () => {
      const invalidBonusTraits = {
        trait1: 0.35, // Exceeds 30% limit
        trait2: 0.15,
        trait3: 0.1,
        trait4: 0.05, // Exceeds 3 trait limit
      };

      const { assignBonusTraits } = await import('../services/groomBonusTraitService.mjs');

      await expect(assignBonusTraits(testGroom.id, invalidBonusTraits)).rejects.toThrow(
        'Bonus trait constraints violated'
      );
    });

    it('should get groom bonus traits', async () => {
      const { getBonusTraits } = await import('../services/groomBonusTraitService.mjs');

      const bonusTraits = await getBonusTraits(testGroom.id);

      expect(bonusTraits).toEqual({
        sensitive: 0.2,
        noble: 0.1,
        quick_learner: 0.15,
      });
    });
  });

  describe('Trait Assignment Logic Integration', () => {
    it('should apply bonus probability when conditions are met', async () => {
      // Create groom assignment with high bond and good coverage
      // Horse is 30 days old, milestone window is 30 days, need 75% coverage = 22.5 days
      await prisma.groomAssignment.create({
        data: {
          groomId: testGroom.id,
          foalId: testHorse.id,
          userId: testUser.id,
          startDate: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000), // 28 days ago
          endDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago (26 days coverage > 22.5 needed)
          priority: 5,
          notes: 'Test assignment for bonus traits',
        },
      });

      // Create groom interactions to establish bond > 60
      // Horse is 30 days old, so milestone window is 30 days
      // Create interactions within the last 25 days to ensure they're in the window
      for (let i = 0; i < 10; i++) {
        await prisma.groomInteraction.create({
          data: {
            groomId: testGroom.id,
            foalId: testHorse.id, // GroomInteraction uses foalId
            interactionType: 'enrichment',
            duration: 30,
            bondingChange: 8, // GroomInteraction uses bondingChange
            stressChange: -2, // GroomInteraction uses stressChange
            quality: 'excellent', // GroomInteraction uses quality
            cost: 25.0,
            notes: `Test interaction ${i + 1}`,
            timestamp: new Date(Date.now() - (26 - i * 2) * 24 * 60 * 60 * 1000), // Spread over 26 days, within assignment period
          },
        });
      }

      // Test will fail initially - need to implement trait assignment logic
      const { calculateTraitProbabilityWithBonus } = await import(
        '../utils/traitAssignmentLogic.mjs'
      );

      const baseProbability = 0.1; // 10% base chance for 'sensitive' trait
      const result = await calculateTraitProbabilityWithBonus(
        testHorse.id,
        'sensitive',
        baseProbability,
        testGroom.id
      );

      expect(result.finalProbability).toBeCloseTo(0.3, 5); // 10% + 20% bonus (handle floating point precision)
      expect(result.bonusApplied).toBe(true);
      expect(result.bonusAmount).toBe(0.2);
    });

    it('should not apply bonus when bond is too low', async () => {
      // Create groom assignment but with low bond
      await prisma.groomAssignment.create({
        data: {
          groomId: testGroom.id,
          foalId: testHorse.id,
          userId: testUser.id,
          startDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          priority: 5,
          notes: 'Test assignment with low bond',
        },
      });

      // Create minimal interactions (bond < 60)
      await prisma.groomInteraction.create({
        data: {
          groomId: testGroom.id,
          foalId: testHorse.id, // GroomInteraction uses foalId
          interactionType: 'grooming',
          duration: 15,
          bondingChange: 3, // GroomInteraction uses bondingChange
          stressChange: -1, // GroomInteraction uses stressChange
          quality: 'fair', // GroomInteraction uses quality
          cost: 25.0,
          notes: 'Low bond interaction',
          timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        },
      });

      const { calculateTraitProbabilityWithBonus } = await import(
        '../utils/traitAssignmentLogic.mjs'
      );

      const baseProbability = 0.1;
      const result = await calculateTraitProbabilityWithBonus(
        testHorse.id,
        'sensitive',
        baseProbability,
        testGroom.id
      );

      expect(result.finalProbability).toBe(0.1); // No bonus applied
      expect(result.bonusApplied).toBe(false);
      expect(result.reason).toBe('Bond score too low');
    });

    it('should not apply bonus when coverage is insufficient', async () => {
      // Create groom assignment with insufficient coverage (< 75%)
      await prisma.groomAssignment.create({
        data: {
          groomId: testGroom.id,
          foalId: testHorse.id,
          userId: testUser.id,
          startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // Only 10 days
          endDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          priority: 5,
          notes: 'Test assignment with insufficient coverage',
        },
      });

      // Create enough interactions to have good bond score but insufficient coverage
      for (let i = 0; i < 15; i++) {
        await prisma.groomInteraction.create({
          data: {
            groomId: testGroom.id,
            foalId: testHorse.id,
            interactionType: 'enrichment',
            duration: 30,
            bondingChange: 8, // High bonding to ensure bond > 60
            stressChange: -2,
            quality: 'excellent',
            cost: 25.0,
            notes: `High bond interaction ${i + 1}`,
            timestamp: new Date(Date.now() - (8 - i * 0.5) * 24 * 60 * 60 * 1000), // Spread over short period
          },
        });
      }

      const { calculateTraitProbabilityWithBonus } = await import(
        '../utils/traitAssignmentLogic.mjs'
      );

      const baseProbability = 0.1;
      const result = await calculateTraitProbabilityWithBonus(
        testHorse.id,
        'sensitive',
        baseProbability,
        testGroom.id
      );

      expect(result.finalProbability).toBe(0.1); // No bonus applied
      expect(result.bonusApplied).toBe(false);
      expect(result.reason).toBe('Insufficient assignment coverage');
    });
  });

  describe('API Endpoints', () => {
    it('should get groom bonus traits via API', async () => {
      const response = await request(app)
        .get(`/api/grooms/${testGroom.id}/bonus-traits`)
        .set('Authorization', authToken)
        .set('x-test-skip-csrf', 'true');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.bonusTraits).toEqual({
        sensitive: 0.2,
        noble: 0.1,
        quick_learner: 0.15,
      });
    });

    it('should update groom bonus traits via API', async () => {
      const newBonusTraits = {
        confident: 0.25,
        athletic: 0.15,
      };

      const response = await request(app)
        .put(`/api/grooms/${testGroom.id}/bonus-traits`)
        .set('Authorization', authToken)
        .set('x-test-skip-csrf', 'true')
        .send({ bonusTraits: newBonusTraits });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.bonusTraits).toEqual(newBonusTraits);

      // Verify in database
      const updatedGroom = await prisma.groom.findUnique({
        where: { id: testGroom.id },
        select: { bonusTraitMap: true },
      });

      expect(updatedGroom.bonusTraitMap).toEqual(newBonusTraits);
    });

    it('should reject invalid bonus trait updates', async () => {
      const invalidBonusTraits = {
        trait1: 0.35, // Exceeds 30% limit
      };

      const response = await request(app)
        .put(`/api/grooms/${testGroom.id}/bonus-traits`)
        .set('Authorization', authToken)
        .set('x-test-skip-csrf', 'true')
        .send({ bonusTraits: invalidBonusTraits });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Bonus trait constraints violated');
    });

    it('should require authentication for bonus trait endpoints', async () => {
      const response = await request(app)
        .get(`/api/grooms/${testGroom.id}/bonus-traits`)
        .set('x-test-require-auth', 'true');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});
