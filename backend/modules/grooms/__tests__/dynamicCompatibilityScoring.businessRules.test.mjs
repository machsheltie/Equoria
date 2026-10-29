/**
 * Dynamic Compatibility Scoring Tests
 *
 * Tests advanced real-time compatibility analysis between groom personalities and horse temperaments.
 * Uses TDD approach with NO MOCKING - real database operations for authentic validation.
 *
 * Business Rules Tested:
 * - Real-time compatibility scoring with contextual factors
 * - Environmental and situational modifiers
 * - Historical performance integration
 * - Adaptive scoring based on interaction outcomes
 * - Multi-factor compatibility analysis
 * - Predictive compatibility modeling
 *
 * CONTRACT CHANGED BY THE OWNER, 2026-10-29 (q300, Equoria-efs4j): the old
 * epigeneticFlags store is dropped with every reader. Old contract: the three
 * horses carried flags (fearful/reactive/insecure, brave/confident/social,
 * curious/calm) and four cases below pinned flag-driven results (energetic +
 * fearful < 0.4 and 'not_recommended', methodical + curious/calm under 0.8,
 * 'energetic'/'fearful' risk factors, a bonding prediction under 2). New
 * contract: every horse is flagless, so those cases pin the no-flag values a
 * flagless horse always got: base compatibility 0.6 for every pair.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { randomBytes } from 'node:crypto';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import {
  analyzeCompatibilityFactors,
  compatibilityTrends,
  predictInteraction,
  scoreCompatibility,
} from '../services/dynamicCompatibilityScoring.mjs';
import { analyzePair, rankFor } from './helpers/dynamicCompatibilityGrid.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';

describe('Dynamic Compatibility Scoring', () => {
  let testUser;
  let testGrooms = [];
  let testHorses = [];

  beforeAll(async () => {
    // Create test horses with different temperaments
    const now = new Date();
    const oneMonthAgo = gameCalendarDate(now, -30);

    await prisma.$transaction(
      async tx => {
        // Create test user
        testUser = await tx.user.create({
          data: {
            emailVerified: true,
            username: `compatibility_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
            email: `compatibility_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}@test.com`,
            password: 'testHash',
            firstName: 'Test',
            lastName: 'User',
            money: 1000,
            xp: 0,
            level: 1,
          },
        });

        // Create test grooms with different personalities and experience levels
        testGrooms = await Promise.all([
          // Expert calm groom
          tx.groom.create({
            data: {
              name: `Expert Calm Groom ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
              personality: 'calm',
              epigeneticInfluenceType: 'calm',
              skillLevel: 'expert',
              speciality: 'foalCare',
              userId: testUser.id,
              sessionRate: 35.0,
              experience: 200,
            },
          }),
          // Novice energetic groom
          tx.groom.create({
            data: {
              name: `Novice Energetic Groom ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
              personality: 'energetic',
              epigeneticInfluenceType: 'energetic',
              skillLevel: 'novice',
              speciality: 'generalGrooming',
              userId: testUser.id,
              sessionRate: 15.0,
              experience: 20,
            },
          }),
          // Experienced methodical groom
          tx.groom.create({
            data: {
              name: `Experienced Methodical Groom ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
              personality: 'methodical',
              epigeneticInfluenceType: 'methodical',
              skillLevel: 'experienced',
              speciality: 'foalCare',
              userId: testUser.id,
              sessionRate: 28.0,
              experience: 120,
            },
          }),
        ]);

        testHorses = await Promise.all([
          // Fearful horse
          tx.horse.create({
            data: {
              ...fixtureColor(),
              name: `Test Horse Fearful ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
              sex: 'filly',
              dateOfBirth: oneMonthAgo,
              userId: testUser.id,
              bondScore: 8,
            },
          }),
          // Confident social horse
          tx.horse.create({
            data: {
              ...fixtureColor(),
              name: `Test Horse Confident ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
              sex: 'colt',
              dateOfBirth: oneMonthAgo,
              userId: testUser.id,
              bondScore: 38,
            },
          }),
          // Moderate temperament horse
          tx.horse.create({
            data: {
              ...fixtureColor(),
              name: `Test Horse Moderate ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
              sex: 'Colt',
              dateOfBirth: oneMonthAgo,
              userId: testUser.id,
              bondScore: 25,
            },
          }),
        ]);
      },
      { timeout: 30000 },
    );
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.groomInteraction.deleteMany({
      where: { groomId: { in: testGrooms.map(g => g.id) } },
    });
    await prisma.groomAssignment.deleteMany({
      where: { groomId: { in: testGrooms.map(g => g.id) } },
    });
    await prisma.groom.deleteMany({
      where: { id: { in: testGrooms.map(g => g.id) } },
    });
    await prisma.horse.deleteMany({
      where: { id: { in: testHorses.map(h => h.id) } },
    });
    if (testUser) {
      await prisma.user.deleteMany({ where: { id: testUser.id } });
    }
  });

  describe('calculateDynamicCompatibility', () => {
    test('should calculate high compatibility for calm groom with fearful horse', async () => {
      const [calmGroom] = testGrooms; // Expert calm groom
      const [fearfulHorse] = testHorses; // Fearful horse

      const context = {
        taskType: 'trustBuilding',
        timeOfDay: 'morning',
        environmentalFactors: ['quiet', 'familiar'],
        recentInteractions: [],
      };

      const compatibility = await analyzePair(calmGroom.id, fearfulHorse.id, scoreCompatibility, context);

      expect(compatibility).toBeDefined();
      expect(compatibility.overallScore).toBeGreaterThan(0.7); // High compatibility
      expect(compatibility.baseCompatibility).toBeDefined();
      expect(compatibility.contextualModifiers).toBeDefined();
      expect(compatibility.experienceBonus).toBeDefined();
      expect(compatibility.taskSpecificModifier).toBeDefined();
      expect(compatibility.confidence).toBeGreaterThan(0.8);

      // Should identify this as an excellent match
      expect(compatibility.recommendationLevel).toBe('highly_recommended');
    });

    test('should calculate low compatibility for energetic groom with fearful horse', async () => {
      const energeticGroom = testGrooms[1]; // Novice energetic groom
      const [fearfulHorse] = testHorses; // Fearful horse

      const context = {
        taskType: 'trustBuilding',
        timeOfDay: 'afternoon',
        environmentalFactors: ['noisy', 'unfamiliar'],
        recentInteractions: [],
      };

      const compatibility = await analyzePair(energeticGroom.id, fearfulHorse.id, scoreCompatibility, context);

      // No flags: base 0.6, then the novice's experience and the noisy, unfamiliar
      // afternoon context.
      expect(compatibility.baseCompatibility).toBe(0.6);
      expect(compatibility.overallScore).toBeCloseTo(0.423792, 6);
      expect(compatibility.recommendationLevel).toBe('acceptable');
    });

    test('should calculate moderate compatibility with contextual improvements', async () => {
      const methodicalGroom = testGrooms[2]; // Experienced methodical groom

      const moderateHorse = testHorses[2]; // Moderate temperament horse

      const context = {
        taskType: 'hoofHandling',
        timeOfDay: 'morning',
        environmentalFactors: ['quiet', 'structured'],
        recentInteractions: [],
      };

      const compatibility = await analyzePair(methodicalGroom.id, moderateHorse.id, scoreCompatibility, context);

      expect(compatibility.baseCompatibility).toBe(0.6);
      expect(compatibility.overallScore).toBeCloseTo(1.1800404, 6);
      expect(compatibility.taskSpecificModifier).toBeGreaterThan(1.0); // Methodical good for technical tasks
      expect(compatibility.recommendationLevel).toBe('highly_recommended');
    });

    test('should apply experience bonuses correctly', async () => {
      const [expertGroom] = testGrooms; // Expert level

      const noviceGroom = testGrooms[1]; // Novice level

      const horse = testHorses[1]; // Confident horse

      const context = {
        taskType: 'desensitization',
        timeOfDay: 'morning',
        environmentalFactors: ['quiet'],
        recentInteractions: [],
      };

      const expertCompatibility = await analyzePair(expertGroom.id, horse.id, scoreCompatibility, context);
      const noviceCompatibility = await analyzePair(noviceGroom.id, horse.id, scoreCompatibility, context);

      expect(expertCompatibility.experienceBonus).toBeGreaterThan(noviceCompatibility.experienceBonus);
      // Owner rulings 2026-10-28 (q229, q244; Equoria-2xxvd): the level term is the old
      // level 1 for every groom, so the two bonuses differ by the experience term alone
      // (200 vs 20 experience: 0.40 vs 0.04). Old contract: the expert's level 10 also
      // lifted its overall score above the novice's.
      expect(expertCompatibility.experienceBonus - noviceCompatibility.experienceBonus).toBeCloseTo(0.36, 10);
      expect(expertCompatibility.experienceBonus).toBeCloseTo(1 + 0.05 + 0.4, 10);
    });
  });

  describe('analyzeCompatibilityFactors', () => {
    test('should analyze all compatibility factors comprehensively', async () => {
      const [groom] = testGrooms;
      const [horse] = testHorses;

      const factors = await analyzeCompatibilityFactors(groom.id, horse.id);

      expect(factors).toBeDefined();
      expect(factors.personalityMatch).toBeDefined();
      expect(factors.experienceLevel).toBeDefined();
      expect(factors.bondingPotential).toBeDefined();
      expect(factors.taskEffectiveness).toBeDefined();
      expect(factors.riskFactors).toBeDefined();
      expect(Array.isArray(factors.riskFactors)).toBe(true);
      expect(factors.strengthFactors).toBeDefined();
      expect(Array.isArray(factors.strengthFactors)).toBe(true);

      // Should identify specific factors
      expect(factors.personalityMatch.score).toBeGreaterThan(0.6);
    });

    test('should identify risk factors for poor matches', async () => {
      const energeticGroom = testGrooms[1];
      const [fearfulHorse] = testHorses;

      const factors = await analyzeCompatibilityFactors(energeticGroom.id, fearfulHorse.id);

      // A flagless horse with no interactions gives no temperament-based risk.
      expect(factors.riskFactors).toEqual([]);
    });
  });

  describe('predictInteractionOutcome', () => {
    test('should predict positive outcome for good compatibility', async () => {
      const [calmGroom] = testGrooms;
      const [fearfulHorse] = testHorses;

      const context = {
        taskType: 'trustBuilding',
        duration: 30,
        environmentalFactors: ['quiet', 'familiar'],
      };

      const prediction = await analyzePair(calmGroom.id, fearfulHorse.id, predictInteraction, context);

      expect(prediction).toBeDefined();
      expect(prediction.predictedBondingChange).toBeDefined();
      expect(prediction.predictedQuality).toBeDefined();
      expect(prediction.successProbability).toBeDefined();
      expect(prediction.confidence).toBeDefined();

      // Should predict positive outcomes
      expect(prediction.predictedBondingChange).toBeGreaterThan(0);
      expect(['good', 'excellent'].includes(prediction.predictedQuality)).toBe(true);
      expect(prediction.successProbability).toBeGreaterThan(0.6);
    });

    test('should predict negative outcome for poor compatibility', async () => {
      const energeticGroom = testGrooms[1];
      const [fearfulHorse] = testHorses;

      const context = {
        taskType: 'desensitization',
        duration: 30,
        environmentalFactors: ['noisy'],
      };

      const prediction = await analyzePair(energeticGroom.id, fearfulHorse.id, predictInteraction, context);

      const compatibility = await analyzePair(energeticGroom.id, fearfulHorse.id, scoreCompatibility, context);
      expect(compatibility.baseCompatibility).toBe(0.6);
      expect(prediction.predictedBondingChange).toBe(2);
      expect(prediction.successProbability).toBeCloseTo(Math.max(0.1, Math.min(0.95, compatibility.overallScore)), 10);
    });
  });

  describe('getOptimalGroomRecommendations', () => {
    test('should recommend optimal grooms for specific horse and context', async () => {
      const [horse] = testHorses; // Fearful horse

      const context = {
        taskType: 'trustBuilding',
        timeOfDay: 'morning',
        urgency: 'normal',
        environmentalFactors: ['quiet'],
      };

      const recommendations = await rankFor(horse.id, context);

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations.rankedGrooms)).toBe(true);
      expect(recommendations.rankedGrooms.length).toBeGreaterThan(0);
      expect(recommendations.topRecommendation).toBeDefined();
      expect(recommendations.alternativeOptions).toBeDefined();

      // Should rank grooms by compatibility score (business logic validation)

      const topGroom = recommendations.rankedGrooms[0];
      // Verify a valid groom recommendation with appropriate properties
      expect(topGroom.groomId).toBeDefined();
      expect(topGroom.groomName).toBeDefined();
      expect(topGroom.compatibilityScore).toBeGreaterThan(0);
      expect(topGroom.epigeneticInfluenceType).toBeDefined();
      expect(topGroom.skillLevel).toBeDefined();
      expect(topGroom.reasoning).toBeDefined();
    });

    test('should provide alternative recommendations', async () => {
      const horse = testHorses[1]; // Confident horse

      const context = {
        taskType: 'desensitization',
        timeOfDay: 'afternoon',
        urgency: 'high',
        environmentalFactors: ['stimulating'],
      };

      const recommendations = await rankFor(horse.id, context);

      expect(recommendations.alternativeOptions.length).toBeGreaterThan(0);
      expect(recommendations.contextualNotes).toBeDefined();
      expect(Array.isArray(recommendations.contextualNotes)).toBe(true);
    });
  });

  describe('analyzeCompatibilityTrends', () => {
    test('should analyze compatibility trends over time', async () => {
      const groom = testGrooms[2];

      const horse = testHorses[2];

      // Create a series of interactions showing trend
      for (let i = 0; i < 3; i++) {
        await prisma.groomInteraction.create({
          data: {
            groomId: groom.id,
            foalId: horse.id,
            interactionType: 'grooming',
            duration: 30,
            taskType: 'hoofHandling',
            bondingChange: 2 + i, // Improving over time
            quality: i === 0 ? 'fair' : i === 1 ? 'good' : 'excellent',
            cost: 28.0,
            createdAt: new Date(Date.now() - (3 - i) * 24 * 60 * 60 * 1000),
          },
        });
      }

      const trends = await analyzePair(groom.id, horse.id, compatibilityTrends);

      expect(trends).toBeDefined();
      expect(trends.overallTrend).toBeDefined();
      expect(trends.trendStrength).toBeDefined();
      expect(trends.improvementRate).toBeDefined();
      expect(trends.stabilityScore).toBeDefined();
      expect(trends.projectedCompatibility).toBeDefined();

      // Should detect improving trend
      expect(trends.overallTrend).toBe('improving');
      expect(trends.trendStrength).toBeGreaterThan(0.5);
      expect(trends.projectedCompatibility).toBeGreaterThan(0.6);
    });
  });
});
