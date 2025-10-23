/**
 * Genetic Diversity Tracking System Tests
 *
 * Tests for advanced genetic diversity algorithms, inbreeding coefficient calculations,
 * and comprehensive breeding recommendations for population-level genetic management.
 *
 * Testing Approach: TDD with NO MOCKING - Real system validation
 * Business Rules: Population genetics, diversity tracking, breeding optimization
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import _logger from '../../utils/_logger.mjs';
import prisma from '../../db/index.mjs';
import {
  calculateAdvancedGeneticDiversity,
  trackPopulationGeneticHealth,
  calculateDetailedInbreedingCoefficient,
  generateOptimalBreedingRecommendations,
  analyzeGeneticTrends,
  calculateEffectivePopulationSize,
  identifyGeneticFounders,
  assessBreedingPairCompatibility,
  trackGeneticDiversityOverTime,
  generateGeneticDiversityReport,
} from '../../services/geneticDiversityTrackingService.mjs';

describe('🧬 Genetic Diversity Tracking System', () => {
  let testPopulation, testBreedingPairs, testFounders;

  beforeEach(async () => {
    // Create a test population with diverse genetics
    testFounders = await Promise.all([
      prisma.horse.create({
        data: {
          name: 'Founder Alpha',
          sex: 'Stallion',
          dateOfBirth: new Date('2015-01-01'),
          speed: 90, stamina: 85, agility: 80, intelligence: 75,
          epigeneticModifiers: { positive: ['athletic', 'fast'], negative: [], hidden: ['legendary_speed'] },
        },
      }),
      prisma.horse.create({
        data: {
          name: 'Founder Beta',
          sex: 'Mare',
          dateOfBirth: new Date('2015-02-01'),
          speed: 75, stamina: 95, agility: 85, intelligence: 90,
          epigeneticModifiers: { positive: ['calm', 'intelligent'], negative: [], hidden: ['perfect_balance'] },
        },
      }),
      prisma.horse.create({
        data: {
          name: 'Founder Gamma',
          sex: 'Stallion',
          dateOfBirth: new Date('2015-03-01'),
          speed: 85, stamina: 80, agility: 95, intelligence: 85,
          epigeneticModifiers: { positive: ['agile', 'bold'], negative: [], hidden: ['natural_jumper'] },
        },
      }),
      prisma.horse.create({
        data: {
          name: 'Founder Delta',
          sex: 'Mare',
          dateOfBirth: new Date('2015-04-01'),
          speed: 80, stamina: 90, agility: 75, intelligence: 95,
          epigeneticModifiers: { positive: ['wise', 'steady'], negative: [], hidden: ['dressage_master'] },
        },
      }),
    ]);

    // Create second generation with some inbreeding
    const secondGen = await Promise.all([
      prisma.horse.create({
        data: {
          name: 'Second Gen A',
          sex: 'Stallion',
          dateOfBirth: new Date('2018-01-01'),
          sireId: testFounders[0].id,
          damId: testFounders[1].id,
          speed: 82, stamina: 90, agility: 82, intelligence: 82,
          epigeneticModifiers: { positive: ['athletic', 'calm'], negative: [], hidden: [] },
        },
      }),
      prisma.horse.create({
        data: {
          name: 'Second Gen B',
          sex: 'Mare',
          dateOfBirth: new Date('2018-02-01'),
          sireId: testFounders[2].id,
          damId: testFounders[3].id,
          speed: 82, stamina: 85, agility: 85, intelligence: 90,
          epigeneticModifiers: { positive: ['agile', 'wise'], negative: [], hidden: [] },
        },
      }),
    ]);

    // Create third generation with potential inbreeding
    const thirdGen = await prisma.horse.create({
      data: {
        name: 'Third Gen Inbred',
        sex: 'Mare',
        dateOfBirth: new Date('2021-01-01'),
        sireId: secondGen[0].id,
        damId: testFounders[1].id, // Same dam as sire's dam - inbreeding
        speed: 80, stamina: 88, agility: 80, intelligence: 85,
        epigeneticModifiers: { positive: ['athletic'], negative: ['nervous'], hidden: [] },
      },
    });

    testPopulation = [...testFounders, ...secondGen, thirdGen];

    testBreedingPairs = [
      { stallionId: testFounders[0].id, mareId: testFounders[1].id },
      { stallionId: testFounders[2].id, mareId: testFounders[3].id },
      { stallionId: secondGen[0].id, mareId: secondGen[1].id },
    ];
  });

  afterEach(async () => {
    // Cleanup test data
    for (const horse of testPopulation) {
      await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
    }
  });

  describe('🔬 Advanced Genetic Diversity Algorithms', () => {
    test('should calculate comprehensive genetic diversity metrics', async () => {
      const diversity = await calculateAdvancedGeneticDiversity(testPopulation.map(h => h.id));

      // Verify comprehensive diversity structure
      expect(diversity).toHaveProperty('shannonIndex');
      expect(diversity).toHaveProperty('simpsonIndex');
      expect(diversity).toHaveProperty('expectedHeterozygosity');
      expect(diversity).toHaveProperty('alleleFrequencies');
      expect(diversity).toHaveProperty('geneticDistance');
      expect(diversity).toHaveProperty('diversityScore');

      // Verify diversity scores are within valid ranges
      expect(diversity.shannonIndex).toBeGreaterThanOrEqual(0);
      expect(diversity.simpsonIndex).toBeGreaterThanOrEqual(0);
      expect(diversity.simpsonIndex).toBeLessThanOrEqual(1);
      expect(diversity.expectedHeterozygosity).toBeGreaterThanOrEqual(0);
      expect(diversity.expectedHeterozygosity).toBeLessThanOrEqual(1);
      expect(diversity.diversityScore).toBeGreaterThanOrEqual(0);
      expect(diversity.diversityScore).toBeLessThanOrEqual(100);

      // Verify allele frequencies structure
      expect(diversity.alleleFrequencies).toHaveProperty('traits');
      expect(diversity.alleleFrequencies).toHaveProperty('stats');
    });

    test('should calculate effective population size', async () => {
      const effectiveSize = await calculateEffectivePopulationSize(testPopulation.map(h => h.id));

      expect(typeof effectiveSize).toBe('object');
      expect(effectiveSize).toHaveProperty('effectiveSize');
      expect(effectiveSize).toHaveProperty('actualSize');
      expect(effectiveSize).toHaveProperty('ratio');
      expect(effectiveSize).toHaveProperty('breedingContributors');

      expect(effectiveSize.effectiveSize).toBeGreaterThan(0);
      expect(effectiveSize.actualSize).toBe(testPopulation.length);
      expect(effectiveSize.ratio).toBeGreaterThan(0);
      expect(effectiveSize.ratio).toBeLessThanOrEqual(1);
    });

    test('should identify genetic founders and their contributions', async () => {
      const founders = await identifyGeneticFounders(testPopulation.map(h => h.id));

      expect(Array.isArray(founders)).toBe(true);
      expect(founders.length).toBeGreaterThan(0);

      if (founders.length > 0) {
        const [founder] = founders;
        expect(founder).toHaveProperty('id');
        expect(founder).toHaveProperty('name');
        expect(founder).toHaveProperty('contribution');
        expect(founder).toHaveProperty('descendants');
        expect(founder).toHaveProperty('geneticInfluence');

        expect(founder.contribution).toBeGreaterThan(0);
        expect(founder.contribution).toBeLessThanOrEqual(100);
        expect(Array.isArray(founder.descendants)).toBe(true);
      }
    });
  });

  describe('🔍 Enhanced Inbreeding Analysis', () => {
    test('should calculate detailed inbreeding coefficients', async () => {
      const inbreeding = await calculateDetailedInbreedingCoefficient(
        testBreedingPairs[0].stallionId,
        testBreedingPairs[0].mareId,
      );

      expect(inbreeding).toHaveProperty('coefficient');
      expect(inbreeding).toHaveProperty('commonAncestors');
      expect(inbreeding).toHaveProperty('pathAnalysis');
      expect(inbreeding).toHaveProperty('riskAssessment');
      expect(inbreeding).toHaveProperty('recommendations');

      expect(inbreeding.coefficient).toBeGreaterThanOrEqual(0);
      expect(inbreeding.coefficient).toBeLessThanOrEqual(1);
      expect(Array.isArray(inbreeding.commonAncestors)).toBe(true);
      expect(Array.isArray(inbreeding.pathAnalysis)).toBe(true);

      // Verify risk assessment structure
      expect(inbreeding.riskAssessment).toHaveProperty('level');
      expect(inbreeding.riskAssessment).toHaveProperty('factors');
      expect(['low', 'medium', 'high', 'critical']).toContain(inbreeding.riskAssessment.level);
    });

    test('should detect inbreeding in population', async () => {
      // Test with the inbred horse we created - this is a case where the mare is also the grandmother
      const _thirdGenHorse = testPopulation.find(h => h.name === 'Third Gen Inbred');
      const secondGenSire = testPopulation.find(h => h.name === 'Second Gen A');

      // The inbreeding is: Second Gen A (sire) x Founder Beta (mare)
      // But Second Gen A's dam is also Founder Beta, making Founder Beta both dam and grandmother
      const inbreeding = await calculateDetailedInbreedingCoefficient(
        secondGenSire.id,
        testFounders[1].id, // Founder Beta - same mare that is the sire's dam
      );

      // This should detect inbreeding since Founder Beta appears in both lineages
      expect(inbreeding.coefficient).toBeGreaterThan(0);
      expect(inbreeding.riskAssessment.level).not.toBe('low');
      expect(inbreeding.commonAncestors.length).toBeGreaterThan(0);
    });
  });

  describe('📊 Population Genetic Health Tracking', () => {
    test('should track population genetic health metrics', async () => {
      const health = await trackPopulationGeneticHealth(testPopulation.map(h => h.id));

      expect(health).toHaveProperty('overallHealth');
      expect(health).toHaveProperty('diversityTrends');
      expect(health).toHaveProperty('inbreedingLevels');
      expect(health).toHaveProperty('geneticBottlenecks');
      expect(health).toHaveProperty('recommendations');

      // Verify health score
      expect(health.overallHealth).toHaveProperty('score');
      expect(health.overallHealth).toHaveProperty('grade');
      expect(health.overallHealth.score).toBeGreaterThanOrEqual(0);
      expect(health.overallHealth.score).toBeLessThanOrEqual(100);
      expect(['A', 'B', 'C', 'D', 'F']).toContain(health.overallHealth.grade);

      // Verify diversity trends
      expect(health.diversityTrends).toHaveProperty('current');
      expect(health.diversityTrends).toHaveProperty('trend');
      expect(['increasing', 'stable', 'decreasing']).toContain(health.diversityTrends.trend);

      // Verify recommendations are actionable
      expect(Array.isArray(health.recommendations)).toBe(true);
    });

    test('should analyze genetic trends over time', async () => {
      const trends = await analyzeGeneticTrends(testPopulation.map(h => h.id));

      expect(trends).toHaveProperty('generationalAnalysis');
      expect(trends).toHaveProperty('diversityProgression');
      expect(trends).toHaveProperty('inbreedingProgression');
      expect(trends).toHaveProperty('traitEvolution');
      expect(trends).toHaveProperty('predictions');

      // Verify generational analysis
      expect(Array.isArray(trends.generationalAnalysis)).toBe(true);
      if (trends.generationalAnalysis.length > 0) {
        // eslint-disable-next-line prefer-destructuring
        const generation = trends.generationalAnalysis[0];
        expect(generation).toHaveProperty('generation');
        expect(generation).toHaveProperty('diversity');
        expect(generation).toHaveProperty('inbreeding');
        expect(generation).toHaveProperty('populationSize');
      }

      // Verify predictions
      expect(trends.predictions).toHaveProperty('nextGeneration');
      expect(trends.predictions).toHaveProperty('longTerm');
    });
  });

  describe('🎯 Optimal Breeding Recommendations', () => {
    test('should generate optimal breeding recommendations', async () => {
      const recommendations = await generateOptimalBreedingRecommendations(
        testPopulation.map(h => h.id),
      );

      expect(recommendations).toHaveProperty('optimalPairs');
      expect(recommendations).toHaveProperty('avoidPairs');
      expect(recommendations).toHaveProperty('priorityBreedings');
      expect(recommendations).toHaveProperty('diversityGoals');
      expect(recommendations).toHaveProperty('timeline');

      // Verify optimal pairs structure
      expect(Array.isArray(recommendations.optimalPairs)).toBe(true);
      if (recommendations.optimalPairs.length > 0) {
        // eslint-disable-next-line prefer-destructuring
        const pair = recommendations.optimalPairs[0];
        expect(pair).toHaveProperty('stallionId');
        expect(pair).toHaveProperty('mareId');
        expect(pair).toHaveProperty('compatibilityScore');
        expect(pair).toHaveProperty('expectedOutcome');
        expect(pair).toHaveProperty('reasoning');

        expect(pair.compatibilityScore).toBeGreaterThanOrEqual(0);
        expect(pair.compatibilityScore).toBeLessThanOrEqual(100);
      }

      // Verify avoid pairs structure
      expect(Array.isArray(recommendations.avoidPairs)).toBe(true);
      if (recommendations.avoidPairs.length > 0) {
        // eslint-disable-next-line prefer-destructuring
        const avoidPair = recommendations.avoidPairs[0];
        expect(avoidPair).toHaveProperty('stallionId');
        expect(avoidPair).toHaveProperty('mareId');
        expect(avoidPair).toHaveProperty('riskFactors');
        expect(avoidPair).toHaveProperty('reasoning');
      }
    });

    test('should assess breeding pair compatibility', async () => {
      const compatibility = await assessBreedingPairCompatibility(
        testBreedingPairs[0].stallionId,
        testBreedingPairs[0].mareId,
      );

      expect(compatibility).toHaveProperty('overallScore');
      expect(compatibility).toHaveProperty('geneticCompatibility');
      expect(compatibility).toHaveProperty('diversityImpact');
      expect(compatibility).toHaveProperty('inbreedingRisk');
      expect(compatibility).toHaveProperty('expectedTraits');
      expect(compatibility).toHaveProperty('recommendation');

      expect(compatibility.overallScore).toBeGreaterThanOrEqual(0);
      expect(compatibility.overallScore).toBeLessThanOrEqual(100);
      expect(['excellent', 'good', 'fair', 'poor', 'avoid']).toContain(compatibility.recommendation);
    });
  });

  describe('📈 Genetic Diversity Tracking Over Time', () => {
    test('should track genetic diversity changes over time', async () => {
      const tracking = await trackGeneticDiversityOverTime(testPopulation.map(h => h.id));

      expect(tracking).toHaveProperty('timeline');
      expect(tracking).toHaveProperty('diversityMetrics');
      expect(tracking).toHaveProperty('milestones');
      expect(tracking).toHaveProperty('alerts');

      // Verify timeline structure
      expect(Array.isArray(tracking.timeline)).toBe(true);
      if (tracking.timeline.length > 0) {
        // eslint-disable-next-line prefer-destructuring
        const timepoint = tracking.timeline[0];
        expect(timepoint).toHaveProperty('date');
        expect(timepoint).toHaveProperty('diversity');
        expect(timepoint).toHaveProperty('populationSize');
        expect(timepoint).toHaveProperty('events');
      }

      // Verify alerts for genetic health issues
      expect(Array.isArray(tracking.alerts)).toBe(true);
    });

    test('should generate comprehensive genetic diversity report', async () => {
      const report = await generateGeneticDiversityReport(testPopulation.map(h => h.id));

      expect(report).toHaveProperty('executiveSummary');
      expect(report).toHaveProperty('currentStatus');
      expect(report).toHaveProperty('historicalAnalysis');
      expect(report).toHaveProperty('recommendations');
      expect(report).toHaveProperty('actionPlan');
      expect(report).toHaveProperty('metrics');

      // Verify executive summary
      expect(report.executiveSummary).toHaveProperty('overallHealth');
      expect(report.executiveSummary).toHaveProperty('keyFindings');
      expect(report.executiveSummary).toHaveProperty('urgentActions');

      // Verify action plan
      expect(report.actionPlan).toHaveProperty('immediate');
      expect(report.actionPlan).toHaveProperty('shortTerm');
      expect(report.actionPlan).toHaveProperty('longTerm');
      expect(Array.isArray(report.actionPlan.immediate)).toBe(true);
    });
  });
});
