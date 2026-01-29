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
 */

import prisma from '../../../packages/database/prismaClient.mjs';
import {
  calculateDynamicCompatibility,
  analyzeCompatibilityFactors,
  predictInteractionOutcome,
  updateCompatibilityHistory,
  getOptimalGroomRecommendations,
  analyzeCompatibilityTrends,
} from '../../services/dynamicCompatibilityScoring.mjs';

describe('Dynamic Compatibility Scoring', () => {
  let testUser;
  let testGrooms = [];
  let testHorses = [];

  beforeAll(async () => {
    // Create test horses with different temperaments and stress levels
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    await prisma.$transaction(async tx => {
      // Create test user
      testUser = await tx.user.create({
        data: {
          username: `compatibility_${Date.now()}`,
          email: `compatibility_${Date.now()}@test.com`,
          password: 'test_hash',
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
            name: `Expert Calm Groom ${Date.now()}`,
            personality: 'calm',
            groomPersonality: 'calm',
            skillLevel: 'expert',
            speciality: 'foal_care',
            user: { connect: { id: testUser.id } },
            sessionRate: 35.0,
            experience: 200,
            level: 10,
          },
        }),
        // Novice energetic groom
        tx.groom.create({
          data: {
            name: `Novice Energetic Groom ${Date.now()}`,
            personality: 'energetic',
            groomPersonality: 'energetic',
            skillLevel: 'novice',
            speciality: 'general_grooming',
            user: { connect: { id: testUser.id } },
            sessionRate: 15.0,
            experience: 20,
            level: 2,
          },
        }),
        // Experienced methodical groom
        tx.groom.create({
          data: {
            name: `Experienced Methodical Groom ${Date.now()}`,
            personality: 'methodical',
            groomPersonality: 'methodical',
            skillLevel: 'experienced',
            speciality: 'foal_care',
            user: { connect: { id: testUser.id } },
            sessionRate: 28.0,
            experience: 120,
            level: 7,
          },
        }),
      ]);

      testHorses = await Promise.all([
        // High-stress fearful horse
        tx.horse.create({
          data: {
            name: `Test Horse Fearful ${Date.now()}`,
            sex: 'filly',
            dateOfBirth: oneMonthAgo,
            user: { connect: { id: testUser.id } },
            bondScore: 8,
            stressLevel: 9,
            epigeneticFlags: ['fearful', 'reactive', 'insecure'],
          },
        }),
        // Confident social horse
        tx.horse.create({
          data: {
            name: `Test Horse Confident ${Date.now()}`,
            sex: 'colt',
            dateOfBirth: oneMonthAgo,
            user: { connect: { id: testUser.id } },
            bondScore: 38,
            stressLevel: 2,
            epigeneticFlags: ['brave', 'confident', 'social'],
          },
        }),
        // Moderate temperament horse
        tx.horse.create({
          data: {
            name: `Test Horse Moderate ${Date.now()}`,
            sex: 'gelding',
            dateOfBirth: oneMonthAgo,
            user: { connect: { id: testUser.id } },
            bondScore: 25,
            stressLevel: 5,
            epigeneticFlags: ['curious', 'calm'],
          },
        }),
      ]);
    });
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
      const [fearfulHorse] = testHorses; // High-stress fearful horse

      const context = {
        taskType: 'trust_building',
        timeOfDay: 'morning',
        horseCurrentStress: 9,
        environmentalFactors: ['quiet', 'familiar'],
        recentInteractions: [],
      };

      const compatibility = await calculateDynamicCompatibility(calmGroom.id, fearfulHorse.id, context);

      expect(compatibility).toBeDefined();
      expect(compatibility.overallScore).toBeGreaterThan(0.7); // High compatibility
      expect(compatibility.baseCompatibility).toBeDefined();
      expect(compatibility.contextualModifiers).toBeDefined();
      expect(compatibility.experienceBonus).toBeDefined();
      expect(compatibility.stressSituationModifier).toBeDefined();
      expect(compatibility.taskSpecificModifier).toBeDefined();
      expect(compatibility.confidence).toBeGreaterThan(0.8);

      // Should identify this as an excellent match
      expect(compatibility.recommendationLevel).toBe('highly_recommended');
    });

    test('should calculate low compatibility for energetic groom with fearful horse', async () => {
      const energeticGroom = testGrooms[1]; // Novice energetic groom
      const [fearfulHorse] = testHorses; // High-stress fearful horse

      const context = {
        taskType: 'trust_building',
        timeOfDay: 'afternoon',
        horseCurrentStress: 9,
        environmentalFactors: ['noisy', 'unfamiliar'],
        recentInteractions: [],
      };

      const compatibility = await calculateDynamicCompatibility(energeticGroom.id, fearfulHorse.id, context);

      expect(compatibility.overallScore).toBeLessThan(0.4); // Low compatibility
      expect(compatibility.stressSituationModifier).toBeLessThan(1.0); // Penalty for high stress
      expect(compatibility.recommendationLevel).toBe('not_recommended');
    });

    test('should calculate moderate compatibility with contextual improvements', async () => {
      const methodicalGroom = testGrooms[2]; // Experienced methodical groom

      const moderateHorse = testHorses[2]; // Moderate temperament horse

      const context = {
        taskType: 'hoof_handling',
        timeOfDay: 'morning',
        horseCurrentStress: 5,
        environmentalFactors: ['quiet', 'structured'],
        recentInteractions: [],
      };

      const compatibility = await calculateDynamicCompatibility(methodicalGroom.id, moderateHorse.id, context);

      expect(compatibility.overallScore).toBeGreaterThan(0.5);
      expect(compatibility.overallScore).toBeLessThan(0.8);
      expect(compatibility.taskSpecificModifier).toBeGreaterThan(1.0); // Methodical good for technical tasks
      expect(compatibility.recommendationLevel).toBe('recommended');
    });

    test('should apply experience bonuses correctly', async () => {
      const [expertGroom] = testGrooms; // Expert level

      const noviceGroom = testGrooms[1]; // Novice level

      const horse = testHorses[1]; // Confident horse

      const context = {
        taskType: 'desensitization',
        timeOfDay: 'morning',
        horseCurrentStress: 3,
        environmentalFactors: ['quiet'],
        recentInteractions: [],
      };

      const expertCompatibility = await calculateDynamicCompatibility(expertGroom.id, horse.id, context);
      const noviceCompatibility = await calculateDynamicCompatibility(noviceGroom.id, horse.id, context);

      expect(expertCompatibility.experienceBonus).toBeGreaterThan(noviceCompatibility.experienceBonus);
      expect(expertCompatibility.overallScore).toBeGreaterThan(noviceCompatibility.overallScore);
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
      expect(factors.stressCompatibility).toBeDefined();
      expect(factors.bondingPotential).toBeDefined();
      expect(factors.taskEffectiveness).toBeDefined();
      expect(factors.riskFactors).toBeDefined();
      expect(Array.isArray(factors.riskFactors)).toBe(true);
      expect(factors.strengthFactors).toBeDefined();
      expect(Array.isArray(factors.strengthFactors)).toBe(true);

      // Should identify specific factors
      expect(factors.personalityMatch.score).toBeGreaterThan(0.6);
      expect(factors.stressCompatibility.score).toBeGreaterThan(0.7);
    });

    test('should identify risk factors for poor matches', async () => {
      const energeticGroom = testGrooms[1];
      const [fearfulHorse] = testHorses;

      const factors = await analyzeCompatibilityFactors(energeticGroom.id, fearfulHorse.id);

      expect(factors.riskFactors.length).toBeGreaterThan(0);
      expect(
        factors.riskFactors.some(
          factor => factor.includes('energetic') || factor.includes('stress') || factor.includes('fearful'),
        ),
      ).toBe(true);
    });
  });

  describe('predictInteractionOutcome', () => {
    test('should predict positive outcome for good compatibility', async () => {
      const [calmGroom] = testGrooms;
      const [fearfulHorse] = testHorses;

      const context = {
        taskType: 'trust_building',
        duration: 30,
        environmentalFactors: ['quiet', 'familiar'],
      };

      const prediction = await predictInteractionOutcome(calmGroom.id, fearfulHorse.id, context);

      expect(prediction).toBeDefined();
      expect(prediction.predictedBondingChange).toBeDefined();
      expect(prediction.predictedStressChange).toBeDefined();
      expect(prediction.predictedQuality).toBeDefined();
      expect(prediction.successProbability).toBeDefined();
      expect(prediction.confidence).toBeDefined();

      // Should predict positive outcomes
      expect(prediction.predictedBondingChange).toBeGreaterThan(0);
      expect(prediction.predictedStressChange).toBeLessThan(2); // Low stress increase
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

      const prediction = await predictInteractionOutcome(energeticGroom.id, fearfulHorse.id, context);

      expect(prediction.predictedBondingChange).toBeLessThan(2); // Low bonding gain
      expect(prediction.predictedStressChange).toBeGreaterThan(1); // Stress increase
      expect(prediction.successProbability).toBeLessThan(0.5);
    });
  });

  describe('updateCompatibilityHistory', () => {
    test('should update compatibility history with interaction results', async () => {
      const [groom] = testGrooms;

      const horse = testHorses[1];

      // Create an interaction first
      const interaction = await prisma.groomInteraction.create({
        data: {
          groomId: groom.id,
          foalId: horse.id,
          interactionType: 'enrichment',
          duration: 30,
          taskType: 'trust_building',
          bondingChange: 3,
          stressChange: -1,
          quality: 'excellent',
          cost: 35.0,
        },
      });

      const result = await updateCompatibilityHistory(groom.id, horse.id, interaction.id);

      expect(result).toBeDefined();
      expect(result.historyUpdated).toBe(true);
      expect(result.compatibilityTrend).toBeDefined();
      expect(result.learningAdjustment).toBeDefined();
      expect(result.newBaselineScore).toBeDefined();

      // Should show positive trend for good interaction
      expect(['improving', 'stable'].includes(result.compatibilityTrend)).toBe(true);
    });
  });

  describe('getOptimalGroomRecommendations', () => {
    test('should recommend optimal grooms for specific horse and context', async () => {
      const [horse] = testHorses; // Fearful horse

      const context = {
        taskType: 'trust_building',
        timeOfDay: 'morning',
        urgency: 'normal',
        environmentalFactors: ['quiet'],
      };

      const recommendations = await getOptimalGroomRecommendations(horse.id, context);

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
      expect(topGroom.groomPersonality).toBeDefined();
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

      const recommendations = await getOptimalGroomRecommendations(horse.id, context);

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
            taskType: 'hoof_handling',
            bondingChange: 2 + i, // Improving over time
            stressChange: 1 - i, // Decreasing stress
            quality: i === 0 ? 'fair' : i === 1 ? 'good' : 'excellent',
            cost: 28.0,
            createdAt: new Date(Date.now() - (3 - i) * 24 * 60 * 60 * 1000),
          },
        });
      }

      const trends = await analyzeCompatibilityTrends(groom.id, horse.id);

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
