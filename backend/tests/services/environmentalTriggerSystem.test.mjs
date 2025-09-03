/**
 * Environmental Trigger System Tests
 * 
 * Tests comprehensive environmental factors that trigger epigenetic trait expression.
 * Uses TDD approach with NO MOCKING - real database operations for authentic validation.
 * 
 * Business Rules Tested:
 * - Environmental factor detection and classification
 * - Trigger threshold calculations and accumulation
 * - Trait expression probability based on environmental exposure
 * - Seasonal and weather-based trigger variations
 * - Stress-based environmental triggers
 * - Social environment impact on trait expression
 * - Cumulative environmental exposure tracking
 * - Critical period environmental sensitivity
 */

import prisma from '../../../packages/database/prismaClient.mjs';
import { 
  detectEnvironmentalTriggers,
  calculateTriggerThresholds,
  evaluateTraitExpressionProbability,
  processSeasonalTriggers,
  analyzeStressEnvironmentTriggers,
  trackCumulativeExposure,
  assessCriticalPeriodSensitivity,
  generateEnvironmentalReport
} from '../../services/environmentalTriggerSystem.mjs';

describe('Environmental Trigger System', () => {
  let testUser;
  let testHorses = [];
  let testGrooms = [];

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        username: `env_trigger_${Date.now()}`,
        email: `env_trigger_${Date.now()}@test.com`,
        password: 'test_hash',
        firstName: 'Test',
        lastName: 'User',
        money: 1000,
        xp: 0,
        level: 1,
      },
    });

    // Create test grooms for environmental interactions
    testGrooms = await Promise.all([
      prisma.groom.create({
        data: {
          name: `Calm Groom ${Date.now()}`,
          personality: 'calm',
          groomPersonality: 'calm',
          skillLevel: 'expert',
          speciality: 'foal_care',
          userId: testUser.id,
          sessionRate: 30.0,
          experience: 150,
          level: 8,
        },
      }),
      prisma.groom.create({
        data: {
          name: `Energetic Groom ${Date.now()}`,
          personality: 'energetic',
          groomPersonality: 'energetic',
          skillLevel: 'expert',
          speciality: 'general_grooming',
          userId: testUser.id,
          sessionRate: 35.0,
          experience: 200,
          level: 10,
        },
      }),
    ]);

    // Create test horses with different ages and environmental exposures
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    testHorses = await Promise.all([
      // Young foal - high environmental sensitivity
      prisma.horse.create({
        data: {
          name: `Test Foal Young ${Date.now()}`,
          sex: 'filly',
          dateOfBirth: oneWeekAgo,
          ownerId: testUser.id,
          bondScore: 15,
          stressLevel: 6,
          epigeneticFlags: ['developing'],
        },
      }),
      // Older foal - moderate sensitivity
      prisma.horse.create({
        data: {
          name: `Test Foal Older ${Date.now()}`,
          sex: 'colt',
          dateOfBirth: oneMonthAgo,
          ownerId: testUser.id,
          bondScore: 25,
          stressLevel: 4,
          epigeneticFlags: ['curious'],
        },
      }),
      // Stressed foal - high trigger sensitivity
      prisma.horse.create({
        data: {
          name: `Test Foal Stressed ${Date.now()}`,
          sex: 'filly',
          dateOfBirth: twoWeeksAgo,
          ownerId: testUser.id,
          bondScore: 10,
          stressLevel: 8,
          epigeneticFlags: ['reactive'],
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
    await prisma.user.delete({ where: { id: testUser.id } });
  });

  describe('detectEnvironmentalTriggers', () => {
    test('should detect environmental triggers from interaction patterns', async () => {
      const horse = testHorses[0]; // Young foal
      
      // Create interactions with environmental factors
      await Promise.all([
        prisma.groomInteraction.create({
          data: {
            groomId: testGrooms[0].id,
            foalId: horse.id,
            interactionType: 'enrichment',
            duration: 30,
            taskType: 'showground_exposure',
            bondingChange: 2,
            stressChange: 3,
            quality: 'good',
            cost: 30.0,
            createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          },
        }),
        prisma.groomInteraction.create({
          data: {
            groomId: testGrooms[1].id,
            foalId: horse.id,
            interactionType: 'enrichment',
            duration: 45,
            taskType: 'desensitization',
            bondingChange: 1,
            stressChange: 4,
            quality: 'fair',
            cost: 35.0,
            createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          },
        }),
      ]);

      const triggers = await detectEnvironmentalTriggers(horse.id);
      
      expect(triggers).toBeDefined();
      expect(triggers.horseId).toBe(horse.id);
      expect(triggers.detectedTriggers).toBeDefined();
      expect(Array.isArray(triggers.detectedTriggers)).toBe(true);
      expect(triggers.triggerStrength).toBeDefined();
      expect(triggers.environmentalFactors).toBeDefined();
      expect(triggers.analysisWindow).toBeDefined();
      
      // Should detect stress-inducing environmental factors
      expect(triggers.detectedTriggers.length).toBeGreaterThan(0);
      expect(triggers.triggerStrength).toBeGreaterThan(0);
    });

    test('should handle horses with no environmental exposure', async () => {
      const horse = testHorses[1]; // Older foal with no interactions
      
      const triggers = await detectEnvironmentalTriggers(horse.id);
      
      expect(triggers.detectedTriggers).toEqual([]);
      expect(triggers.triggerStrength).toBe(0);
      expect(triggers.environmentalFactors).toEqual([]);
    });

    test('should detect multiple environmental trigger types', async () => {
      const horse = testHorses[2]; // Stressed foal
      
      // Create diverse environmental interactions
      await Promise.all([
        prisma.groomInteraction.create({
          data: {
            groomId: testGrooms[0].id,
            foalId: horse.id,
            interactionType: 'grooming',
            duration: 20,
            taskType: 'sponge_bath',
            bondingChange: -1,
            stressChange: 2,
            quality: 'poor',
            cost: 30.0,
          },
        }),
        prisma.groomInteraction.create({
          data: {
            groomId: testGrooms[1].id,
            foalId: horse.id,
            interactionType: 'enrichment',
            duration: 60,
            taskType: 'showground_exposure',
            bondingChange: 3,
            stressChange: -1,
            quality: 'excellent',
            cost: 35.0,
          },
        }),
      ]);

      const triggers = await detectEnvironmentalTriggers(horse.id);
      
      expect(triggers.detectedTriggers.length).toBeGreaterThan(1);
      expect(triggers.environmentalFactors.length).toBeGreaterThan(1);
    });
  });

  describe('calculateTriggerThresholds', () => {
    test('should calculate age-appropriate trigger thresholds', async () => {
      const youngHorse = testHorses[0];
      const olderHorse = testHorses[1];
      
      const youngThresholds = await calculateTriggerThresholds(youngHorse.id);
      const olderThresholds = await calculateTriggerThresholds(olderHorse.id);
      
      expect(youngThresholds).toBeDefined();
      expect(olderThresholds).toBeDefined();
      
      expect(youngThresholds.baseThreshold).toBeDefined();
      expect(youngThresholds.ageModifier).toBeDefined();
      expect(youngThresholds.stressModifier).toBeDefined();
      expect(youngThresholds.finalThreshold).toBeDefined();
      
      // Younger horses should have lower thresholds (more sensitive)
      expect(youngThresholds.finalThreshold).toBeLessThan(olderThresholds.finalThreshold);
    });

    test('should apply stress-based threshold modifications', async () => {
      const stressedHorse = testHorses[2]; // High stress
      const calmHorse = testHorses[1]; // Lower stress
      
      const stressedThresholds = await calculateTriggerThresholds(stressedHorse.id);
      const calmThresholds = await calculateTriggerThresholds(calmHorse.id);
      
      // Stressed horses should have lower thresholds (more sensitive to triggers)
      expect(stressedThresholds.finalThreshold).toBeLessThan(calmThresholds.finalThreshold);
      expect(stressedThresholds.stressModifier).toBeLessThan(1.0);
    });
  });

  describe('evaluateTraitExpressionProbability', () => {
    test('should calculate trait expression probability based on environmental exposure', async () => {
      const horse = testHorses[0];
      
      // Create environmental exposure
      await prisma.groomInteraction.create({
        data: {
          groomId: testGrooms[0].id,
          foalId: horse.id,
          interactionType: 'enrichment',
          duration: 30,
          taskType: 'trust_building',
          bondingChange: 2,
          stressChange: 1,
          quality: 'good',
          cost: 30.0,
        },
      });

      const probability = await evaluateTraitExpressionProbability(horse.id, 'confident');
      
      expect(probability).toBeDefined();
      expect(probability.traitName).toBe('confident');
      expect(probability.baseProbability).toBeDefined();
      expect(probability.environmentalModifier).toBeDefined();
      expect(probability.ageModifier).toBeDefined();
      expect(probability.stressModifier).toBeDefined();
      expect(probability.finalProbability).toBeDefined();
      expect(probability.expressionLikelihood).toBeDefined();
      
      expect(probability.finalProbability).toBeGreaterThanOrEqual(0);
      expect(probability.finalProbability).toBeLessThanOrEqual(1);
    });

    test('should handle trait expression for different trait types', async () => {
      const horse = testHorses[2]; // Stressed horse
      
      const fearfulProb = await evaluateTraitExpressionProbability(horse.id, 'fearful');
      const braveProb = await evaluateTraitExpressionProbability(horse.id, 'brave');
      
      expect(fearfulProb.finalProbability).toBeDefined();
      expect(braveProb.finalProbability).toBeDefined();
      
      // Stressed horse should have higher probability for fearful traits
      expect(fearfulProb.finalProbability).toBeGreaterThan(braveProb.finalProbability);
    });
  });

  describe('processSeasonalTriggers', () => {
    test('should process seasonal environmental triggers', async () => {
      const horse = testHorses[1];
      
      const seasonalTriggers = await processSeasonalTriggers(horse.id, 'winter');
      
      expect(seasonalTriggers).toBeDefined();
      expect(seasonalTriggers.season).toBe('winter');
      expect(seasonalTriggers.seasonalFactors).toBeDefined();
      expect(Array.isArray(seasonalTriggers.seasonalFactors)).toBe(true);
      expect(seasonalTriggers.triggerModifications).toBeDefined();
      expect(seasonalTriggers.affectedTraits).toBeDefined();
    });

    test('should handle different seasonal variations', async () => {
      const horse = testHorses[0];
      
      const winterTriggers = await processSeasonalTriggers(horse.id, 'winter');
      const summerTriggers = await processSeasonalTriggers(horse.id, 'summer');
      
      expect(winterTriggers.seasonalFactors).not.toEqual(summerTriggers.seasonalFactors);
      expect(winterTriggers.triggerModifications).toBeDefined();
      expect(summerTriggers.triggerModifications).toBeDefined();
    });
  });

  describe('analyzeStressEnvironmentTriggers', () => {
    test('should analyze stress-based environmental triggers', async () => {
      const stressedHorse = testHorses[2];
      
      // Create stress-inducing interactions
      await prisma.groomInteraction.create({
        data: {
          groomId: testGrooms[1].id,
          foalId: stressedHorse.id,
          interactionType: 'grooming',
          duration: 15,
          taskType: 'hoof_handling',
          bondingChange: -1,
          stressChange: 3,
          quality: 'poor',
          cost: 35.0,
        },
      });

      const stressTriggers = await analyzeStressEnvironmentTriggers(stressedHorse.id);
      
      expect(stressTriggers).toBeDefined();
      expect(stressTriggers.stressLevel).toBeDefined();
      expect(stressTriggers.stressTriggers).toBeDefined();
      expect(Array.isArray(stressTriggers.stressTriggers)).toBe(true);
      expect(stressTriggers.triggerIntensity).toBeDefined();
      expect(stressTriggers.recommendedInterventions).toBeDefined();
      
      expect(stressTriggers.stressLevel).toBeGreaterThan(5);
      expect(stressTriggers.stressTriggers.length).toBeGreaterThan(0);
    });
  });

  describe('trackCumulativeExposure', () => {
    test('should track cumulative environmental exposure over time', async () => {
      const horse = testHorses[1];
      
      // Create multiple interactions over time
      for (let i = 0; i < 3; i++) {
        await prisma.groomInteraction.create({
          data: {
            groomId: testGrooms[0].id,
            foalId: horse.id,
            interactionType: 'enrichment',
            duration: 30,
            taskType: 'desensitization',
            bondingChange: 1,
            stressChange: 1,
            quality: 'good',
            cost: 30.0,
            createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
          },
        });
      }

      const exposure = await trackCumulativeExposure(horse.id);
      
      expect(exposure).toBeDefined();
      expect(exposure.totalExposure).toBeDefined();
      expect(exposure.exposureByType).toBeDefined();
      expect(exposure.exposureTimeline).toBeDefined();
      expect(Array.isArray(exposure.exposureTimeline)).toBe(true);
      expect(exposure.cumulativeEffects).toBeDefined();
      
      expect(exposure.totalExposure).toBeGreaterThan(0);
      expect(exposure.exposureTimeline.length).toBe(3);
    });
  });

  describe('assessCriticalPeriodSensitivity', () => {
    test('should assess critical period environmental sensitivity', async () => {
      const youngHorse = testHorses[0]; // Very young foal
      
      const sensitivity = await assessCriticalPeriodSensitivity(youngHorse.id);
      
      expect(sensitivity).toBeDefined();
      expect(sensitivity.currentAge).toBeDefined();
      expect(sensitivity.criticalPeriods).toBeDefined();
      expect(Array.isArray(sensitivity.criticalPeriods)).toBe(true);
      expect(sensitivity.sensitivityLevel).toBeDefined();
      expect(sensitivity.activeWindows).toBeDefined();
      expect(sensitivity.recommendations).toBeDefined();
      
      // Young foal should be in critical period
      expect(sensitivity.sensitivityLevel).toBeGreaterThan(0.7);
      expect(sensitivity.activeWindows.length).toBeGreaterThan(0);
    });

    test('should show reduced sensitivity for older horses', async () => {
      const olderHorse = testHorses[1];
      
      const sensitivity = await assessCriticalPeriodSensitivity(olderHorse.id);
      
      expect(sensitivity.sensitivityLevel).toBeLessThan(0.8);
    });
  });

  describe('generateEnvironmentalReport', () => {
    test('should generate comprehensive environmental analysis report', async () => {
      const horse = testHorses[0];
      
      // Create some environmental interactions
      await prisma.groomInteraction.create({
        data: {
          groomId: testGrooms[0].id,
          foalId: horse.id,
          interactionType: 'enrichment',
          duration: 30,
          taskType: 'trust_building',
          bondingChange: 2,
          stressChange: 1,
          quality: 'good',
          cost: 30.0,
        },
      });

      const report = await generateEnvironmentalReport(horse.id);
      
      expect(report).toBeDefined();
      expect(report.horseId).toBe(horse.id);
      expect(report.environmentalTriggers).toBeDefined();
      expect(report.triggerThresholds).toBeDefined();
      expect(report.traitExpressionProbabilities).toBeDefined();
      expect(report.cumulativeExposure).toBeDefined();
      expect(report.criticalPeriodSensitivity).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
      expect(report.reportTimestamp).toBeDefined();
      
      expect(report.traitExpressionProbabilities.length).toBeGreaterThan(0);
    });
  });
});
