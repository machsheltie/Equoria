/**
 * Developmental Window System Tests
 *
 * Tests critical developmental periods for trait expression.
 * Uses TDD approach with NO MOCKING - real database operations for authentic validation.
 *
 * Business Rules Tested:
 * - Critical developmental window identification and timing
 * - Age-based trait expression sensitivity calculations
 * - Window-specific trait development opportunities
 * - Developmental milestone tracking and evaluation
 * - Window closure effects on trait expression potential
 * - Multi-window trait development coordination
 * - Environmental sensitivity during critical periods
 * - Long-term developmental outcome prediction
 */

import prisma from '../../../packages/database/prismaClient.mjs';
import {
  identifyDevelopmentalWindows,
  calculateWindowSensitivity,
  evaluateTraitDevelopmentOpportunity,
  trackDevelopmentalMilestones,
  assessWindowClosure,
  coordinateMultiWindowDevelopment,
  analyzeCriticalPeriodSensitivity,
  generateDevelopmentalForecast,
} from '../../services/developmentalWindowSystem.mjs';

describe('Developmental Window System', () => {
  let testUser;
  let testHorses = [];
  let testGrooms = [];

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        username: `dev_window_${Date.now()}`,
        email: `dev_window_${Date.now()}@test.com`,
        password: 'test_hash',
        firstName: 'Test',
        lastName: 'User',
        money: 1000,
        xp: 0,
        level: 1,
      },
    });

    // Create test grooms for developmental interactions
    testGrooms = await Promise.all([
      prisma.groom.create({
        data: {
          name: `Developmental Groom ${Date.now()}`,
          personality: 'calm',
          groomPersonality: 'calm',
          skillLevel: 'expert',
          speciality: 'foal_care',
          userId: testUser.id,
          sessionRate: 40.0,
          experience: 200,
          level: 10,
        },
      }),
    ]);

    // Create test horses at different developmental stages
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    testHorses = await Promise.all([
      // Newborn foal - imprinting window
      prisma.horse.create({
        data: {
          name: `Test Foal Newborn ${Date.now()}`,
          sex: 'filly',
          dateOfBirth: oneDayAgo,
          ownerId: testUser.id,
          bondScore: 5,
          stressLevel: 3,
          epigeneticFlags: ['developing'],
        },
      }),
      // Week-old foal - early socialization window
      prisma.horse.create({
        data: {
          name: `Test Foal Week ${Date.now()}`,
          sex: 'colt',
          dateOfBirth: oneWeekAgo,
          ownerId: testUser.id,
          bondScore: 12,
          stressLevel: 4,
          epigeneticFlags: ['curious'],
        },
      }),
      // Two-week-old foal - fear period window
      prisma.horse.create({
        data: {
          name: `Test Foal TwoWeek ${Date.now()}`,
          sex: 'filly',
          dateOfBirth: twoWeeksAgo,
          ownerId: testUser.id,
          bondScore: 18,
          stressLevel: 6,
          epigeneticFlags: ['sensitive'],
        },
      }),
      // Month-old foal - curiosity development window
      prisma.horse.create({
        data: {
          name: `Test Foal Month ${Date.now()}`,
          sex: 'gelding',
          dateOfBirth: oneMonthAgo,
          ownerId: testUser.id,
          bondScore: 25,
          stressLevel: 5,
          epigeneticFlags: ['curious', 'social'],
        },
      }),
      // Three-month-old foal - independence development
      prisma.horse.create({
        data: {
          name: `Test Foal ThreeMonth ${Date.now()}`,
          sex: 'colt',
          dateOfBirth: threeMonthsAgo,
          ownerId: testUser.id,
          bondScore: 35,
          stressLevel: 3,
          epigeneticFlags: ['confident', 'independent'],
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

  describe('identifyDevelopmentalWindows', () => {
    test('should identify active developmental windows for newborn foal', async () => {
      const [newbornFoal] = testHorses; // 1 day old

      const windows = await identifyDevelopmentalWindows(newbornFoal.id);

      expect(windows).toBeDefined();
      expect(windows.horseId).toBe(newbornFoal.id);
      expect(windows.currentAge).toBeDefined();
      expect(windows.activeWindows).toBeDefined();
      expect(Array.isArray(windows.activeWindows)).toBe(true);
      expect(windows.upcomingWindows).toBeDefined();
      expect(windows.closedWindows).toBeDefined();
      expect(windows.criticalityScore).toBeDefined();

      // Should be in imprinting window
      expect(windows.activeWindows.length).toBeGreaterThan(0);
      const imprintingWindow = windows.activeWindows.find(w => w.name === 'imprinting');
      expect(imprintingWindow).toBeDefined();
    });

    test('should identify multiple active windows for appropriate ages', async () => {
      // eslint-disable-next-line prefer-destructuring
      const weekOldFoal = testHorses[1]; // 7 days old

      const windows = await identifyDevelopmentalWindows(weekOldFoal.id);

      // Should be in multiple overlapping windows
      expect(windows.activeWindows.length).toBeGreaterThan(1);

      // Should include early socialization
      const socializationWindow = windows.activeWindows.find(w => w.name === 'early_socialization');
      expect(socializationWindow).toBeDefined();
    });

    test('should show closed windows for older foals', async () => {
      // eslint-disable-next-line prefer-destructuring
      const olderFoal = testHorses[4]; // 3 months old

      const windows = await identifyDevelopmentalWindows(olderFoal.id);

      expect(windows.closedWindows.length).toBeGreaterThan(0);
      expect(windows.activeWindows.length).toBeLessThan(3); // Fewer active windows
    });
  });

  describe('calculateWindowSensitivity', () => {
    test('should calculate high sensitivity for critical periods', async () => {
      const [newbornFoal] = testHorses;

      const sensitivity = await calculateWindowSensitivity(newbornFoal.id, 'imprinting');

      expect(sensitivity).toBeDefined();
      expect(sensitivity.windowName).toBe('imprinting');
      expect(sensitivity.baseSensitivity).toBeDefined();
      expect(sensitivity.ageModifier).toBeDefined();
      expect(sensitivity.environmentalModifier).toBeDefined();
      expect(sensitivity.finalSensitivity).toBeDefined();
      expect(sensitivity.sensitivityLevel).toBeDefined();

      // Should be highly sensitive during imprinting
      expect(sensitivity.finalSensitivity).toBeGreaterThan(0.8);
      expect(sensitivity.sensitivityLevel).toBe('critical');
    });

    test('should calculate reduced sensitivity outside critical periods', async () => {
      // eslint-disable-next-line prefer-destructuring
      const olderFoal = testHorses[4];

      const sensitivity = await calculateWindowSensitivity(olderFoal.id, 'imprinting');

      // Should be low sensitivity for closed window
      expect(sensitivity.finalSensitivity).toBeLessThan(0.3);
      expect(sensitivity.sensitivityLevel).toBe('minimal');
    });

    test('should apply environmental modifiers correctly', async () => {
      // eslint-disable-next-line prefer-destructuring
      const stressedFoal = testHorses[2]; // Higher stress level
      // eslint-disable-next-line prefer-destructuring
      const calmFoal = testHorses[4]; // Lower stress level

      const stressedSensitivity = await calculateWindowSensitivity(stressedFoal.id, 'fear_period_1');
      const calmSensitivity = await calculateWindowSensitivity(calmFoal.id, 'fear_period_1');

      // Stressed foal should have higher sensitivity to fear periods
      expect(stressedSensitivity.environmentalModifier).toBeGreaterThan(calmSensitivity.environmentalModifier);
    });
  });

  describe('evaluateTraitDevelopmentOpportunity', () => {
    test('should evaluate trait development opportunities during active windows', async () => {
      // eslint-disable-next-line prefer-destructuring
      const youngFoal = testHorses[1];

      const opportunity = await evaluateTraitDevelopmentOpportunity(youngFoal.id, 'confident', 'early_socialization');

      expect(opportunity).toBeDefined();
      expect(opportunity.traitName).toBe('confident');
      expect(opportunity.windowName).toBe('early_socialization');
      expect(opportunity.developmentPotential).toBeDefined();
      expect(opportunity.windowAlignment).toBeDefined();
      expect(opportunity.environmentalSupport).toBeDefined();
      expect(opportunity.overallOpportunity).toBeDefined();
      expect(opportunity.recommendedActions).toBeDefined();

      expect(opportunity.overallOpportunity).toBeGreaterThanOrEqual(0);
      expect(opportunity.overallOpportunity).toBeLessThanOrEqual(1);
      expect(Array.isArray(opportunity.recommendedActions)).toBe(true);
    });

    test('should show higher opportunities for window-aligned traits', async () => {
      // eslint-disable-next-line prefer-destructuring
      const fearPeriodFoal = testHorses[2]; // In fear period

      const fearfulOpportunity = await evaluateTraitDevelopmentOpportunity(fearPeriodFoal.id, 'fearful', 'fear_period_1');
      const braveOpportunity = await evaluateTraitDevelopmentOpportunity(fearPeriodFoal.id, 'brave', 'fear_period_1');

      // Fear-related traits should have higher development potential during fear periods
      expect(fearfulOpportunity.windowAlignment).toBeGreaterThan(braveOpportunity.windowAlignment);
    });

    test('should provide appropriate recommendations', async () => {
      // eslint-disable-next-line prefer-destructuring
      const curiosityFoal = testHorses[3]; // Month old, curiosity development

      const opportunity = await evaluateTraitDevelopmentOpportunity(curiosityFoal.id, 'curious', 'curiosity_development');

      expect(opportunity.recommendedActions.length).toBeGreaterThan(0);
      expect(opportunity.recommendedActions.some(action => action.includes('exploration'))).toBe(true);
    });
  });

  describe('trackDevelopmentalMilestones', () => {
    test('should track developmental milestones with interactions', async () => {
      // eslint-disable-next-line prefer-destructuring
      const foal = testHorses[1];

      // Create some developmental interactions
      await prisma.groomInteraction.create({
        data: {
          groomId: testGrooms[0].id,
          foalId: foal.id,
          interactionType: 'enrichment',
          duration: 30,
          taskType: 'trust_building',
          bondingChange: 3,
          stressChange: 1,
          quality: 'excellent',
          cost: 40.0,
        },
      });

      const milestones = await trackDevelopmentalMilestones(foal.id);

      expect(milestones).toBeDefined();
      expect(milestones.horseId).toBe(foal.id);
      expect(milestones.achievedMilestones).toBeDefined();
      expect(milestones.pendingMilestones).toBeDefined();
      expect(milestones.milestoneProgress).toBeDefined();
      expect(milestones.developmentalScore).toBeDefined();
      expect(milestones.nextMilestones).toBeDefined();

      expect(Array.isArray(milestones.achievedMilestones)).toBe(true);
      expect(Array.isArray(milestones.pendingMilestones)).toBe(true);
      expect(milestones.developmentalScore).toBeGreaterThanOrEqual(0);
    });

    test('should show progression over time', async () => {
      // eslint-disable-next-line prefer-destructuring
      const olderFoal = testHorses[4]; // 3 months old

      const milestones = await trackDevelopmentalMilestones(olderFoal.id);

      // Older foal should have more achieved milestones
      expect(milestones.achievedMilestones.length).toBeGreaterThan(0);
      expect(milestones.developmentalScore).toBeGreaterThan(0.3);
    });
  });

  describe('assessWindowClosure', () => {
    test('should assess window closure effects', async () => {
      // eslint-disable-next-line prefer-destructuring
      const olderFoal = testHorses[4]; // Past early critical periods

      const closure = await assessWindowClosure(olderFoal.id, 'imprinting');

      expect(closure).toBeDefined();
      expect(closure.windowName).toBe('imprinting');
      expect(closure.closureStatus).toBeDefined();
      expect(closure.closureDate).toBeDefined();
      expect(closure.missedOpportunities).toBeDefined();
      expect(closure.compensatoryMechanisms).toBeDefined();
      expect(closure.futureImpact).toBeDefined();

      expect(closure.closureStatus).toBe('closed');
      expect(Array.isArray(closure.missedOpportunities)).toBe(true);
      expect(Array.isArray(closure.compensatoryMechanisms)).toBe(true);
    });

    test('should show open status for active windows', async () => {
      // eslint-disable-next-line prefer-destructuring
      const youngFoal = testHorses[1];

      const closure = await assessWindowClosure(youngFoal.id, 'early_socialization');

      expect(closure.closureStatus).toBe('open');
      expect(closure.missedOpportunities.length).toBe(0);
    });

    test('should identify compensatory mechanisms for closed windows', async () => {
      // eslint-disable-next-line prefer-destructuring
      const olderFoal = testHorses[4];

      const closure = await assessWindowClosure(olderFoal.id, 'fear_period_1');

      if (closure.closureStatus === 'closed') {
        expect(closure.compensatoryMechanisms.length).toBeGreaterThan(0);
      }
    });
  });

  describe('coordinateMultiWindowDevelopment', () => {
    test('should coordinate development across multiple windows', async () => {
      // eslint-disable-next-line prefer-destructuring
      const foal = testHorses[2]; // Two weeks old, multiple active windows

      const coordination = await coordinateMultiWindowDevelopment(foal.id);

      expect(coordination).toBeDefined();
      expect(coordination.horseId).toBe(foal.id);
      expect(coordination.activeWindows).toBeDefined();
      expect(coordination.windowInteractions).toBeDefined();
      expect(coordination.priorityMatrix).toBeDefined();
      expect(coordination.coordinatedPlan).toBeDefined();
      expect(coordination.conflictResolution).toBeDefined();

      expect(Array.isArray(coordination.activeWindows)).toBe(true);
      expect(Array.isArray(coordination.windowInteractions)).toBe(true);
      expect(coordination.coordinatedPlan.phases).toBeDefined();
    });

    test('should identify window conflicts and resolutions', async () => {
      // eslint-disable-next-line prefer-destructuring
      const conflictFoal = testHorses[2]; // In fear period

      const coordination = await coordinateMultiWindowDevelopment(conflictFoal.id);

      if (coordination.activeWindows.length > 1) {
        expect(coordination.conflictResolution).toBeDefined();
        expect(coordination.conflictResolution.identifiedConflicts).toBeDefined();
        expect(coordination.conflictResolution.resolutionStrategies).toBeDefined();
      }
    });
  });

  describe('analyzeCriticalPeriodSensitivity', () => {
    test('should analyze critical period sensitivity comprehensively', async () => {
      const [criticalFoal] = testHorses; // Newborn in critical period

      const analysis = await analyzeCriticalPeriodSensitivity(criticalFoal.id);

      expect(analysis).toBeDefined();
      expect(analysis.horseId).toBe(criticalFoal.id);
      expect(analysis.criticalPeriods).toBeDefined();
      expect(analysis.sensitivityProfile).toBeDefined();
      expect(analysis.riskFactors).toBeDefined();
      expect(analysis.protectiveFactors).toBeDefined();
      expect(analysis.interventionRecommendations).toBeDefined();

      expect(Array.isArray(analysis.criticalPeriods)).toBe(true);
      expect(analysis.sensitivityProfile.overallSensitivity).toBeDefined();
      expect(Array.isArray(analysis.riskFactors)).toBe(true);
      expect(Array.isArray(analysis.interventionRecommendations)).toBe(true);
    });

    test('should identify age-appropriate risk factors', async () => {
      // eslint-disable-next-line prefer-destructuring
      const stressedFoal = testHorses[2]; // Higher stress in fear period

      const analysis = await analyzeCriticalPeriodSensitivity(stressedFoal.id);

      expect(analysis.riskFactors.length).toBeGreaterThan(0);
      expect(analysis.riskFactors.some(factor => factor.includes('stress'))).toBe(true);
    });
  });

  describe('generateDevelopmentalForecast', () => {
    test('should generate comprehensive developmental forecast', async () => {
      // eslint-disable-next-line prefer-destructuring
      const foal = testHorses[3]; // Month old with good development

      const forecast = await generateDevelopmentalForecast(foal.id, 60); // 60-day forecast

      expect(forecast).toBeDefined();
      expect(forecast.horseId).toBe(foal.id);
      expect(forecast.forecastPeriod).toBe(60);
      expect(forecast.upcomingWindows).toBeDefined();
      expect(forecast.developmentalTrajectory).toBeDefined();
      expect(forecast.traitDevelopmentPredictions).toBeDefined();
      expect(forecast.milestoneProjections).toBeDefined();
      expect(forecast.riskAssessment).toBeDefined();
      expect(forecast.recommendations).toBeDefined();

      expect(Array.isArray(forecast.upcomingWindows)).toBe(true);
      expect(Array.isArray(forecast.traitDevelopmentPredictions)).toBe(true);
      expect(Array.isArray(forecast.recommendations)).toBe(true);
    });

    test('should project trait development accurately', async () => {
      // eslint-disable-next-line prefer-destructuring
      const developingFoal = testHorses[1];

      const forecast = await generateDevelopmentalForecast(developingFoal.id, 30);

      expect(forecast.traitDevelopmentPredictions.length).toBeGreaterThan(0);

      forecast.traitDevelopmentPredictions.forEach(prediction => {
        expect(prediction.trait).toBeDefined();
        expect(prediction.currentProbability).toBeDefined();
        expect(prediction.projectedProbability).toBeDefined();
        expect(prediction.developmentWindow).toBeDefined();
        expect(prediction.confidence).toBeDefined();
      });
    });

    test('should provide actionable recommendations', async () => {
      // eslint-disable-next-line prefer-destructuring
      const foal = testHorses[2];

      const forecast = await generateDevelopmentalForecast(foal.id, 45);

      expect(forecast.recommendations.length).toBeGreaterThan(0);

      forecast.recommendations.forEach(rec => {
        expect(rec.category).toBeDefined();
        expect(rec.action).toBeDefined();
        expect(rec.timeframe).toBeDefined();
        expect(rec.priority).toBeDefined();
      });
    });
  });
});
