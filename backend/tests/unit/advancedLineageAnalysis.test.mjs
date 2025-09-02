/**
 * Advanced Lineage Analysis System Tests
 * 
 * Tests for sophisticated lineage analysis with tree structures, genetic diversity metrics,
 * and performance analysis capabilities for breeding decision support.
 * 
 * Testing Approach: TDD with NO MOCKING - Real system validation
 * Business Rules: Tree visualization, genetic diversity, performance tracking
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import logger from '../../utils/logger.mjs';
import prisma from '../../db/index.mjs';
import {
  generateLineageTree,
  calculateGeneticDiversityMetrics,
  analyzeLineagePerformance,
  createVisualizationData,
  calculateInbreedingCoefficient,
  identifyGeneticBottlenecks,
  generateBreedingRecommendations
} from '../../services/advancedLineageAnalysisService.mjs';

describe('🌳 Advanced Lineage Analysis System', () => {
  let testStallion, testMare, testLineageData;

  beforeEach(() => {
    // Test stallion with strong racing lineage
    testStallion = {
      id: 1,
      name: 'Thunder Strike',
      sireId: 3,
      damId: 4,
      stats: { speed: 95, stamina: 88, agility: 82, intelligence: 78 },
      traits: { positive: ['athletic', 'fast'], negative: [], hidden: ['legendary_speed'] },
      disciplineScores: { racing: 92, jumping: 65 },
      competitionResults: [
        { discipline: 'racing', placement: 1, score: 95 },
        { discipline: 'racing', placement: 2, score: 88 }
      ]
    };

    // Test mare with balanced genetics
    testMare = {
      id: 2,
      name: 'Graceful Dawn',
      sireId: 5,
      damId: 6,
      stats: { speed: 78, stamina: 92, agility: 85, intelligence: 90 },
      traits: { positive: ['calm', 'intelligent'], negative: [], hidden: ['perfect_balance'] },
      disciplineScores: { dressage: 88, jumping: 82 },
      competitionResults: [
        { discipline: 'dressage', placement: 1, score: 90 },
        { discipline: 'jumping', placement: 3, score: 78 }
      ]
    };

    // Test lineage data with multiple generations
    testLineageData = [
      {
        generation: 0,
        horses: [testStallion, testMare]
      },
      {
        generation: 1,
        horses: [
          { id: 3, name: 'Storm King', sireId: 7, damId: 8, stats: { speed: 90, stamina: 85 }, traits: { positive: ['athletic'], negative: [], hidden: [] } },
          { id: 4, name: 'Swift Mare', sireId: 9, damId: 10, stats: { speed: 88, stamina: 80 }, traits: { positive: ['fast'], negative: [], hidden: [] } },
          { id: 5, name: 'Noble Sire', sireId: 11, damId: 12, stats: { intelligence: 88, agility: 82 }, traits: { positive: ['intelligent'], negative: [], hidden: [] } },
          { id: 6, name: 'Gentle Dam', sireId: 13, damId: 14, stats: { stamina: 90, intelligence: 85 }, traits: { positive: ['calm'], negative: [], hidden: [] } }
        ]
      },
      {
        generation: 2,
        horses: [
          { id: 7, name: 'Ancient King', stats: { speed: 85, stamina: 88 }, traits: { positive: ['legendary'], negative: [], hidden: [] } },
          { id: 8, name: 'Royal Mare', stats: { speed: 82, agility: 90 }, traits: { positive: ['noble'], negative: [], hidden: [] } },
          { id: 9, name: 'Speed Demon', stats: { speed: 92, stamina: 75 }, traits: { positive: ['fast', 'athletic'], negative: ['nervous'], hidden: [] } },
          { id: 10, name: 'Fleet Foot', stats: { speed: 85, agility: 88 }, traits: { positive: ['agile'], negative: [], hidden: [] } }
        ]
      }
    ];
  });

  describe('🌲 Lineage Tree Generation', () => {
    test('should generate hierarchical tree structure from lineage data', async () => {
      // Create test horses in database first
      const stallion = await prisma.horse.create({
        data: {
          name: testStallion.name,
          sex: 'Stallion',
          dateOfBirth: new Date('2020-01-01'),
          speed: testStallion.stats.speed,
          stamina: testStallion.stats.stamina,
          agility: testStallion.stats.agility,
          intelligence: testStallion.stats.intelligence,
          epigeneticModifiers: testStallion.traits
        }
      });

      const mare = await prisma.horse.create({
        data: {
          name: testMare.name,
          sex: 'Mare',
          dateOfBirth: new Date('2020-01-01'),
          speed: testMare.stats.speed,
          stamina: testMare.stats.stamina,
          agility: testMare.stats.agility,
          intelligence: testMare.stats.intelligence,
          epigeneticModifiers: testMare.traits
        }
      });

      const tree = await generateLineageTree(stallion.id, mare.id, 3);

      // Verify tree structure
      expect(tree).toHaveProperty('root');
      expect(tree).toHaveProperty('generations');
      expect(tree).toHaveProperty('totalHorses');
      expect(tree).toHaveProperty('maxDepth');

      // Verify root contains both parents
      expect(tree.root).toHaveProperty('stallion');
      expect(tree.root).toHaveProperty('mare');
      expect(tree.root.stallion.id).toBe(stallion.id);
      expect(tree.root.mare.id).toBe(mare.id);

      // Verify generation structure
      expect(Array.isArray(tree.generations)).toBe(true);
      expect(tree.maxDepth).toBe(3);

      // Cleanup
      await prisma.horse.delete({ where: { id: stallion.id } });
      await prisma.horse.delete({ where: { id: mare.id } });
    });

    test('should include parent-child relationships in tree nodes', async () => {
      // Create test horses with parent relationships
      const sire = await prisma.horse.create({
        data: {
          name: 'Test Sire',
          sex: 'Stallion',
          dateOfBirth: new Date('2018-01-01'),
          speed: 85,
          stamina: 80,
          agility: 75,
          intelligence: 70
        }
      });

      const stallion = await prisma.horse.create({
        data: {
          name: testStallion.name,
          sex: 'Stallion',
          dateOfBirth: new Date('2020-01-01'),
          speed: testStallion.stats.speed,
          stamina: testStallion.stats.stamina,
          agility: testStallion.stats.agility,
          intelligence: testStallion.stats.intelligence,
          sireId: sire.id,
          epigeneticModifiers: testStallion.traits
        }
      });

      const mare = await prisma.horse.create({
        data: {
          name: testMare.name,
          sex: 'Mare',
          dateOfBirth: new Date('2020-01-01'),
          speed: testMare.stats.speed,
          stamina: testMare.stats.stamina,
          agility: testMare.stats.agility,
          intelligence: testMare.stats.intelligence,
          epigeneticModifiers: testMare.traits
        }
      });

      const tree = await generateLineageTree(stallion.id, mare.id, 2);

      // Check that each horse has proper parent references
      const stallionNode = tree.root.stallion;
      expect(stallionNode).toHaveProperty('sire');
      expect(stallionNode).toHaveProperty('dam');

      if (stallionNode.sire) {
        expect(stallionNode.sire).toHaveProperty('id');
        expect(stallionNode.sire).toHaveProperty('name');
      }

      // Cleanup
      await prisma.horse.delete({ where: { id: stallion.id } });
      await prisma.horse.delete({ where: { id: mare.id } });
      await prisma.horse.delete({ where: { id: sire.id } });
    });

    test('should handle missing lineage data gracefully', async () => {
      const tree = await generateLineageTree(999, 998, 3);

      expect(tree).toHaveProperty('root');
      expect(tree.totalHorses).toBe(0);
      expect(tree.generations).toEqual([]);
    });
  });

  describe('🧬 Genetic Diversity Metrics', () => {
    test('should calculate comprehensive genetic diversity metrics', async () => {
      const metrics = await calculateGeneticDiversityMetrics(testLineageData);

      // Verify metric structure
      expect(metrics).toHaveProperty('overallDiversity');
      expect(metrics).toHaveProperty('traitDiversity');
      expect(metrics).toHaveProperty('statVariance');
      expect(metrics).toHaveProperty('inbreedingRisk');
      expect(metrics).toHaveProperty('geneticBottlenecks');

      // Verify diversity scores are within valid range
      expect(metrics.overallDiversity).toBeGreaterThanOrEqual(0);
      expect(metrics.overallDiversity).toBeLessThanOrEqual(100);

      // Verify trait diversity analysis
      expect(metrics.traitDiversity).toHaveProperty('uniqueTraits');
      expect(metrics.traitDiversity).toHaveProperty('traitFrequency');
      expect(metrics.traitDiversity).toHaveProperty('diversityIndex');

      // Verify stat variance analysis
      expect(metrics.statVariance).toHaveProperty('speed');
      expect(metrics.statVariance).toHaveProperty('stamina');
      expect(metrics.statVariance).toHaveProperty('agility');
      expect(metrics.statVariance).toHaveProperty('intelligence');
    });

    test('should identify genetic bottlenecks in lineage', async () => {
      const bottlenecks = await identifyGeneticBottlenecks(testLineageData);

      expect(Array.isArray(bottlenecks)).toBe(true);
      
      if (bottlenecks.length > 0) {
        const bottleneck = bottlenecks[0];
        expect(bottleneck).toHaveProperty('generation');
        expect(bottleneck).toHaveProperty('severity');
        expect(bottleneck).toHaveProperty('affectedTraits');
        expect(bottleneck).toHaveProperty('recommendation');
      }
    });

    test('should calculate inbreeding coefficient accurately', async () => {
      const coefficient = await calculateInbreedingCoefficient(testStallion.id, testMare.id);

      expect(typeof coefficient).toBe('number');
      expect(coefficient).toBeGreaterThanOrEqual(0);
      expect(coefficient).toBeLessThanOrEqual(1);
    });
  });

  describe('🏆 Performance Analysis', () => {
    test('should analyze performance trends across generations', async () => {
      const analysis = await analyzeLineagePerformance(testLineageData);

      // Verify analysis structure
      expect(analysis).toHaveProperty('generationalTrends');
      expect(analysis).toHaveProperty('disciplineStrengths');
      expect(analysis).toHaveProperty('performanceMetrics');
      expect(analysis).toHaveProperty('improvementAreas');

      // Verify generational trends
      expect(Array.isArray(analysis.generationalTrends)).toBe(true);
      
      if (analysis.generationalTrends.length > 0) {
        const trend = analysis.generationalTrends[0];
        expect(trend).toHaveProperty('generation');
        expect(trend).toHaveProperty('averageStats');
        expect(trend).toHaveProperty('topPerformers');
      }

      // Verify discipline strengths
      expect(analysis.disciplineStrengths).toHaveProperty('strongest');
      expect(analysis.disciplineStrengths).toHaveProperty('weakest');
      expect(analysis.disciplineStrengths).toHaveProperty('balanced');
    });

    test('should identify top performing ancestors', async () => {
      const analysis = await analyzeLineagePerformance(testLineageData);

      expect(analysis.performanceMetrics).toHaveProperty('topPerformers');
      expect(Array.isArray(analysis.performanceMetrics.topPerformers)).toBe(true);

      if (analysis.performanceMetrics.topPerformers.length > 0) {
        const performer = analysis.performanceMetrics.topPerformers[0];
        expect(performer).toHaveProperty('id');
        expect(performer).toHaveProperty('name');
        expect(performer).toHaveProperty('performanceScore');
        expect(performer).toHaveProperty('specialties');
      }
    });
  });

  describe('📊 Visualization Data Generation', () => {
    test('should create visualization-ready data structure', async () => {
      // Create test horses in database first
      const stallion = await prisma.horse.create({
        data: {
          name: testStallion.name,
          sex: 'Stallion',
          dateOfBirth: new Date('2020-01-01'),
          speed: testStallion.stats.speed,
          stamina: testStallion.stats.stamina,
          agility: testStallion.stats.agility,
          intelligence: testStallion.stats.intelligence,
          epigeneticModifiers: testStallion.traits
        }
      });

      const mare = await prisma.horse.create({
        data: {
          name: testMare.name,
          sex: 'Mare',
          dateOfBirth: new Date('2020-01-01'),
          speed: testMare.stats.speed,
          stamina: testMare.stats.stamina,
          agility: testMare.stats.agility,
          intelligence: testMare.stats.intelligence,
          epigeneticModifiers: testMare.traits
        }
      });

      const vizData = await createVisualizationData(stallion.id, mare.id, 3);

      // Verify visualization structure
      expect(vizData).toHaveProperty('nodes');
      expect(vizData).toHaveProperty('edges');
      expect(vizData).toHaveProperty('layout');
      expect(vizData).toHaveProperty('metadata');

      // Verify nodes structure
      expect(Array.isArray(vizData.nodes)).toBe(true);
      if (vizData.nodes.length > 0) {
        const node = vizData.nodes[0];
        expect(node).toHaveProperty('id');
        expect(node).toHaveProperty('name');
        expect(node).toHaveProperty('generation');
        expect(node).toHaveProperty('position');
        expect(node).toHaveProperty('stats');
        expect(node).toHaveProperty('traits');
      }

      // Verify edges structure
      expect(Array.isArray(vizData.edges)).toBe(true);
      if (vizData.edges.length > 0) {
        const edge = vizData.edges[0];
        expect(edge).toHaveProperty('from');
        expect(edge).toHaveProperty('to');
        expect(edge).toHaveProperty('relationship');
      }

      // Verify layout information
      expect(vizData.layout).toHaveProperty('type');
      expect(vizData.layout).toHaveProperty('dimensions');

      // Cleanup
      await prisma.horse.delete({ where: { id: stallion.id } });
      await prisma.horse.delete({ where: { id: mare.id } });
    });
  });

  describe('🎯 Breeding Recommendations', () => {
    test('should generate comprehensive breeding recommendations', async () => {
      // Create test horses in database first
      const stallion = await prisma.horse.create({
        data: {
          name: testStallion.name,
          sex: 'Stallion',
          dateOfBirth: new Date('2020-01-01'),
          speed: testStallion.stats.speed,
          stamina: testStallion.stats.stamina,
          agility: testStallion.stats.agility,
          intelligence: testStallion.stats.intelligence,
          epigeneticModifiers: testStallion.traits
        }
      });

      const mare = await prisma.horse.create({
        data: {
          name: testMare.name,
          sex: 'Mare',
          dateOfBirth: new Date('2020-01-01'),
          speed: testMare.stats.speed,
          stamina: testMare.stats.stamina,
          agility: testMare.stats.agility,
          intelligence: testMare.stats.intelligence,
          epigeneticModifiers: testMare.traits
        }
      });

      const recommendations = await generateBreedingRecommendations(stallion.id, mare.id);

      // Verify recommendation structure
      expect(recommendations).toHaveProperty('compatibility');
      expect(recommendations).toHaveProperty('strengths');
      expect(recommendations).toHaveProperty('risks');
      expect(recommendations).toHaveProperty('suggestions');
      expect(recommendations).toHaveProperty('expectedOutcomes');

      // Verify compatibility assessment
      expect(recommendations.compatibility).toHaveProperty('score');
      expect(recommendations.compatibility).toHaveProperty('factors');
      expect(typeof recommendations.compatibility.score).toBe('number');

      // Verify suggestions are actionable
      expect(Array.isArray(recommendations.suggestions)).toBe(true);
      if (recommendations.suggestions.length > 0) {
        const suggestion = recommendations.suggestions[0];
        expect(suggestion).toHaveProperty('type');
        expect(suggestion).toHaveProperty('description');
        expect(suggestion).toHaveProperty('priority');
      }

      // Cleanup
      await prisma.horse.delete({ where: { id: stallion.id } });
      await prisma.horse.delete({ where: { id: mare.id } });
    });

    test('should identify breeding risks and mitigation strategies', async () => {
      // Create test horses in database first
      const stallion = await prisma.horse.create({
        data: {
          name: testStallion.name,
          sex: 'Stallion',
          dateOfBirth: new Date('2020-01-01'),
          speed: testStallion.stats.speed,
          stamina: testStallion.stats.stamina,
          agility: testStallion.stats.agility,
          intelligence: testStallion.stats.intelligence,
          epigeneticModifiers: testStallion.traits
        }
      });

      const mare = await prisma.horse.create({
        data: {
          name: testMare.name,
          sex: 'Mare',
          dateOfBirth: new Date('2020-01-01'),
          speed: testMare.stats.speed,
          stamina: testMare.stats.stamina,
          agility: testMare.stats.agility,
          intelligence: testMare.stats.intelligence,
          epigeneticModifiers: testMare.traits
        }
      });

      const recommendations = await generateBreedingRecommendations(stallion.id, mare.id);

      expect(Array.isArray(recommendations.risks)).toBe(true);

      if (recommendations.risks.length > 0) {
        const risk = recommendations.risks[0];
        expect(risk).toHaveProperty('type');
        expect(risk).toHaveProperty('severity');
        expect(risk).toHaveProperty('description');
        expect(risk).toHaveProperty('mitigation');
      }

      // Cleanup
      await prisma.horse.delete({ where: { id: stallion.id } });
      await prisma.horse.delete({ where: { id: mare.id } });
    });
  });
});
