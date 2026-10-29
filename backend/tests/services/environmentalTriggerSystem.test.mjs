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
 * - Social environment impact on trait expression
 * - Cumulative environmental exposure tracking
 * - Critical period environmental sensitivity
 */

import prisma from '../../../packages/database/prismaClient.mjs';
import { randomBytes } from 'node:crypto';
import { fixtureColor } from '../helpers/fixtureColor.mjs';
import {
  generateEnvironmentalReport,
  loadEnvironmentalTriggerSnapshot,
  cumulativeExposure,
  detectTriggers,
  triggerThresholds,
} from '../../modules/traits/services/environmentalTriggerSystem.mjs';
import { gameCalendarDate } from '../../utils/gameTime.mjs';
const analyze = async (horseId, project, ...rest) => project(await loadEnvironmentalTriggerSnapshot(horseId), ...rest);

describe('Environmental Trigger System', () => {
  let testUser;
  let testHorses = [];
  let testGrooms = [];

  beforeAll(async () => {
    // Create test horses with different ages and environmental exposures
    const now = new Date();
    const oneWeekAgo = gameCalendarDate(now, -7);
    const twoWeeksAgo = gameCalendarDate(now, -14);
    const oneMonthAgo = gameCalendarDate(now, -30);

    await prisma.$transaction(
      async tx => {
        // Create test user
        testUser = await tx.user.create({
          data: {
            emailVerified: true,
            username: `env_trigger_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
            email: `env_trigger_${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}@test.com`,
            password: 'testHash',
            firstName: 'Test',
            lastName: 'User',
            money: 1000,
            xp: 0,
            level: 1,
          },
        });

        // Create test grooms for environmental interactions
        testGrooms = await Promise.all([
          tx.groom.create({
            data: {
              name: `Calm Groom ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
              personality: 'calm',
              epigeneticInfluenceType: 'calm',
              skillLevel: 'expert',
              speciality: 'foalCare',
              userId: testUser.id,
              sessionRate: 30.0,
              experience: 150,
            },
          }),
          tx.groom.create({
            data: {
              name: `Energetic Groom ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
              personality: 'energetic',
              epigeneticInfluenceType: 'energetic',
              skillLevel: 'expert',
              speciality: 'generalGrooming',
              userId: testUser.id,
              sessionRate: 35.0,
              experience: 200,
            },
          }),
        ]);

        testHorses = await Promise.all([
          // Young foal - high environmental sensitivity
          tx.horse.create({
            data: {
              ...fixtureColor(),
              name: `Test Foal Young ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
              sex: 'filly',
              dateOfBirth: oneWeekAgo,
              userId: testUser.id,
              bondScore: 15,
            },
          }),
          // Older foal - moderate sensitivity
          tx.horse.create({
            data: {
              ...fixtureColor(),
              name: `Test Foal Older ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
              sex: 'colt',
              dateOfBirth: oneMonthAgo,
              userId: testUser.id,
              bondScore: 25,
            },
          }),
          // Reactive foal - high trigger sensitivity
          tx.horse.create({
            data: {
              ...fixtureColor(),
              name: `Test Foal Reactive ${randomBytes(4).toString('hex')}_${randomBytes(4).toString('hex')}`,
              sex: 'filly',
              dateOfBirth: twoWeeksAgo,
              userId: testUser.id,
              bondScore: 10,
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

  describe('detectEnvironmentalTriggers', () => {
    test('should detect environmental triggers from interaction patterns', async () => {
      const [horse] = testHorses; // Young foal

      // Create interactions with environmental factors
      await Promise.all([
        prisma.groomInteraction.create({
          data: {
            groomId: testGrooms[0].id,
            foalId: horse.id,
            interactionType: 'enrichment',
            duration: 30,
            taskType: 'showgroundExposure',
            bondingChange: 2,
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
            quality: 'fair',
            cost: 35.0,
            createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          },
        }),
      ]);

      const triggers = await analyze(horse.id, detectTriggers);

      expect(triggers).toBeDefined();
      expect(triggers.horseId).toBe(horse.id);
      expect(triggers.detectedTriggers).toBeDefined();
      expect(Array.isArray(triggers.detectedTriggers)).toBe(true);
      expect(triggers.triggerStrength).toBeDefined();
      expect(triggers.environmentalFactors).toBeDefined();
      expect(triggers.analysisWindow).toBeDefined();

      // Should detect environmental factors
      expect(triggers.detectedTriggers.length).toBeGreaterThan(0);
      expect(triggers.triggerStrength).toBeGreaterThan(0);
    });

    test('should handle horses with no environmental exposure', async () => {
      const horse = testHorses[1]; // Older foal with no interactions

      const triggers = await analyze(horse.id, detectTriggers);

      expect(triggers.detectedTriggers).toEqual([]);
      expect(triggers.triggerStrength).toBe(0);
      expect(triggers.environmentalFactors).toEqual([]);
    });

    test('should detect multiple environmental trigger types', async () => {
      const horse = testHorses[2]; // Reactive foal

      // Create diverse environmental interactions
      await Promise.all([
        prisma.groomInteraction.create({
          data: {
            groomId: testGrooms[0].id,
            foalId: horse.id,
            interactionType: 'grooming',
            duration: 20,
            taskType: 'spongeBath',
            bondingChange: -1,
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
            taskType: 'showgroundExposure',
            bondingChange: 3,
            quality: 'excellent',
            cost: 35.0,
          },
        }),
      ]);

      const triggers = await analyze(horse.id, detectTriggers);

      expect(triggers.detectedTriggers.length).toBeGreaterThan(1);
      expect(triggers.environmentalFactors.length).toBeGreaterThan(1);
    });
  });

  describe('calculateTriggerThresholds', () => {
    test('should calculate age-appropriate trigger thresholds', async () => {
      const [youngHorse] = testHorses;

      const olderHorse = testHorses[1];

      const youngThresholds = await analyze(youngHorse.id, triggerThresholds);
      const olderThresholds = await analyze(olderHorse.id, triggerThresholds);

      expect(youngThresholds).toBeDefined();
      expect(olderThresholds).toBeDefined();

      expect(youngThresholds.baseThreshold).toBeDefined();
      expect(youngThresholds.ageModifier).toBeDefined();
      expect(youngThresholds.finalThreshold).toBeDefined();

      // Younger horses should have lower thresholds (more sensitive)
      expect(youngThresholds.finalThreshold).toBeLessThan(olderThresholds.finalThreshold);
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
            quality: 'good',
            cost: 30.0,
            createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
          },
        });
      }

      const exposure = await analyze(horse.id, cumulativeExposure);

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

  describe('generateEnvironmentalReport', () => {
    test('should generate comprehensive environmental analysis report', async () => {
      const [horse] = testHorses;

      // Create some environmental interactions
      await prisma.groomInteraction.create({
        data: {
          groomId: testGrooms[0].id,
          foalId: horse.id,
          interactionType: 'enrichment',
          duration: 30,
          taskType: 'trustBuilding',
          bondingChange: 2,
          quality: 'good',
          cost: 30.0,
        },
      });

      const report = await generateEnvironmentalReport(horse.id);

      expect(report).toBeDefined();
      expect(report.horseId).toBe(horse.id);
      expect(report.environmentalTriggers).toBeDefined();
      expect(report.triggerThresholds).toBeDefined();
      // Owner ruling 2026-10-07 (Equoria-huuaf): no forecasts. Old contract: traitExpressionProbabilities.
      expect(report).not.toHaveProperty('traitExpressionProbabilities');
      expect(report.cumulativeExposure).toBeDefined();
      // Owner ruling 2026-10-07 (Equoria-5nxw0): no advice, windows or forecasts (old contract: criticalPeriodSensitivity and recommendations defined).
      expect(report).not.toHaveProperty('criticalPeriodSensitivity');
      expect(report).not.toHaveProperty('recommendations');
      expect(report.reportTimestamp).toBeDefined();
    });
  });
});
