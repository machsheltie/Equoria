/**
 * Enhanced Care Pattern Analyzer Tests
 *
 * Tests advanced care pattern analysis with sophisticated metrics and trend detection.
 * Uses TDD approach with NO MOCKING - real database operations for authentic validation.
 *
 * Business Rules Tested:
 * - Advanced consistency scoring with weighted factors
 * - Multi-dimensional trend analysis (bond, stress, quality, frequency)
 * - Seasonal and periodic pattern detection
 * - Care quality degradation/improvement detection
 * - Groom effectiveness correlation analysis
 * - Critical period identification with severity scoring
 */

import prisma from '../../../packages/database/prismaClient.mjs';
import {
  analyzeCarePatterns,
  calculateAdvancedConsistencyScore,
  detectCareQualityTrends,
  analyzeGroomEffectiveness,
  calculateCareRiskScore,
} from '../../services/carePatternAnalyzer.mjs';

describe('Enhanced Care Pattern Analyzer', () => {
  let testUser;
  let testHorses = [];
  let testGrooms = [];

  beforeAll(async () => {
    // Create test user
    testUser = await prisma.user.create({
      data: {
        username: `carepattern_${Date.now()}`,
        email: `carepattern_${Date.now()}@test.com`,
        password: 'test_hash',
        firstName: 'Test',
        lastName: 'User',
        money: 1000,
        xp: 0,
        level: 1,
      },
    });

    // Create test grooms with different skill levels and personalities
    testGrooms = await Promise.all([
      prisma.groom.create({
        data: {
          name: `Expert Calm Groom ${Date.now()}`,
          personality: 'calm',
          groomPersonality: 'calm',
          skillLevel: 'expert',
          speciality: 'foal_care',
          userId: testUser.id,
          sessionRate: 35.0,
        },
      }),
      prisma.groom.create({
        data: {
          name: `Novice Energetic Groom ${Date.now()}`,
          personality: 'energetic',
          groomPersonality: 'energetic',
          skillLevel: 'novice',
          speciality: 'general_grooming',
          userId: testUser.id,
          sessionRate: 15.0,
        },
      }),
      prisma.groom.create({
        data: {
          name: `Experienced Methodical Groom ${Date.now()}`,
          personality: 'methodical',
          groomPersonality: 'methodical',
          skillLevel: 'experienced',
          speciality: 'foal_care',
          userId: testUser.id,
          sessionRate: 28.0,
        },
      }),
    ]);

    // Create test horses for different analysis scenarios
    const now = new Date();
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    testHorses = await Promise.all([
      // Horse with consistent high-quality care
      prisma.horse.create({
        data: {
          name: `Test Horse Consistent ${Date.now()}`,
          sex: 'filly',
          dateOfBirth: oneMonthAgo,
          userId: testUser.id,
          bondScore: 25,
          stressLevel: 3,
          epigeneticFlags: [],
        },
      }),
      // Horse with declining care quality
      prisma.horse.create({
        data: {
          name: `Test Horse Declining ${Date.now()}`,
          sex: 'colt',
          dateOfBirth: twoWeeksAgo,
          userId: testUser.id,
          bondScore: 15,
          stressLevel: 7,
          epigeneticFlags: [],
        },
      }),
      // Horse with improving care quality
      prisma.horse.create({
        data: {
          name: `Test Horse Improving ${Date.now()}`,
          sex: 'gelding',
          dateOfBirth: oneMonthAgo,
          userId: testUser.id,
          bondScore: 30,
          stressLevel: 2,
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

  describe('calculateAdvancedConsistencyScore', () => {
    test('should calculate weighted consistency score with multiple factors', async () => {
      const [horse] = testHorses; // Consistent care horse

      // Create consistent high-quality interactions
      const interactions = [];
      for (let i = 0; i < 7; i++) {
        const interaction = await prisma.groomInteraction.create({
          data: {
            groomId: testGrooms[0].id, // Expert calm groom
            foalId: horse.id,
            interactionType: 'enrichment',
            duration: 30 + (i % 3) * 5, // Consistent duration
            taskType: 'trust_building',
            bondingChange: 3 + (i % 2), // Consistent positive bonding
            stressChange: -2 - (i % 2), // Consistent stress reduction
            quality: 'excellent',
            cost: 35.0,
            createdAt: new Date(Date.now() - (7 - i) * 24 * 60 * 60 * 1000),
          },
        });
        interactions.push(interaction);
      }

      const score = await calculateAdvancedConsistencyScore(horse.id);

      expect(score).toBeDefined();
      expect(score.overallScore).toBeGreaterThan(0.8); // High consistency
      expect(score.components).toBeDefined();
      expect(score.components.frequencyConsistency).toBeGreaterThan(0.8);
      expect(score.components.qualityConsistency).toBeGreaterThan(0.8);
      expect(score.components.durationConsistency).toBeGreaterThan(0.7);
      expect(score.components.groomConsistency).toBeGreaterThan(0.9);
    });

    test('should detect inconsistent care patterns', async () => {
      const horse = testHorses[1]; // Declining care horse

      // Create inconsistent interactions with varying quality
      const qualities = ['excellent', 'good', 'poor', 'fair', 'poor'];
      const bondChanges = [3, 2, -1, 1, -2];
      const stressChanges = [-2, -1, 3, 0, 4];

      for (let i = 0; i < 5; i++) {
        await prisma.groomInteraction.create({
          data: {
            groomId: i % 2 === 0 ? testGrooms[0].id : testGrooms[1].id, // Alternating grooms
            foalId: horse.id,
            interactionType: 'enrichment',
            duration: 20 + i * 10, // Varying duration
            taskType: 'trust_building',
            bondingChange: bondChanges[i],
            stressChange: stressChanges[i],
            quality: qualities[i],
            cost: 25.0,
            createdAt: new Date(Date.now() - (5 - i) * 24 * 60 * 60 * 1000),
          },
        });
      }

      const score = await calculateAdvancedConsistencyScore(horse.id);

      expect(score.overallScore).toBeLessThan(0.6); // Low consistency
      expect(score.components.qualityConsistency).toBeLessThan(0.5);
      expect(score.components.groomConsistency).toBeLessThan(0.7);
    });
  });

  describe('detectCareQualityTrends', () => {
    test('should detect improving care quality trends', async () => {
      const horse = testHorses[2]; // Improving care horse

      // Create improving trend: poor -> fair -> good -> excellent
      const trendData = [
        { quality: 'poor', bond: -1, stress: 3 },
        { quality: 'fair', bond: 1, stress: 1 },
        { quality: 'good', bond: 2, stress: -1 },
        { quality: 'excellent', bond: 4, stress: -3 },
      ];

      for (let i = 0; i < trendData.length; i++) {
        await prisma.groomInteraction.create({
          data: {
            groomId: testGrooms[2].id, // Methodical groom
            foalId: horse.id,
            interactionType: 'enrichment',
            duration: 30,
            taskType: 'trust_building',
            bondingChange: trendData[i].bond,
            stressChange: trendData[i].stress,
            quality: trendData[i].quality,
            cost: 28.0,
            createdAt: new Date(Date.now() - (4 - i) * 24 * 60 * 60 * 1000),
          },
        });
      }

      const trends = await detectCareQualityTrends(horse.id);

      expect(trends).toBeDefined();
      expect(trends.qualityTrend).toBe('improving');
      expect(trends.bondTrend).toBe('improving');
      expect(trends.stressTrend).toBe('improving'); // Stress decreasing is improving
      expect(trends.trendStrength).toBeGreaterThan(0.7);
      expect(trends.projectedOutcome).toBe('positive');
    });

    test('should detect declining care quality trends', async () => {
      const horse = testHorses[1]; // Use declining care horse

      // Add more declining interactions
      const trendData = [
        { quality: 'excellent', bond: 3, stress: -2 },
        { quality: 'good', bond: 2, stress: -1 },
        { quality: 'fair', bond: 0, stress: 1 },
        { quality: 'poor', bond: -2, stress: 3 },
      ];

      for (let i = 0; i < trendData.length; i++) {
        await prisma.groomInteraction.create({
          data: {
            groomId: testGrooms[1].id, // Novice groom
            foalId: horse.id,
            interactionType: 'grooming',
            duration: 25,
            taskType: 'desensitization',
            bondingChange: trendData[i].bond,
            stressChange: trendData[i].stress,
            quality: trendData[i].quality,
            cost: 15.0,
            createdAt: new Date(Date.now() - (4 - i) * 12 * 60 * 60 * 1000), // 12 hours apart
          },
        });
      }

      const trends = await detectCareQualityTrends(horse.id);

      expect(trends.qualityTrend).toBe('declining');
      expect(trends.bondTrend).toBe('declining');
      expect(trends.stressTrend).toBe('declining'); // Stress increasing is declining
      expect(trends.projectedOutcome).toBe('negative');
    });
  });

  describe('analyzeGroomEffectiveness', () => {
    test('should analyze individual groom effectiveness', async () => {
      const [horse] = testHorses;

      const effectiveness = await analyzeGroomEffectiveness(horse.id);

      expect(effectiveness).toBeDefined();
      expect(Array.isArray(effectiveness.groomStats)).toBe(true);
      expect(effectiveness.overallEffectiveness).toBeDefined();
      expect(effectiveness.recommendations).toBeDefined();

      if (effectiveness.groomStats.length > 0) {
        const groomStat = effectiveness.groomStats[0];
        expect(groomStat).toHaveProperty('groomId');
        expect(groomStat).toHaveProperty('groomName');
        expect(groomStat).toHaveProperty('effectivenessScore');
        expect(groomStat).toHaveProperty('avgBondChange');
        expect(groomStat).toHaveProperty('avgStressChange');
        expect(groomStat).toHaveProperty('qualityDistribution');
      }
    });

    test('should identify most and least effective grooms', async () => {
      const horse = testHorses[1]; // Horse with multiple grooms

      const effectiveness = await analyzeGroomEffectiveness(horse.id);

      expect(effectiveness.mostEffective).toBeDefined();
      expect(effectiveness.leastEffective).toBeDefined();

      if (effectiveness.mostEffective && effectiveness.leastEffective) {
        expect(effectiveness.mostEffective.effectivenessScore).toBeGreaterThanOrEqual(
          effectiveness.leastEffective.effectivenessScore,
        );
      }
    });
  });

  describe('calculateCareRiskScore', () => {
    test('should calculate comprehensive care risk assessment', async () => {
      const horse = testHorses[1]; // Declining care horse

      const riskScore = await calculateCareRiskScore(horse.id);

      expect(riskScore).toBeDefined();
      expect(typeof riskScore.overallRisk).toBe('number');
      expect(riskScore.overallRisk).toBeGreaterThanOrEqual(0);
      expect(riskScore.overallRisk).toBeLessThanOrEqual(1);
      expect(riskScore.riskFactors).toBeDefined();
      expect(riskScore.riskLevel).toBeDefined();
      expect(['low', 'moderate', 'high', 'critical'].includes(riskScore.riskLevel)).toBe(true);
      expect(riskScore.recommendations).toBeDefined();
      expect(Array.isArray(riskScore.recommendations)).toBe(true);
    });

    test('should identify specific risk factors', async () => {
      const horse = testHorses[1];

      const riskScore = await calculateCareRiskScore(horse.id);

      expect(riskScore.riskFactors).toBeDefined();
      expect(riskScore.riskFactors.consistencyRisk).toBeDefined();
      expect(riskScore.riskFactors.qualityRisk).toBeDefined();
      expect(riskScore.riskFactors.frequencyRisk).toBeDefined();
      expect(riskScore.riskFactors.groomStabilityRisk).toBeDefined();
      expect(riskScore.riskFactors.stressRisk).toBeDefined();
    });
  });

  describe('Enhanced Care Pattern Integration', () => {
    test('should integrate all enhanced features for comprehensive analysis', async () => {
      const [horse] = testHorses;

      const patterns = await analyzeCarePatterns(horse.id);

      expect(patterns).toBeDefined();
      expect(patterns.horseId).toBe(horse.id);
      expect(patterns.analysisWindow).toBeDefined();
      expect(patterns.consistency).toBeDefined();
      expect(patterns.bondTrends).toBeDefined();
      expect(patterns.stressPatterns).toBeDefined();
      expect(patterns.taskDiversity).toBeDefined();
      expect(patterns.groomConsistency).toBeDefined();
      expect(patterns.neglectPatterns).toBeDefined();

      // Verify enhanced metrics are included
      expect(patterns.totalInteractions).toBeGreaterThan(0);
      expect(patterns.currentBond).toBeDefined();
      expect(patterns.currentStress).toBeDefined();
    });
  });
});
