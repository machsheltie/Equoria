/**
 * Legacy Score Trait Integration Test Suite
 *
 * Tests the integration of trait scoring into the legacy score calculation system.
 * This system incorporates the depth and quality of a horse's trait development
 * into its final Legacy Score, influencing its value as a breeder and prestige record.
 *
 * Features tested:
 * - Trait score calculation based on count, diversity, rarity, and groom care consistency
 * - Integration with existing trait history and milestone evaluation data
 * - Legacy score calculation with trait scoring component
 * - API endpoints for legacy score retrieval with trait breakdown
 * - Business rules enforcement (traits before age 4, negative trait penalties)
 *
 * Testing approach: Real database operations with zero mocking to validate actual business logic
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.mjs';
import prisma from '../db/index.mjs';

describe('Legacy Score Trait Integration System', () => {
  let testUser;
  let testHorse;
  let testBreed;
  let testGroom;
  let authToken;

  beforeEach(async () => {
    // Create test breed
    testBreed = await prisma.breed.create({
      data: {
        name: `TestBreed_${Date.now()}`,
        description: 'Test breed for legacy score tests',
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

    // Create test groom
    testGroom = await prisma.groom.create({
      data: {
        name: `TestGroom_${Date.now()}`,
        speciality: 'foal_care',
        experience: 10,
        skillLevel: 'expert',
        personality: 'calm',
        groomPersonality: 'calm',
        sessionRate: 25.0,
        userId: testUser.id,
      },
    });

    // Create test horse (4 years old to test legacy score calculation)
    testHorse = await prisma.horse.create({
      data: {
        name: `TestHorse_${Date.now()}`,
        sex: 'stallion',
        dateOfBirth: new Date(Date.now() - 4 * 365 * 24 * 60 * 60 * 1000), // 4 years old
        temperament: 'spirited',
        userId: testUser.id,
        breedId: testBreed.id,
        epigeneticModifiers: { positive: [], negative: [], hidden: [] },
        // Add some base stats for legacy score calculation
        speed: 75,
        stamina: 80,
        agility: 70,
        balance: 85,
        precision: 90,
        intelligence: 88,
        boldness: 65,
        flexibility: 72,
        obedience: 95,
        focus: 82,
      },
    });

    // Create auth token
    const tokenPayload = {
      id: testUser.id,
      username: testUser.username,
      email: testUser.email,
    };
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only-32chars', {
      expiresIn: '1h',
    });
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

  describe('Trait Score Calculation', () => {
    it('should calculate trait score based on count, diversity, and rarity', async () => {
      // Create diverse trait history for the horse (before age 4)
      const traitHistory = [
        { traitName: 'sensitive', sourceType: 'milestone', isEpigenetic: true, ageInDays: 30 },
        { traitName: 'noble', sourceType: 'groom', isEpigenetic: true, ageInDays: 60 },
        { traitName: 'quick_learner', sourceType: 'milestone', isEpigenetic: true, ageInDays: 365 },
        { traitName: 'athletic', sourceType: 'environmental', isEpigenetic: false, ageInDays: 730 },
        { traitName: 'confident', sourceType: 'groom', isEpigenetic: true, ageInDays: 1095 }, // 3 years
      ];

      for (const trait of traitHistory) {
        await prisma.traitHistoryLog.create({
          data: {
            horseId: testHorse.id,
            traitName: trait.traitName,
            sourceType: trait.sourceType,
            isEpigenetic: trait.isEpigenetic,
            ageInDays: trait.ageInDays,
            groomId: trait.sourceType === 'groom' ? testGroom.id : null,
            bondScore: 75,
            stressLevel: 20,
            influenceScore: 5,
          },
        });
      }

      // Test will fail initially - need to implement legacyScoreTraitCalculator
      const { calculateTraitScore } = await import('../services/legacyScoreTraitCalculator.mjs');

      const traitScore = await calculateTraitScore(testHorse.id);

      // Expected scoring:
      // - Trait count: 5 traits = 5 points (max 10)
      // - Diversity: 3 different source types = 3 points (max 5)
      // - Rare traits: 2 rare traits (sensitive, noble) = 6 points (max 10)
      // - Groom care consistency: No milestone data = 0 points (max 5)
      // Total expected: ~14 points (max 25)

      expect(traitScore.totalScore).toBeGreaterThanOrEqual(14);
      expect(traitScore.totalScore).toBeLessThanOrEqual(25);
      expect(traitScore.breakdown.traitCount).toBe(5);
      expect(traitScore.breakdown.diversity).toBeGreaterThanOrEqual(3);
      expect(traitScore.breakdown.rareTraits).toBeGreaterThan(0);
      expect(traitScore.breakdown.groomCareConsistency).toBeGreaterThanOrEqual(0);
    });

    it('should apply negative trait penalties', async () => {
      // Create trait history with negative traits
      const traitHistory = [
        { traitName: 'sensitive', sourceType: 'milestone', isEpigenetic: true, ageInDays: 30 },
        { traitName: 'stubborn', sourceType: 'milestone', isEpigenetic: true, ageInDays: 60 }, // negative trait
        { traitName: 'anxious', sourceType: 'environmental', isEpigenetic: false, ageInDays: 365 }, // negative trait
      ];

      for (const trait of traitHistory) {
        await prisma.traitHistoryLog.create({
          data: {
            horseId: testHorse.id,
            traitName: trait.traitName,
            sourceType: trait.sourceType,
            isEpigenetic: trait.isEpigenetic,
            ageInDays: trait.ageInDays,
            groomId: null,
            bondScore: 50,
            stressLevel: 40,
            influenceScore: trait.traitName === 'sensitive' ? 5 : -3,
          },
        });
      }

      const { calculateTraitScore } = await import('../services/legacyScoreTraitCalculator.mjs');

      const traitScore = await calculateTraitScore(testHorse.id);

      // Should have penalties for negative traits
      expect(traitScore.breakdown.negativeTraitPenalty).toBeLessThan(0);
      expect(traitScore.totalScore).toBeLessThan(10); // Lower due to negative traits
    });

    it('should only count traits gained before age 4', async () => {
      // Create trait history with traits after age 4
      const traitHistory = [
        { traitName: 'sensitive', sourceType: 'milestone', isEpigenetic: true, ageInDays: 30 }, // Before age 4
        { traitName: 'noble', sourceType: 'groom', isEpigenetic: true, ageInDays: 365 }, // Before age 4
        { traitName: 'late_trait', sourceType: 'environmental', isEpigenetic: false, ageInDays: 1500 }, // After age 4 (4+ years)
      ];

      for (const trait of traitHistory) {
        await prisma.traitHistoryLog.create({
          data: {
            horseId: testHorse.id,
            traitName: trait.traitName,
            sourceType: trait.sourceType,
            isEpigenetic: trait.isEpigenetic,
            ageInDays: trait.ageInDays,
            groomId: trait.sourceType === 'groom' ? testGroom.id : null,
            bondScore: 75,
            stressLevel: 20,
            influenceScore: 5,
          },
        });
      }

      const { calculateTraitScore } = await import('../services/legacyScoreTraitCalculator.mjs');

      const traitScore = await calculateTraitScore(testHorse.id);

      // Should only count 2 traits (before age 4), not 3
      expect(traitScore.breakdown.traitCount).toBe(2);
      expect(traitScore.breakdown.traitsConsidered).toHaveLength(2);
      expect(traitScore.breakdown.traitsExcluded).toHaveLength(1);
    });

    it('should calculate groom care consistency from milestone logs', async () => {
      // Create milestone trait logs with varying groom care quality
      const milestoneData = [
        { milestoneType: 'imprinting', taskConsistency: 8, taskDiversity: 6, bondScore: 80 },
        { milestoneType: 'socialization', taskConsistency: 9, taskDiversity: 7, bondScore: 85 },
        { milestoneType: 'curiosity_play', taskConsistency: 7, taskDiversity: 5, bondScore: 75 },
      ];

      for (const milestone of milestoneData) {
        await prisma.milestoneTraitLog.create({
          data: {
            horseId: testHorse.id,
            milestoneType: milestone.milestoneType,
            score: 5,
            finalTrait: 'test_trait',
            groomId: testGroom.id,
            bondScore: milestone.bondScore,
            taskConsistency: milestone.taskConsistency,
            taskDiversity: milestone.taskDiversity,
            ageInDays: 100,
          },
        });
      }

      // Add corresponding trait history
      await prisma.traitHistoryLog.create({
        data: {
          horseId: testHorse.id,
          traitName: 'well_cared_for',
          sourceType: 'milestone',
          isEpigenetic: true,
          ageInDays: 100,
          groomId: testGroom.id,
          bondScore: 80,
          stressLevel: 15,
          influenceScore: 5,
        },
      });

      const { calculateTraitScore } = await import('../services/legacyScoreTraitCalculator.mjs');

      const traitScore = await calculateTraitScore(testHorse.id);

      // Should have good groom care consistency score
      expect(traitScore.breakdown.groomCareConsistency).toBeGreaterThan(2);
      expect(traitScore.breakdown.milestoneData).toHaveLength(3);
    });
  });

  describe('Legacy Score Integration', () => {
    it('should integrate trait score into overall legacy score', async () => {
      // Create trait history
      await prisma.traitHistoryLog.create({
        data: {
          horseId: testHorse.id,
          traitName: 'exceptional',
          sourceType: 'milestone',
          isEpigenetic: true,
          ageInDays: 365,
          groomId: testGroom.id,
          bondScore: 90,
          stressLevel: 10,
          influenceScore: 8,
        },
      });

      // Test will fail initially - need to implement legacy score calculator
      const { calculateLegacyScore } = await import('../services/legacyScoreCalculator.mjs');

      const legacyScore = await calculateLegacyScore(testHorse.id);

      expect(legacyScore.totalScore).toBeGreaterThan(0);
      expect(legacyScore.components.traitScore).toBeDefined();
      expect(legacyScore.components.traitScore.score).toBeGreaterThan(0);
      expect(legacyScore.components.traitScore.maxScore).toBe(25);
      expect(legacyScore.breakdown.traitScoring).toBeDefined();
    });

    it('should calculate legacy score without traits', async () => {
      // Test horse with no trait history
      const { calculateLegacyScore } = await import('../services/legacyScoreCalculator.mjs');

      const legacyScore = await calculateLegacyScore(testHorse.id);

      expect(legacyScore.totalScore).toBeGreaterThan(0);
      expect(legacyScore.components.traitScore.score).toBe(0);
      expect(legacyScore.components.baseStats).toBeDefined();
      expect(legacyScore.components.achievements).toBeDefined();
    });
  });

  describe('API Endpoints', () => {
    it('should get horse legacy score via API', async () => {
      // Create some trait history
      await prisma.traitHistoryLog.create({
        data: {
          horseId: testHorse.id,
          traitName: 'noble',
          sourceType: 'milestone',
          isEpigenetic: true,
          ageInDays: 200,
          groomId: testGroom.id,
          bondScore: 85,
          stressLevel: 15,
          influenceScore: 6,
        },
      });

      const response = await request(app)
        .get(`/api/horses/${testHorse.id}/legacy-score`)
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.legacyScore).toBeDefined();
      expect(response.body.data.legacyScore.totalScore).toBeGreaterThan(0);
      expect(response.body.data.legacyScore.components.traitScore).toBeDefined();
    });

    it('should require authentication for legacy score endpoint', async () => {
      const response = await request(app)
        .get(`/api/horses/${testHorse.id}/legacy-score`)
        .set('x-test-require-auth', 'true');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent horse', async () => {
      const response = await request(app).get('/api/horses/99999/legacy-score').set('Authorization', authToken);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });
});
