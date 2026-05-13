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
        username: `dev_window_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        email: `dev_window_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@test.com`,
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
          name: `Developmental Groom ${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          personality: 'calm',
          epigeneticInfluenceType: 'calm',
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
          name: `Test Foal Newborn ${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          sex: 'filly',
          dateOfBirth: oneDayAgo,
          userId: testUser.id,
          bondScore: 5,
          stressLevel: 3,
          epigeneticFlags: ['developing'],
        },
      }),
      // Week-old foal - early socialization window
      prisma.horse.create({
        data: {
          name: `Test Foal Week ${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          sex: 'colt',
          dateOfBirth: oneWeekAgo,
          userId: testUser.id,
          bondScore: 12,
          stressLevel: 4,
          epigeneticFlags: ['curious'],
        },
      }),
      // Two-week-old foal - fear period window
      prisma.horse.create({
        data: {
          name: `Test Foal TwoWeek ${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          sex: 'filly',
          dateOfBirth: twoWeeksAgo,
          userId: testUser.id,
          bondScore: 18,
          stressLevel: 6,
          epigeneticFlags: ['sensitive'],
        },
      }),
      // Month-old foal - curiosity development window
      prisma.horse.create({
        data: {
          name: `Test Foal Month ${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          sex: 'Colt',
          dateOfBirth: oneMonthAgo,
          userId: testUser.id,
          bondScore: 25,
          stressLevel: 5,
          epigeneticFlags: ['curious', 'social'],
        },
      }),
      // Three-month-old foal - independence development
      prisma.horse.create({
        data: {
          name: `Test Foal ThreeMonth ${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          sex: 'colt',
          dateOfBirth: threeMonthsAgo,
          userId: testUser.id,
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
    if (testUser) {
      await prisma.user.deleteMany({ where: { id: testUser.id } });
    }
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
      const weekOldFoal = testHorses[1]; // 7 days old

      const windows = await identifyDevelopmentalWindows(weekOldFoal.id);

      // Should be in multiple overlapping windows
      expect(windows.activeWindows.length).toBeGreaterThan(1);

      // Should include early socialization
      const socializationWindow = windows.activeWindows.find(w => w.name === 'early_socialization');
      expect(socializationWindow).toBeDefined();
    });

    test('should show closed windows for older foals', async () => {
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
      const olderFoal = testHorses[4];

      const sensitivity = await calculateWindowSensitivity(olderFoal.id, 'imprinting');

      // Should be low sensitivity for closed window
      expect(sensitivity.finalSensitivity).toBeLessThan(0.3);
      expect(sensitivity.sensitivityLevel).toBe('minimal');
    });

    test('should apply environmental modifiers correctly', async () => {
      const stressedFoal = testHorses[2]; // Higher stress level

      const calmFoal = testHorses[4]; // Lower stress level

      const stressedSensitivity = await calculateWindowSensitivity(stressedFoal.id, 'fear_period_1');
      const calmSensitivity = await calculateWindowSensitivity(calmFoal.id, 'fear_period_1');

      // Stressed foal should have higher sensitivity to fear periods
      expect(stressedSensitivity.environmentalModifier).toBeGreaterThan(calmSensitivity.environmentalModifier);
    });
  });

  describe('evaluateTraitDevelopmentOpportunity', () => {
    test('should evaluate trait development opportunities during active windows', async () => {
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
      const fearPeriodFoal = testHorses[2]; // In fear period

      const fearfulOpportunity = await evaluateTraitDevelopmentOpportunity(
        fearPeriodFoal.id,
        'fearful',
        'fear_period_1',
      );
      const braveOpportunity = await evaluateTraitDevelopmentOpportunity(fearPeriodFoal.id, 'brave', 'fear_period_1');

      // Fear-related traits should have higher development potential during fear periods
      expect(fearfulOpportunity.windowAlignment).toBeGreaterThan(braveOpportunity.windowAlignment);
    });

    test('should provide appropriate recommendations', async () => {
      const curiosityFoal = testHorses[3]; // Month old, curiosity development

      const opportunity = await evaluateTraitDevelopmentOpportunity(
        curiosityFoal.id,
        'curious',
        'curiosity_development',
      );

      expect(opportunity.recommendedActions.length).toBeGreaterThan(0);
      expect(opportunity.recommendedActions.some(action => action.includes('exploration'))).toBe(true);
    });
  });

  describe('trackDevelopmentalMilestones', () => {
    test('should track developmental milestones with interactions', async () => {
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
      const olderFoal = testHorses[4]; // 3 months old

      const milestones = await trackDevelopmentalMilestones(olderFoal.id);

      // Older foal should have more achieved milestones
      expect(milestones.achievedMilestones.length).toBeGreaterThan(0);
      expect(milestones.developmentalScore).toBeGreaterThan(0.3);
    });
  });

  describe('assessWindowClosure', () => {
    test('should assess window closure effects', async () => {
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
      const youngFoal = testHorses[1];

      const closure = await assessWindowClosure(youngFoal.id, 'early_socialization');

      expect(closure.closureStatus).toBe('open');
      expect(closure.missedOpportunities.length).toBe(0);
    });

    test('should identify compensatory mechanisms for closed windows', async () => {
      const olderFoal = testHorses[4];

      const closure = await assessWindowClosure(olderFoal.id, 'fear_period_1');

      if (closure.closureStatus === 'closed') {
        expect(closure.compensatoryMechanisms.length).toBeGreaterThan(0);
      }
    });
  });

  describe('coordinateMultiWindowDevelopment', () => {
    test('should coordinate development across multiple windows', async () => {
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
      const stressedFoal = testHorses[2]; // Higher stress in fear period

      const analysis = await analyzeCriticalPeriodSensitivity(stressedFoal.id);

      expect(analysis.riskFactors.length).toBeGreaterThan(0);
      expect(analysis.riskFactors.some(factor => factor.includes('stress'))).toBe(true);
    });
  });

  describe('generateDevelopmentalForecast', () => {
    test('should generate comprehensive developmental forecast', async () => {
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

  // ── Branch coverage additions (Equoria-rr7) ─────────────────────────────────
  describe('branch coverage additions (Equoria-rr7)', () => {
    let sixtyDayHorse;
    let youngFearfulHorse;
    let rr7BranchUser;

    beforeAll(async () => {
      rr7BranchUser = await prisma.user.create({
        data: {
          username: `TestFixture-DWS-rr7-${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          email: `TestFixture-DWS-rr7-${Date.now()}_${Math.random().toString(36).slice(2, 6)}@test.com`,
          password: 'test_hash',
          firstName: 'DWS',
          lastName: 'Branch',
          money: 0,
          xp: 0,
          level: 1,
        },
      });
      const now = new Date();
      sixtyDayHorse = await prisma.horse.create({
        data: {
          name: `TestFixture-DWS-60Day-${Date.now()}`,
          sex: 'Filly',
          dateOfBirth: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
          userId: rr7BranchUser.id,
          stressLevel: 3,
          bondScore: 20,
          epigeneticFlags: [],
        },
      });
      youngFearfulHorse = await prisma.horse.create({
        data: {
          name: `TestFixture-DWS-YngFear-${Date.now()}`,
          sex: 'Colt',
          dateOfBirth: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          userId: rr7BranchUser.id,
          stressLevel: 6,
          bondScore: 10,
          epigeneticFlags: ['fearful'],
        },
      });
    });

    afterAll(async () => {
      await prisma.horse.deleteMany({
        where: { id: { in: [sixtyDayHorse.id, youngFearfulHorse.id] } },
      });
      await prisma.user.delete({ where: { id: rr7BranchUser.id } });
    });

    // line 139: identifyDevelopmentalWindows throws when horse not found
    test('identifyDevelopmentalWindows: throws for non-existent horse (line 139)', async () => {
      await expect(identifyDevelopmentalWindows(999999999)).rejects.toThrow('Horse not found');
    });

    // line 221: calculateWindowSensitivity throws for unknown window
    test('calculateWindowSensitivity: throws for unknown window name (line 221)', async () => {
      await expect(calculateWindowSensitivity(sixtyDayHorse.id, 'invalid_window')).rejects.toThrow(
        'Unknown developmental window',
      );
    });

    // line 278: sensitivityLevel='low' — 60-day horse at start of independence_development
    // baseSensitivity=0.5, ageModifier=0.7 (at edge), envMod≈1.04 → finalSensitivity≈0.364 ∈ [0.2,0.4)
    test('calculateWindowSensitivity: sensitivityLevel=low for 60-day horse at independence_development edge (line 278)', async () => {
      const sensitivity = await calculateWindowSensitivity(sixtyDayHorse.id, 'independence_development');
      expect(sensitivity.sensitivityLevel).toBe('low');
    });

    // line 313: evaluateTraitDevelopmentOpportunity throws for unknown window
    test('evaluateTraitDevelopmentOpportunity: throws for unknown window name (line 313)', async () => {
      await expect(evaluateTraitDevelopmentOpportunity(sixtyDayHorse.id, 'brave', 'invalid_window')).rejects.toThrow(
        'Unknown developmental window',
      );
    });

    // line 328: windowAlignment=0.2 — riskTrait in a non-fear-period window
    // fearful is in early_socialization.riskTraits, but 'early_socialization'.includes('fear_period')=false
    test('evaluateTraitDevelopmentOpportunity: windowAlignment=0.2 for riskTrait in non-fear window (line 328)', async () => {
      const opp = await evaluateTraitDevelopmentOpportunity(testHorses[0].id, 'fearful', 'early_socialization');
      expect(opp.windowAlignment).toBeCloseTo(0.2, 5);
    });

    // line 340: windowAlignment=0.7 — related trait overlaps targetTraits
    // brave not in early_socialization target/risk; relatedTrait 'confident' IS in targetTraits
    test('evaluateTraitDevelopmentOpportunity: windowAlignment=0.7 when relatedTrait in targetTraits (line 340)', async () => {
      const opp = await evaluateTraitDevelopmentOpportunity(testHorses[0].id, 'brave', 'early_socialization');
      expect(opp.windowAlignment).toBeCloseTo(0.7, 5);
    });

    // line 342: windowAlignment=0.3 — related trait overlaps riskTraits
    // fearful not in independence_development target/risk; relatedTrait 'insecure' IS in riskTraits
    test('evaluateTraitDevelopmentOpportunity: windowAlignment=0.3 when relatedTrait in riskTraits (line 342)', async () => {
      const opp = await evaluateTraitDevelopmentOpportunity(testHorses[0].id, 'fearful', 'independence_development');
      expect(opp.windowAlignment).toBeCloseTo(0.3, 5);
    });

    // line 485: assessWindowClosure throws for unknown window
    test('assessWindowClosure: throws for unknown window name (line 485)', async () => {
      await expect(assessWindowClosure(sixtyDayHorse.id, 'invalid_window')).rejects.toThrow(
        'Unknown developmental window',
      );
    });

    // line 501: closureStatus='upcoming' — horse younger than window.startDay
    // testHorses[0] is 1 day old; social_hierarchy startDay=30 → upcoming
    test('assessWindowClosure: closureStatus=upcoming when horse age < window startDay (line 501)', async () => {
      const closure = await assessWindowClosure(testHorses[0].id, 'social_hierarchy');
      expect(closure.closureStatus).toBe('upcoming');
    });

    // lines 540-541: futureImpact='moderate' — daysSinceClosure <= 30
    // testHorses[1] is 7 days old; imprinting endDay=3 → daysSinceClosure=4 ≤ 30
    test('assessWindowClosure: futureImpact=moderate when daysSinceClosure <= 30 (line 541)', async () => {
      const closure = await assessWindowClosure(testHorses[1].id, 'imprinting');
      expect(closure.closureStatus).toBe('closed');
      expect(closure.futureImpact).toBe('moderate');
    });

    // lines 687 + 690: protectiveFactors — strong bond and confident flag
    // testHorses[4]: bondScore=35 > 25, epigeneticFlags=['confident','independent']
    test('analyzeCriticalPeriodSensitivity: strong bond (687) and confidence (690) protective factors', async () => {
      const analysis = await analyzeCriticalPeriodSensitivity(testHorses[4].id);
      expect(analysis.protectiveFactors).toContain('Strong bonding relationship');
      expect(analysis.protectiveFactors).toContain('Confidence trait present');
    });

    // lines 675 + 678: riskFactors — fearful flag in young horse + stress in early development
    // youngFearfulHorse: age=7, stressLevel=6 > 4, flags=['fearful']
    test('analyzeCriticalPeriodSensitivity: early-fear (675) and early-stress (678) risk factors', async () => {
      const analysis = await analyzeCriticalPeriodSensitivity(youngFearfulHorse.id);
      expect(analysis.riskFactors).toContain('Early fear trait development');
      expect(analysis.riskFactors).toContain('Stress during critical early development');
    });
  });

  // ── Branch coverage additions II (Equoria-rr7) ──────────────────────────────
  describe('branch coverage additions II (Equoria-rr7)', () => {
    let fortyDayHorse;
    let newbornHighStressHorse;
    let rr7BiiUser;

    beforeAll(async () => {
      rr7BiiUser = await prisma.user.create({
        data: {
          username: `TestFixture-DWS-BII-${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          email: `TestFixture-DWS-BII-${Date.now()}_${Math.random().toString(36).slice(2, 6)}@test.com`,
          password: 'test_hash',
          firstName: 'DWSBII',
          lastName: 'Branch',
          money: 0,
          xp: 0,
          level: 1,
        },
      });
      const now = new Date();
      fortyDayHorse = await prisma.horse.create({
        data: {
          name: `TestFixture-DWS-40Day-${Date.now()}`,
          sex: 'Colt',
          dateOfBirth: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
          userId: rr7BiiUser.id,
          stressLevel: 8,
          bondScore: 10,
          epigeneticFlags: [],
        },
      });
      newbornHighStressHorse = await prisma.horse.create({
        data: {
          name: `TestFixture-DWS-NBHighStress-${Date.now()}`,
          sex: 'Filly',
          dateOfBirth: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
          userId: rr7BiiUser.id,
          stressLevel: 8,
          bondScore: 5,
          epigeneticFlags: [],
        },
      });
    });

    afterAll(async () => {
      await prisma.horse.deleteMany({
        where: { id: { in: [fortyDayHorse.id, newbornHighStressHorse.id] } },
      });
      await prisma.user.delete({ where: { id: rr7BiiUser.id } });
    });

    // line 539: futureImpact='significant' — 30 < daysSinceClosure <= 60
    // 40-day horse + imprinting (endDay=3): daysSinceClosure=37 ∈ (30,60]
    test('assessWindowClosure: futureImpact=significant when 30 < daysSinceClosure <= 60 (line 539)', async () => {
      const closure = await assessWindowClosure(fortyDayHorse.id, 'imprinting');
      expect(closure.closureStatus).toBe('closed');
      expect(closure.futureImpact).toBe('significant');
    });

    // line 574: coordinateMultiWindowDevelopment early return when activeWindows.length <= 1
    // testHorses[4] at ~90 days has exactly 1 active window (independence_development)
    test('coordinateMultiWindowDevelopment: empty coord when <= 1 active windows (line 574)', async () => {
      const coord = await coordinateMultiWindowDevelopment(testHorses[4].id);
      expect(coord.windowInteractions).toEqual([]);
      expect(coord.priorityMatrix).toEqual({});
      expect(coord.coordinatedPlan.phases).toEqual([]);
    });

    // line 832: 'social' trait-specific recommendation
    // social IS in early_socialization.targetTraits → high opportunity → social recommendation
    test('evaluateTraitDevelopmentOpportunity: social-specific recommendation (line 832)', async () => {
      const opp = await evaluateTraitDevelopmentOpportunity(testHorses[0].id, 'social', 'early_socialization');
      expect(opp.recommendedActions.some(a => a.toLowerCase().includes('interaction'))).toBe(true);
    });

    // lines 978-981: 'early_socialization' compensatory mechanisms
    test('assessWindowClosure: early_socialization compensatory mechanisms (lines 978-981)', async () => {
      const closure = await assessWindowClosure(testHorses[4].id, 'early_socialization');
      expect(closure.closureStatus).toBe('closed');
      expect(closure.compensatoryMechanisms.some(m => m.toLowerCase().includes('socialization'))).toBe(true);
    });

    // lines 989-992: 'curiosity_development' compensatory mechanisms
    test('assessWindowClosure: curiosity_development compensatory mechanisms (lines 989-992)', async () => {
      const closure = await assessWindowClosure(testHorses[4].id, 'curiosity_development');
      expect(closure.closureStatus).toBe('closed');
      expect(closure.compensatoryMechanisms.some(m => m.toLowerCase().includes('enrichment'))).toBe(true);
    });

    // lines 993-997: 'social_hierarchy' compensatory mechanisms
    test('assessWindowClosure: social_hierarchy compensatory mechanisms (lines 993-997)', async () => {
      const closure = await assessWindowClosure(testHorses[4].id, 'social_hierarchy');
      expect(closure.closureStatus).toBe('closed');
      expect(closure.compensatoryMechanisms.some(m => m.toLowerCase().includes('social'))).toBe(true);
    });

    // line 1294: assessDevelopmentalRisks — high stress risk pushed
    // fortyDayHorse stressLevel=8 > 6
    test('generateDevelopmentalForecast: high stress risk in riskAssessment (line 1294)', async () => {
      const forecast = await generateDevelopmentalForecast(fortyDayHorse.id, 30);
      expect(forecast.riskAssessment.risks.some(r => r.risk.includes('High stress'))).toBe(true);
    });

    // line 1311: assessDevelopmentalRisks — multiple critical periods overlap
    // newbornHighStressHorse (1-day, forecast 30): imprinting (sens=1.0) + early_socialization (sens=0.9) → 2 > 1
    test('generateDevelopmentalForecast: multiple critical windows overlap risk (line 1311)', async () => {
      const forecast = await generateDevelopmentalForecast(newbornHighStressHorse.id, 30);
      expect(forecast.riskAssessment.risks.some(r => r.risk.includes('Multiple critical'))).toBe(true);
    });
  });

  // ── Branch coverage additions III (Equoria-rr7) ─────────────────────────────
  describe('branch coverage additions III (Equoria-rr7)', () => {
    let eighteenDayHorse;
    let twentyOneDayHorse;
    let over135DayHorse;
    let rr7BiiiGroom;
    let rr7BiiiUser;

    beforeAll(async () => {
      rr7BiiiUser = await prisma.user.create({
        data: {
          username: `TestFixture-DWS-BIII-${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          email: `TestFixture-DWS-BIII-${Date.now()}_${Math.random().toString(36).slice(2, 6)}@test.com`,
          password: 'test_hash',
          firstName: 'DWSBIII',
          lastName: 'Branch',
          money: 0,
          xp: 0,
          level: 1,
        },
      });
      rr7BiiiGroom = await prisma.groom.create({
        data: {
          name: `TestFixture-DWS-BIII-Groom-${Date.now()}`,
          personality: 'calm',
          epigeneticInfluenceType: 'calm',
          skillLevel: 'expert',
          speciality: 'foal_care',
          userId: rr7BiiiUser.id,
          sessionRate: 40.0,
          experience: 100,
          level: 5,
        },
      });
      const now = new Date();
      eighteenDayHorse = await prisma.horse.create({
        data: {
          name: `TestFixture-DWS-18Day-${Date.now()}`,
          sex: 'Filly',
          dateOfBirth: new Date(now.getTime() - 18 * 24 * 60 * 60 * 1000),
          userId: rr7BiiiUser.id,
          stressLevel: 3,
          bondScore: 15,
          epigeneticFlags: [],
        },
      });
      twentyOneDayHorse = await prisma.horse.create({
        data: {
          name: `TestFixture-DWS-21Day-${Date.now()}`,
          sex: 'Colt',
          dateOfBirth: new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000),
          userId: rr7BiiiUser.id,
          stressLevel: 3,
          bondScore: 20,
          epigeneticFlags: [],
        },
      });
      over135DayHorse = await prisma.horse.create({
        data: {
          name: `TestFixture-DWS-135Day-${Date.now()}`,
          sex: 'Filly',
          dateOfBirth: new Date(now.getTime() - 135 * 24 * 60 * 60 * 1000),
          userId: rr7BiiiUser.id,
          stressLevel: 3,
          bondScore: 30,
          epigeneticFlags: [],
        },
      });
      // Create 2 interactions during early_socialization window (interactionAge=10)
      // so interactions.length >= 2 is true when environmental_comfort is assessed
      const birthDate = new Date(now.getTime() - 135 * 24 * 60 * 60 * 1000);
      const dayTen = new Date(birthDate.getTime() + 10 * 24 * 60 * 60 * 1000);
      await prisma.groomInteraction.create({
        data: {
          groomId: rr7BiiiGroom.id,
          foalId: over135DayHorse.id,
          interactionType: 'enrichment',
          duration: 30,
          bondingChange: 2,
          stressChange: 0,
          quality: 'good',
          cost: 20.0,
          createdAt: dayTen,
        },
      });
      await prisma.groomInteraction.create({
        data: {
          groomId: rr7BiiiGroom.id,
          foalId: over135DayHorse.id,
          interactionType: 'trust_building',
          duration: 20,
          bondingChange: 1,
          stressChange: -1,
          quality: 'excellent',
          cost: 15.0,
          createdAt: dayTen,
        },
      });
    });

    afterAll(async () => {
      await prisma.groomInteraction.deleteMany({ where: { groomId: rr7BiiiGroom.id } });
      await prisma.groom.delete({ where: { id: rr7BiiiGroom.id } });
      await prisma.horse.deleteMany({
        where: { id: { in: [eighteenDayHorse.id, twentyOneDayHorse.id, over135DayHorse.id] } },
      });
      await prisma.user.delete({ where: { id: rr7BiiiUser.id } });
    });

    // lines 1062, 1071: urgency='high' + daysRemaining<=3 in createPriorityMatrix
    // 18-day horse: early_socialization daysRemaining=3 → urgency='high', daysRemaining<=3
    test('createPriorityMatrix: high-urgency and daysRemaining<=3 branches (lines 1062, 1071)', async () => {
      const coord = await coordinateMultiWindowDevelopment(eighteenDayHorse.id);
      expect(Object.keys(coord.priorityMatrix).length).toBeGreaterThan(0);
      const earlySocPriority = coord.priorityMatrix['early_socialization'];
      expect(earlySocPriority).toBeDefined();
      // base 0.9 + 0.2 (high urgency) + 0.1 (daysRemaining=3 <=3) = 1.2 → capped at 1.0
      expect(earlySocPriority).toBeGreaterThanOrEqual(1.0);
    });

    // lines 1060, 1069, 1113-1116: critical urgency + daysRemaining<=1 + 3-window else branch
    // 21-day horse: 3 active windows (early_socialization/curiosity_development/fear_period_2)
    // early_socialization daysRemaining=0 → urgency='critical', daysRemaining<=1
    // 3rd window hits currentPhase.windows.length>=2 else branch → 2 phases
    test('createPriorityMatrix + generateCoordinatedPlan: critical urgency and 3-window else branch (lines 1060, 1069, 1113-1116)', async () => {
      const coord = await coordinateMultiWindowDevelopment(twentyOneDayHorse.id);
      expect(coord.activeWindows.length).toBe(3);
      expect(Object.keys(coord.priorityMatrix).length).toBe(3);
      // 3rd window overflows phase 1 (max 2) → 2 phases total
      expect(coord.coordinatedPlan.phases.length).toBe(2);
    });

    // line 919: self_confidence case in assessMilestoneAchievement
    // 135-day horse: independence_development endDay=120, currentAge=135 > 120 → window passed
    // bondScore=30 > 25 → self_confidence achieved=true
    test('trackDevelopmentalMilestones: self_confidence milestone assessed (line 919)', async () => {
      const milestones = await trackDevelopmentalMilestones(over135DayHorse.id);
      expect(milestones.milestoneProgress.self_confidence).toBeDefined();
      expect(milestones.milestoneProgress.self_confidence.achieved).toBe(true);
    });

    // lines 999-1002: independence_development case in generateCompensatoryMechanisms
    // 135-day horse: independence_development endDay=120 < 135 → closed window
    test('assessWindowClosure: independence_development compensatory mechanisms (lines 999-1002)', async () => {
      const closure = await assessWindowClosure(over135DayHorse.id, 'independence_development');
      expect(closure.closureStatus).toBe('closed');
      expect(closure.compensatoryMechanisms.some(m => m.toLowerCase().includes('independence'))).toBe(true);
    });

    // line 906: interactions.length >= 2 branch in environmental_comfort assessment
    // 135-day horse has 2 interactions with interactionAge=10 (within early_socialization window 1-21)
    test('trackDevelopmentalMilestones: environmental_comfort interactions.length>=2 branch (line 906)', async () => {
      const milestones = await trackDevelopmentalMilestones(over135DayHorse.id);
      const ec = milestones.milestoneProgress.environmental_comfort;
      expect(ec).toBeDefined();
      // 2 window interactions → interactions.length >= 2 is true → achieved=true
      expect(ec.achieved).toBe(true);
    });
  });
});
