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
 * - API extension for /api/v1/horses/:id/breeding-data
 *
 * Testing approach: Real database operations with zero mocking to validate actual business logic
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';

import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';

describe('Breeding Prediction System', () => {
  let __csrf__;
  beforeAll(async () => {
    __csrf__ = await fetchCsrf(app);
  }, 120000); // 120s — DB operations can be slow under full-suite --runInBand load

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
        name: `TestBreed_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
        description: 'Test breed for breeding prediction tests',
      },
    });

    // Create test user
    testUser = await prisma.user.create({
      data: {
        username: `testuser_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
        firstName: 'Test',
        lastName: 'User',
        email: `test_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}@example.com`,
        password: 'hashedpassword',
        money: 10000,
        xp: 100,
        level: 2,
      },
    });

    // Create test groom
    testGroom = await prisma.groom.create({
      data: {
        name: `TestGroom_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
        speciality: 'foal_care',
        experience: 10,
        skillLevel: 'expert',
        personality: 'calm',
        epigeneticInfluenceType: 'calm',
        sessionRate: 25.0,
        userId: testUser.id,
      },
    });

    // Create test stallion (5 years old)
    testStallion = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestStallion_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
        sex: 'stallion',
        dateOfBirth: gameCalendarDate(new Date(), -5 * 365), // 5 years old
        temperament: 'spirited',
        userId: testUser.id,
        breedId: testBreed.id,
        epigeneticModifiers: { positive: ['sensitive', 'noble'], negative: [], hidden: ['quick_learner'] },
      },
    });

    // Create test mare (4 years old)
    testMare = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestMare_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
        sex: 'mare',
        dateOfBirth: gameCalendarDate(new Date(), -4 * 365), // 4 years old
        temperament: 'calm',
        userId: testUser.id,
        breedId: testBreed.id,
        epigeneticModifiers: { positive: ['athletic', 'confident'], negative: ['stubborn'], hidden: [] },
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
  }, 120000); // 120s — DB operations can be slow under full-suite --runInBand load

  afterEach(async () => {
    // Clean up test data - use try/catch for each operation to prevent cascade failures
    // in parallel test execution where records may have already been cleaned up
    if (testStallion) {
      try {
        await prisma.horse.deleteMany({ where: { id: testStallion.id } });
      } catch {
        // Record may not exist if parallel tests already cleaned it up
      }
    }
    if (testMare) {
      try {
        await prisma.horse.deleteMany({ where: { id: testMare.id } });
      } catch {
        // Record may not exist if parallel tests already cleaned it up
      }
    }
    if (testGroom) {
      try {
        await prisma.groom.deleteMany({ where: { id: testGroom.id } });
      } catch {
        // Record may not exist if parallel tests already cleaned it up
      }
    }
    if (testUser) {
      try {
        await prisma.user.deleteMany({ where: { id: testUser.id } });
      } catch {
        // Record may not exist if parallel tests already cleaned it up
      }
    }
    if (testBreed) {
      try {
        await prisma.breed.deleteMany({ where: { id: testBreed.id } });
      } catch {
        // Record may not exist if parallel tests already cleaned it up
      }
    }
  }, 120000); // 120s — DB operations can be slow under full-suite --runInBand load

  // The pair inheritance / flag inheritance / offspring prediction tests were
  // deleted with calculateInheritanceProbabilities, calculateFlagInheritanceScore
  // and predictOffspringTraits (owner ruling 2026-10-19, Equoria-6dace).
  describe('Inheritance Probability Logic', () => {
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
        .get(`/api/v1/horses/${testStallion.id}/breeding-data`)
        .set('Origin', 'http://localhost:3000')
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
        .get(`/api/v1/horses/${testStallion.id}/breeding-data`)
        .set('Origin', 'http://localhost:3000');
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should handle horses with minimal breeding data', async () => {
      const response = await request(app)
        .get(`/api/v1/horses/${testStallion.id}/breeding-data`)
        .set('Origin', 'http://localhost:3000')
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.breedingData.traitSummary.totalTraits).toBe(0);
      expect(response.body.data.breedingData.hasInsufficientData).toBe(true);
    });
  });
});
