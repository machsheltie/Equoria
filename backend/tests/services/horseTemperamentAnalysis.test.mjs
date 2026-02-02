/**
 * Horse Temperament Analysis Tests
 *
 * Tests horse temperament analysis based on interaction history and flag patterns.
 * Uses TDD approach with NO MOCKING - real database operations for authentic validation.
 *
 * Business Rules Tested:
 * - Temperament analysis from interaction patterns
 * - Flag-based temperament classification
 * - Behavioral trend analysis over time
 * - Stress response pattern identification
 * - Bonding preference analysis
 * - Temperament stability and change detection
 */

import prisma from '../../../packages/database/prismaClient.mjs';
import {
  analyzeHorseTemperament,
  classifyTemperamentFromFlags,
  analyzeBehavioralTrends,
  identifyStressResponsePatterns,
  analyzeBondingPreferences,
  detectTemperamentChanges,
} from '../../services/horseTemperamentAnalysis.mjs';

describe('Horse Temperament Analysis', () => {
  let testUser;
  let testGrooms = [];
  let testHorses = [];

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        username: `temperament_${Date.now()}`,
        email: `temperament_${Date.now()}@test.com`,
        password: 'test_hash',
        firstName: 'Test',
        lastName: 'User',
        money: 1000,
        xp: 0,
        level: 1,
      },
    });

    // Create test grooms with different personalities
    testGrooms = await Promise.all([
      prisma.groom.create({
        data: {
          name: `Calm Groom ${Date.now()}`,
          personality: 'calm',
          groomPersonality: 'calm',
          skillLevel: 'expert',
          speciality: 'foal_care',
          userId: testUser.id ,
          sessionRate: 30.0,
        },
      }),
      prisma.groom.create({
        data: {
          name: `Energetic Groom ${Date.now()}`,
          personality: 'energetic',
          groomPersonality: 'energetic',
          skillLevel: 'expert',
          speciality: 'general_grooming',
          userId: testUser.id ,
          sessionRate: 25.0,
        },
      }),
    ]);

    // Create test horses with different flag patterns and interaction histories
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    testHorses = await Promise.all([
      // Nervous/reactive horse
      prisma.horse.create({
        data: {
          name: `Test Horse Nervous ${Date.now()}`,
          sex: 'filly',
          dateOfBirth: oneMonthAgo,
          userId: testUser.id ,
          bondScore: 12,
          stressLevel: 8,
          epigeneticFlags: ['fearful', 'reactive', 'insecure'],
        },
      }),
      // Confident/social horse
      prisma.horse.create({
        data: {
          name: `Test Horse Confident ${Date.now()}`,
          sex: 'colt',
          dateOfBirth: oneMonthAgo,
          userId: testUser.id ,
          bondScore: 35,
          stressLevel: 2,
          epigeneticFlags: ['brave', 'confident', 'social'],
        },
      }),
      // Mixed temperament horse
      prisma.horse.create({
        data: {
          name: `Test Horse Mixed ${Date.now()}`,
          sex: 'gelding',
          dateOfBirth: oneMonthAgo,
          userId: testUser.id ,
          bondScore: 22,
          stressLevel: 5,
          epigeneticFlags: ['curious', 'social', 'reactive'],
        },
      }),
      // Developing temperament horse (no flags yet)
      prisma.horse.create({
        data: {
          name: `Test Horse Developing ${Date.now()}`,
          sex: 'mare',
          dateOfBirth: oneMonthAgo,
          userId: testUser.id ,
          bondScore: 18,
          stressLevel: 6,
          epigeneticFlags: [],
        },
      }),
    ]);
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

  describe('analyzeHorseTemperament', () => {
    test('should analyze temperament for nervous horse with interaction history', async () => {
      const [nervousHorse] = testHorses;

      // Create interaction history showing nervous behavior
      await Promise.all([
        prisma.groomInteraction.create({
          data: {
            groomId: testGrooms[0].id, // Calm groom
            foalId: nervousHorse.id,
            interactionType: 'enrichment',
            duration: 30,
            taskType: 'trust_building',
            bondingChange: 1, // Slow bonding
            stressChange: 2, // Stress increase
            quality: 'fair',
            cost: 30.0,
          },
        }),
        prisma.groomInteraction.create({
          data: {
            groomId: testGrooms[1].id, // Energetic groom
            foalId: nervousHorse.id,
            interactionType: 'grooming',
            duration: 25,
            taskType: 'desensitization',
            bondingChange: -1, // Negative bonding
            stressChange: 4, // High stress increase
            quality: 'poor',
            cost: 25.0,
          },
        }),
      ]);

      const temperament = await analyzeHorseTemperament(nervousHorse.id);

      expect(temperament).toBeDefined();
      expect(temperament.horseId).toBe(nervousHorse.id);
      expect(temperament.primaryTemperament).toBeDefined();
      expect(temperament.temperamentTraits).toBeDefined();
      expect(Array.isArray(temperament.temperamentTraits)).toBe(true);
      expect(temperament.confidenceLevel).toBeDefined();
      expect(temperament.stressResilience).toBeDefined();
      expect(temperament.socialTendency).toBeDefined();
      expect(temperament.adaptability).toBeDefined();

      // Should identify nervous/reactive temperament
      expect(['nervous', 'reactive', 'sensitive'].includes(temperament.primaryTemperament)).toBe(true);
      expect(temperament.confidenceLevel).toBeLessThan(0.5);
      expect(temperament.stressResilience).toBeLessThan(0.5);
    });

    test('should analyze temperament for confident horse', async () => {
      const confidentHorse = testHorses[1];

      // Create interaction history showing confident behavior
      await Promise.all([
        prisma.groomInteraction.create({
          data: {
            groomId: testGrooms[0].id,
            foalId: confidentHorse.id,
            interactionType: 'enrichment',
            duration: 30,
            taskType: 'showground_exposure',
            bondingChange: 3, // Good bonding
            stressChange: -1, // Stress reduction
            quality: 'excellent',
            cost: 30.0,
          },
        }),
        prisma.groomInteraction.create({
          data: {
            groomId: testGrooms[1].id,
            foalId: confidentHorse.id,
            interactionType: 'enrichment',
            duration: 35,
            taskType: 'desensitization',
            bondingChange: 4, // Excellent bonding
            stressChange: -2, // Good stress management
            quality: 'excellent',
            cost: 25.0,
          },
        }),
      ]);

      const temperament = await analyzeHorseTemperament(confidentHorse.id);

      expect(temperament.primaryTemperament).toBeDefined();
      expect(['confident', 'bold', 'outgoing'].includes(temperament.primaryTemperament)).toBe(true);
      expect(temperament.confidenceLevel).toBeGreaterThan(0.6);
      expect(temperament.stressResilience).toBeGreaterThan(0.6);
      expect(temperament.socialTendency).toBeGreaterThan(0.5);
    });

    test('should analyze temperament for horse with no interaction history', async () => {
      const developingHorse = testHorses[3];

      const temperament = await analyzeHorseTemperament(developingHorse.id);

      expect(temperament).toBeDefined();
      expect(temperament.primaryTemperament).toBe('developing');
      expect(temperament.dataSource).toBe('basic_stats'); // No flags, so uses basic stats
      expect(temperament.reliabilityScore).toBeLessThan(0.7); // Lower reliability without interaction data
    });
  });

  describe('classifyTemperamentFromFlags', () => {
    test('should classify temperament from positive flags', async () => {
      const flags = ['brave', 'confident', 'social'];

      const classification = await classifyTemperamentFromFlags(flags);

      expect(classification).toBeDefined();
      expect(classification.primaryTemperament).toBeDefined();
      expect(classification.temperamentTraits).toBeDefined();
      expect(Array.isArray(classification.temperamentTraits)).toBe(true);
      expect(classification.confidence).toBeGreaterThan(0.7);

      // Should identify confident/outgoing temperament
      expect(['confident', 'bold', 'outgoing'].includes(classification.primaryTemperament)).toBe(true);
    });

    test('should classify temperament from negative flags', async () => {
      const flags = ['fearful', 'insecure', 'reactive'];

      const classification = await classifyTemperamentFromFlags(flags);

      expect(classification.primaryTemperament).toBeDefined();
      expect(['nervous', 'reactive', 'sensitive'].includes(classification.primaryTemperament)).toBe(true);
      expect(classification.confidence).toBeGreaterThan(0.6); // High confidence in clear negative pattern
    });

    test('should handle mixed flags appropriately', async () => {
      const flags = ['brave', 'reactive', 'social'];

      const classification = await classifyTemperamentFromFlags(flags);

      expect(classification.primaryTemperament).toBeDefined();
      expect(['complex', 'mixed', 'variable'].includes(classification.primaryTemperament)).toBe(true);
      expect(classification.confidence).toBeLessThan(0.8); // Lower confidence for mixed signals
    });

    test('should handle empty flags array', async () => {
      const flags = [];

      const classification = await classifyTemperamentFromFlags(flags);

      expect(classification.primaryTemperament).toBe('undetermined');
      expect(classification.confidence).toBeLessThan(0.3);
    });
  });

  describe('analyzeBehavioralTrends', () => {
    test('should analyze behavioral trends over time', async () => {
      const horse = testHorses[2]; // Mixed temperament horse

      // Create a series of interactions showing behavioral trends
      const interactions = [];
      for (let i = 0; i < 5; i++) {
        const interaction = await prisma.groomInteraction.create({
          data: {
            groomId: testGrooms[0].id,
            foalId: horse.id,
            interactionType: 'enrichment',
            duration: 30,
            taskType: 'trust_building',
            bondingChange: 2 + i, // Improving bonding over time
            stressChange: 3 - i, // Decreasing stress over time
            quality: i < 2 ? 'fair' : i < 4 ? 'good' : 'excellent',
            cost: 30.0,
            createdAt: new Date(Date.now() - (5 - i) * 24 * 60 * 60 * 1000),
          },
        });
        interactions.push(interaction);
      }

      const trends = await analyzeBehavioralTrends(horse.id);

      expect(trends).toBeDefined();
      expect(trends.bondingTrend).toBeDefined();
      expect(trends.stressTrend).toBeDefined();
      expect(trends.qualityTrend).toBeDefined();
      expect(trends.overallDirection).toBeDefined();
      expect(trends.trendStrength).toBeDefined();

      // Should detect improving trends
      expect(trends.bondingTrend).toBe('improving');
      expect(trends.stressTrend).toBe('improving'); // Stress decreasing is improving
      expect(trends.overallDirection).toBe('positive');
      expect(trends.trendStrength).toBeGreaterThan(0.5);
    });
  });

  describe('identifyStressResponsePatterns', () => {
    test('should identify stress response patterns', async () => {
      const [horse] = testHorses; // Nervous horse

      const patterns = await identifyStressResponsePatterns(horse.id);

      expect(patterns).toBeDefined();
      expect(patterns.stressThreshold).toBeDefined();
      expect(patterns.recoveryRate).toBeDefined();
      expect(patterns.triggerFactors).toBeDefined();
      expect(Array.isArray(patterns.triggerFactors)).toBe(true);
      expect(patterns.copingMechanisms).toBeDefined();
      expect(patterns.responseType).toBeDefined();

      // Should identify high stress sensitivity
      expect(patterns.stressThreshold).toBeLessThan(0.6);
      expect(['high_sensitivity', 'reactive', 'anxious'].includes(patterns.responseType)).toBe(true);
    });
  });

  describe('analyzeBondingPreferences', () => {
    test('should analyze bonding preferences', async () => {
      const horse = testHorses[1]; // Confident horse

      const preferences = await analyzeBondingPreferences(horse.id);

      expect(preferences).toBeDefined();
      expect(preferences.preferredGroomTypes).toBeDefined();
      expect(Array.isArray(preferences.preferredGroomTypes)).toBe(true);
      expect(preferences.preferredInteractionTypes).toBeDefined();
      expect(preferences.bondingSpeed).toBeDefined();
      expect(preferences.socialNature).toBeDefined();
      expect(preferences.trustLevel).toBeDefined();

      // Should show preferences based on interaction history
      expect(preferences.bondingSpeed).toBeGreaterThan(0.5);
      expect(preferences.socialNature).toBeGreaterThan(0.5);
    });
  });

  describe('detectTemperamentChanges', () => {
    test('should detect temperament changes over time', async () => {
      const horse = testHorses[3]; // Developing horse

      // Create interactions showing temperament development
      await Promise.all([
        prisma.groomInteraction.create({
          data: {
            groomId: testGrooms[0].id,
            foalId: horse.id,
            interactionType: 'enrichment',
            duration: 30,
            taskType: 'trust_building',
            bondingChange: 3,
            stressChange: -2,
            quality: 'good',
            cost: 30.0,
            createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 2 weeks ago
          },
        }),
        prisma.groomInteraction.create({
          data: {
            groomId: testGrooms[0].id,
            foalId: horse.id,
            interactionType: 'enrichment',
            duration: 30,
            taskType: 'showground_exposure',
            bondingChange: 4,
            stressChange: -1,
            quality: 'excellent',
            cost: 30.0,
            createdAt: new Date(), // Recent
          },
        }),
      ]);

      const changes = await detectTemperamentChanges(horse.id);

      expect(changes).toBeDefined();
      expect(changes.changeDetected).toBeDefined();
      expect(changes.changeDirection).toBeDefined();
      expect(changes.changeStrength).toBeDefined();
      expect(changes.timeframe).toBeDefined();
      expect(changes.contributingFactors).toBeDefined();

      if (changes.changeDetected) {
        expect(['positive', 'negative', 'neutral'].includes(changes.changeDirection)).toBe(true);
        expect(changes.changeStrength).toBeGreaterThan(0);
      }
    });
  });
});
