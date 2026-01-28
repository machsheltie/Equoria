/**
 * Breeding Prediction Test Suite
 *
 * Tests the breeding prediction system that provides epigenetic preview functionality
 * for the breeding screen. This system analyzes parent trait development history to
 * predict trait and flag inheritance probabilities for potential offspring.
 *
 * Features tested:
 * - Inheritance probability logic based on trait_history_log
 * - Trait summary generation for breeding parents
 * - Flag inheritance score calculation
 * - Epigenetic flag analysis and inheritance prediction
 * - Temperament and influence modifier calculations
 * - Child prediction algorithms with probability ranges
 * - API extension for /api/horses/:id/breeding-data
 *
 * Testing approach: Real database operations with zero mocking to validate actual business logic
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.mjs';
import prisma from '../db/index.mjs';

describe('Breeding Prediction System', () => {
  let testUser;
  let testStallion;
  let testMare;
  let testBreed;
  let testGroom;
  let authToken;

  beforeEach(async () => {
    // Create test breed
    testBreed = await prisma.breed.create({
      data: {
        name: `TestBreed_${Date.now()}`,
        description: 'Test breed for breeding prediction tests',
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

    // Create test stallion (5 years old)
    testStallion = await prisma.horse.create({
      data: {
        name: `TestStallion_${Date.now()}`,
        sex: 'stallion',
        dateOfBirth: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000), // 5 years old
        temperament: 'spirited',
        ownerId: testUser.id,
        breedId: testBreed.id,
        sireId: null,
        damId: null,
        epigeneticModifiers: { positive: ['sensitive', 'noble'], negative: [], hidden: ['quick_learner'] },
      },
    });

    // Create test mare (4 years old)
    testMare = await prisma.horse.create({
      data: {
        name: `TestMare_${Date.now()}`,
        sex: 'mare',
        dateOfBirth: new Date(Date.now() - 4 * 365 * 24 * 60 * 60 * 1000), // 4 years old
        temperament: 'calm',
        ownerId: testUser.id,
        breedId: testBreed.id,
        sireId: null,
        damId: null,
        epigeneticModifiers: { positive: ['athletic', 'confident'], negative: ['stubborn'], hidden: [] },
      },
    });

    // Create auth token
    const tokenPayload = {
      id: testUser.id,
      username: testUser.username,
      email: testUser.email,
    };
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only-32chars', { expiresIn: '1h' });
    authToken = `Bearer ${token}`;
  });

  afterEach(async () => {
    // Clean up test data
    if (testStallion) {
      await prisma.horse.delete({ where: { id: testStallion.id } });
    }
    if (testMare) {
      await prisma.horse.delete({ where: { id: testMare.id } });
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

  describe('Inheritance Probability Logic', () => {
    it('should calculate trait inheritance probabilities from parent history', async () => {
      // Create trait history for stallion
      const stallionTraits = [
        { traitName: 'sensitive', sourceType: 'milestone', ageInDays: 30, isEpigenetic: true },
        { traitName: 'noble', sourceType: 'groom', ageInDays: 60, isEpigenetic: true },
        { traitName: 'quick_learner', sourceType: 'milestone', ageInDays: 180, isEpigenetic: true },
      ];

      for (const trait of stallionTraits) {
        await prisma.traitHistoryLog.create({
          data: {
            horseId: testStallion.id,
            traitName: trait.traitName,
            sourceType: trait.sourceType,
            isEpigenetic: trait.isEpigenetic,
            ageInDays: trait.ageInDays,
            groomId: trait.sourceType === 'groom' ? testGroom.id : null,
            bondScore: 80,
            stressLevel: 20,
            influenceScore: 6,
          },
        });
      }

      // Create trait history for mare
      const mareTraits = [
        { traitName: 'athletic', sourceType: 'environmental', ageInDays: 365, isEpigenetic: false },
        { traitName: 'confident', sourceType: 'milestone', ageInDays: 90, isEpigenetic: true },
        { traitName: 'stubborn', sourceType: 'environmental', ageInDays: 200, isEpigenetic: false },
      ];

      for (const trait of mareTraits) {
        await prisma.traitHistoryLog.create({
          data: {
            horseId: testMare.id,
            traitName: trait.traitName,
            sourceType: trait.sourceType,
            isEpigenetic: trait.isEpigenetic,
            ageInDays: trait.ageInDays,
            groomId: null,
            bondScore: 75,
            stressLevel: 25,
            influenceScore: trait.traitName === 'stubborn' ? -2 : 5,
          },
        });
      }

      // Test will fail initially - need to implement breedingPredictionService
      const { calculateInheritanceProbabilities } = await import('../services/breedingPredictionService.mjs');

      const predictions = await calculateInheritanceProbabilities(testStallion.id, testMare.id);

      expect(predictions.stallionId).toBe(testStallion.id);
      expect(predictions.mareId).toBe(testMare.id);
      expect(predictions.traitProbabilities).toBeDefined();
      expect(predictions.traitProbabilities.length).toBeGreaterThan(0);

      // Check specific trait inheritance
      const sensitiveInheritance = predictions.traitProbabilities.find(t => t.traitName === 'sensitive');
      expect(sensitiveInheritance).toBeDefined();
      expect(sensitiveInheritance.probability).toBeGreaterThan(0);
      expect(sensitiveInheritance.probability).toBeLessThanOrEqual(50); // Max 50% without stacking

      expect(predictions.summary.totalTraitsConsidered).toBe(6);
      expect(predictions.summary.epigeneticTraits).toBe(4);
      expect(predictions.summary.averageInheritanceChance).toBeGreaterThan(0);
    });

    it('should calculate flag inheritance scores', async () => {
      // Create trait history that would generate flags
      await prisma.traitHistoryLog.create({
        data: {
          horseId: testStallion.id,
          traitName: 'sensitive',
          sourceType: 'milestone',
          isEpigenetic: true,
          ageInDays: 7,
          groomId: testGroom.id,
          bondScore: 90,
          stressLevel: 10,
          influenceScore: 8,
        },
      });

      await prisma.traitHistoryLog.create({
        data: {
          horseId: testMare.id,
          traitName: 'empathic',
          sourceType: 'groom',
          isEpigenetic: true,
          ageInDays: 14,
          groomId: testGroom.id,
          bondScore: 85,
          stressLevel: 15,
          influenceScore: 7,
        },
      });

      const { calculateFlagInheritanceScore } = await import('../services/breedingPredictionService.mjs');

      const flagScore = await calculateFlagInheritanceScore(testStallion.id, testMare.id);

      expect(flagScore.stallionFlags).toBeDefined();
      expect(flagScore.mareFlags).toBeDefined();
      expect(flagScore.combinedScore).toBeGreaterThan(0);
      expect(flagScore.inheritanceCategories).toBeDefined();
      expect(flagScore.inheritanceCategories.empathy).toBeGreaterThan(0);
    });

    it('should handle horses with no trait history', async () => {
      // Test horses with no traits
      const { calculateInheritanceProbabilities } = await import('../services/breedingPredictionService.mjs');

      const predictions = await calculateInheritanceProbabilities(testStallion.id, testMare.id);

      expect(predictions.stallionId).toBe(testStallion.id);
      expect(predictions.mareId).toBe(testMare.id);
      expect(predictions.traitProbabilities).toHaveLength(0);
      expect(predictions.summary.totalTraitsConsidered).toBe(0);
      expect(predictions.summary.averageInheritanceChance).toBe(0);
      expect(predictions.hasInsufficientData).toBe(true);
    });

    it('should calculate temperament influence modifiers', async () => {
      // Create trait history with temperament-related traits
      await prisma.traitHistoryLog.create({
        data: {
          horseId: testStallion.id,
          traitName: 'bold',
          sourceType: 'milestone',
          isEpigenetic: true,
          ageInDays: 45,
          groomId: null,
          bondScore: 70,
          stressLevel: 30,
          influenceScore: 5,
        },
      });

      await prisma.traitHistoryLog.create({
        data: {
          horseId: testMare.id,
          traitName: 'gentle',
          sourceType: 'groom',
          isEpigenetic: true,
          ageInDays: 60,
          groomId: testGroom.id,
          bondScore: 85,
          stressLevel: 15,
          influenceScore: 6,
        },
      });

      const { calculateTemperamentInfluence } = await import('../services/breedingPredictionService.mjs');

      const influence = await calculateTemperamentInfluence(testStallion.id, testMare.id);

      expect(influence.stallionTemperament).toBe('spirited');
      expect(influence.mareTemperament).toBe('calm');
      expect(influence.compatibilityScore).toBeGreaterThan(0);
      expect(influence.predictedOffspringTemperament).toBeDefined();
      expect(influence.traitInfluenceModifiers).toBeDefined();
      expect(influence.traitInfluenceModifiers.boldness).toBeDefined();
      expect(influence.traitInfluenceModifiers.empathy).toBeDefined();
    });
  });

  describe('Child Prediction Algorithms', () => {
    it('should predict trait categories with probability ranges', async () => {
      // Create diverse trait history for both parents
      const parentTraits = [
        { horseId: testStallion.id, traitName: 'sensitive', category: 'empathy' },
        { horseId: testStallion.id, traitName: 'bold', category: 'boldness' },
        { horseId: testMare.id, traitName: 'gentle', category: 'empathy' },
        { horseId: testMare.id, traitName: 'athletic', category: 'physical' },
      ];

      for (const trait of parentTraits) {
        await prisma.traitHistoryLog.create({
          data: {
            horseId: trait.horseId,
            traitName: trait.traitName,
            sourceType: 'milestone',
            isEpigenetic: true,
            ageInDays: 100,
            groomId: null,
            bondScore: 75,
            stressLevel: 25,
            influenceScore: 5,
          },
        });
      }

      const { predictOffspringTraits } = await import('../services/breedingPredictionService.mjs');

      const prediction = await predictOffspringTraits(testStallion.id, testMare.id);

      expect(prediction.categoryProbabilities).toBeDefined();
      expect(prediction.categoryProbabilities.empathy).toBeGreaterThan(0);
      expect(prediction.categoryProbabilities.boldness).toBeGreaterThan(0);
      expect(prediction.categoryProbabilities.physical).toBeGreaterThan(0);

      expect(prediction.estimatedTraitCount).toBeDefined();
      expect(prediction.estimatedTraitCount.min).toBeGreaterThanOrEqual(0);
      expect(prediction.estimatedTraitCount.max).toBeGreaterThan(prediction.estimatedTraitCount.min);

      expect(prediction.confidenceLevel).toBeDefined();
      expect(prediction.isEstimate).toBe(true);
    });

    it('should handle epigenetic flag inheritance with stacking limits', async () => {
      // Create matching epigenetic traits in both parents
      const matchingTraits = ['sensitive', 'noble'];

      for (const traitName of matchingTraits) {
        await prisma.traitHistoryLog.create({
          data: {
            horseId: testStallion.id,
            traitName,
            sourceType: 'milestone',
            isEpigenetic: true,
            ageInDays: 30,
            groomId: null,
            bondScore: 80,
            stressLevel: 20,
            influenceScore: 6,
          },
        });

        await prisma.traitHistoryLog.create({
          data: {
            horseId: testMare.id,
            traitName,
            sourceType: 'groom',
            isEpigenetic: true,
            ageInDays: 45,
            groomId: testGroom.id,
            bondScore: 85,
            stressLevel: 15,
            influenceScore: 7,
          },
        });
      }

      const { calculateInheritanceProbabilities } = await import('../services/breedingPredictionService.mjs');

      const predictions = await calculateInheritanceProbabilities(testStallion.id, testMare.id);

      // Check that trait stacking increases probability but caps at reasonable limits
      const sensitiveInheritance = predictions.traitProbabilities.find(t => t.traitName === 'sensitive');
      expect(sensitiveInheritance.probability).toBeGreaterThan(25); // Higher due to both parents
      expect(sensitiveInheritance.probability).toBeLessThanOrEqual(75); // But capped
      expect(sensitiveInheritance.hasStacking).toBe(true);
      expect(sensitiveInheritance.stackingBonus).toBeGreaterThan(0);
    });
  });

  describe('API Extension', () => {
    it('should extend breeding-data endpoint with prediction data', async () => {
      // Create some trait history
      await prisma.traitHistoryLog.create({
        data: {
          horseId: testStallion.id,
          traitName: 'noble',
          sourceType: 'milestone',
          isEpigenetic: true,
          ageInDays: 60,
          groomId: testGroom.id,
          bondScore: 85,
          stressLevel: 15,
          influenceScore: 7,
        },
      });

      const response = await request(app)
        .get(`/api/horses/${testStallion.id}/breeding-data`)
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.breedingData).toBeDefined();
      expect(response.body.data.breedingData.traitSummary).toBeDefined();
      expect(response.body.data.breedingData.flagInheritanceScore).toBeDefined();
      expect(response.body.data.breedingData.epigeneticFlags).toBeDefined();
      expect(response.body.data.breedingData.temperamentInfluence).toBeDefined();
    });

    it('should require authentication for breeding-data endpoint', async () => {
      const response = await request(app)
        .get(`/api/horses/${testStallion.id}/breeding-data`)
        .set('x-test-require-auth', 'true');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should handle horses with minimal breeding data', async () => {
      const response = await request(app)
        .get(`/api/horses/${testStallion.id}/breeding-data`)
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.breedingData.traitSummary.totalTraits).toBe(0);
      expect(response.body.data.breedingData.hasInsufficientData).toBe(true);
    });
  });
});
