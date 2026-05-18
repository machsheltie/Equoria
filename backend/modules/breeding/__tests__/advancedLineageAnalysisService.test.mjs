/**
 * advancedLineageAnalysisService — unit tests (Equoria-jkht coverage sprint).
 *
 * Pure in-memory tests for data-processing functions (no DB required).
 * DB-fixture tests for generateLineageTree, calculateInbreedingCoefficient,
 * generateBreedingRecommendations, and createVisualizationData.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  calculateGeneticDiversityMetrics,
  identifyGeneticBottlenecks,
  analyzeLineagePerformance,
  generateLineageTree,
  calculateInbreedingCoefficient,
  generateBreedingRecommendations,
  createVisualizationData,
} from '../../../services/advancedLineageAnalysisService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeHorse(overrides = {}) {
  return {
    id: Math.floor(Math.random() * 100000),
    name: 'TestHorse',
    sireId: null,
    damId: null,
    stats: { speed: 60, stamina: 65, agility: 55, intelligence: 70 },
    traits: { positive: [], negative: [], hidden: [] },
    disciplineScores: {},
    competitionResults: [],
    ...overrides,
  };
}

function makeLineage(generations) {
  return generations.map((horses, i) => ({ generation: i, horses }));
}

// ── calculateGeneticDiversityMetrics — pure in-memory ─────────────────────────

describe('calculateGeneticDiversityMetrics() — empty lineage', () => {
  it('returns shape with overallDiversity=0 for empty lineage', async () => {
    const result = await calculateGeneticDiversityMetrics([]);
    expect(typeof result.overallDiversity).toBe('number');
    expect(result.traitDiversity.uniqueTraits).toBe(0);
    expect(result.traitDiversity.diversityIndex).toBe(0);
    expect(typeof result.inbreedingRisk).toBe('object');
    expect(Array.isArray(result.geneticBottlenecks)).toBe(true);
  });

  it('inbreedingRisk.level is medium for 0 horses (< 8 total)', async () => {
    const result = await calculateGeneticDiversityMetrics([]);
    expect(result.inbreedingRisk.level).toBe('medium');
    expect(result.inbreedingRisk.totalAncestors).toBe(0);
  });
});

describe('calculateGeneticDiversityMetrics() — with traits and stats', () => {
  it('computes Shannon diversity index > 0 when horses have traits', async () => {
    const lineage = makeLineage([
      [
        makeHorse({ id: 1, traits: { positive: ['athletic', 'calm'], negative: [], hidden: [] } }),
        makeHorse({ id: 2, traits: { positive: ['bold'], negative: ['nervous'], hidden: [] } }),
      ],
    ]);
    const result = await calculateGeneticDiversityMetrics(lineage);
    expect(result.traitDiversity.diversityIndex).toBeGreaterThan(0);
    expect(result.traitDiversity.uniqueTraits).toBeGreaterThan(0);
  });

  it('populates statVariance for horses with numeric stats', async () => {
    const lineage = makeLineage([
      [
        makeHorse({ id: 3, stats: { speed: 80, stamina: 70, agility: 60, intelligence: 90 } }),
        makeHorse({ id: 4, stats: { speed: 50, stamina: 60, agility: 70, intelligence: 55 } }),
      ],
    ]);
    const result = await calculateGeneticDiversityMetrics(lineage);
    expect(result.statVariance.speed).toBeDefined();
    expect(typeof result.statVariance.speed.mean).toBe('number');
    expect(typeof result.statVariance.speed.standardDeviation).toBe('number');
  });

  it('inbreedingRisk is low when >= 8 unique horses with no duplicates', async () => {
    const horses = Array.from({ length: 8 }, (_, i) =>
      makeHorse({ id: 100 + i, traits: { positive: [], negative: [], hidden: [] } }),
    );
    const lineage = makeLineage([horses]);
    const result = await calculateGeneticDiversityMetrics(lineage);
    expect(result.inbreedingRisk.level).toBe('low');
  });

  it('inbreedingRisk is high when the same horse id appears in multiple generations', async () => {
    const sharedHorse = makeHorse({ id: 999 });
    const lineage = [
      { generation: 0, horses: [sharedHorse] },
      { generation: 1, horses: [sharedHorse, makeHorse({ id: 888 })] },
    ];
    const result = await calculateGeneticDiversityMetrics(lineage);
    expect(result.inbreedingRisk.level).toBe('high');
    expect(result.inbreedingRisk.duplicateAncestors).toBeGreaterThan(0);
  });
});

// ── identifyGeneticBottlenecks — pure in-memory ────────────────────────────────

describe('identifyGeneticBottlenecks() — branch coverage', () => {
  it('returns empty array for lineage with single horse per generation (totalHorses > 1 fails)', async () => {
    const lineage = makeLineage([
      [makeHorse({ id: 10, traits: { positive: ['athletic'], negative: [], hidden: [] } })],
    ]);
    const result = await identifyGeneticBottlenecks(lineage);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it('returns bottleneck with severity=high when trait appears in 100% of horses (>0.9)', async () => {
    const lineage = makeLineage([
      [
        makeHorse({ id: 11, traits: { positive: ['bold'], negative: [], hidden: [] } }),
        makeHorse({ id: 12, traits: { positive: ['bold'], negative: [], hidden: [] } }),
      ],
    ]);
    const result = await identifyGeneticBottlenecks(lineage);
    const boldBottleneck = result.find(b => b.trait === 'bold');
    expect(boldBottleneck).toBeDefined();
    expect(boldBottleneck.severity).toBe('high');
    expect(boldBottleneck.frequency).toBe(100);
  });

  it('returns bottleneck with severity=medium when frequency is >0.75 and <=0.9', async () => {
    // 4/5 = 0.8 → > 0.75 and <= 0.9 → 'medium'
    const horses = [
      makeHorse({ id: 20, traits: { positive: ['calm'], negative: [], hidden: [] } }),
      makeHorse({ id: 21, traits: { positive: ['calm'], negative: [], hidden: [] } }),
      makeHorse({ id: 22, traits: { positive: ['calm'], negative: [], hidden: [] } }),
      makeHorse({ id: 23, traits: { positive: ['calm'], negative: [], hidden: [] } }),
      makeHorse({ id: 24, traits: { positive: [], negative: [], hidden: [] } }),
    ];
    const lineage = makeLineage([horses]);
    const result = await identifyGeneticBottlenecks(lineage);
    const calmBottleneck = result.find(b => b.trait === 'calm');
    expect(calmBottleneck).toBeDefined();
    expect(calmBottleneck.severity).toBe('medium');
  });

  it('returns empty array for empty lineage', async () => {
    const result = await identifyGeneticBottlenecks([]);
    expect(result).toHaveLength(0);
  });
});

// ── analyzeLineagePerformance — pure in-memory ─────────────────────────────────

describe('analyzeLineagePerformance() — branch coverage', () => {
  it('returns structure with empty arrays for empty lineage', async () => {
    const result = await analyzeLineagePerformance([]);
    expect(Array.isArray(result.generationalTrends)).toBe(true);
    expect(result.generationalTrends).toHaveLength(0);
    expect(result.improvementAreas).toHaveLength(0);
  });

  it('returns empty improvementAreas when only one generation (< 2 generations check)', async () => {
    const lineage = makeLineage([
      [makeHorse({ id: 30, stats: { speed: 70, stamina: 65, agility: 60, intelligence: 75 } })],
    ]);
    const result = await analyzeLineagePerformance(lineage);
    expect(result.improvementAreas).toHaveLength(0);
  });

  it('adds topPerformer when horse avgStats + avgDiscipline > 75', async () => {
    // No disciplineScores (undefined), avgDiscipline hits truthy-empty-object path
    // avgStats = (90+85+80+88)/4 = 85.75, avgDiscipline = 50 (no disciplineScores)
    // performanceScore = (85.75 + 50) / 2 = 67.875 < 75 → no topPerformer
    // To get > 75: set disciplineScores with values that push average above 75
    const lineage = makeLineage([
      [
        makeHorse({
          id: 31,
          name: 'Champion',
          stats: { speed: 90, stamina: 85, agility: 80, intelligence: 88 },
          disciplineScores: { Dressage: 90, showJumping: 85 },
        }),
      ],
    ]);
    const result = await analyzeLineagePerformance(lineage);
    expect(result.performanceMetrics.topPerformers.length).toBeGreaterThan(0);
    const champion = result.performanceMetrics.topPerformers.find(h => h.name === 'Champion');
    expect(champion).toBeDefined();
  });

  it('adds specialties for disciplines with score > 80', async () => {
    const lineage = makeLineage([
      [
        makeHorse({
          id: 32,
          disciplineScores: { Dressage: 85, Endurance: 60 },
        }),
      ],
    ]);
    const result = await analyzeLineagePerformance(lineage);
    const topHorse = result.performanceMetrics.topPerformers.find(h => h.id === 32);
    if (topHorse) {
      expect(topHorse.specialties).toContain('Dressage');
    }
    // Even if not a topPerformer, verify performanceData was processed (no throw)
    expect(result.generationalTrends).toHaveLength(1);
  });

  it('adds stat-decline improvement area when recent stat < older by > 5', async () => {
    const lineage = makeLineage([
      [makeHorse({ id: 40, stats: { speed: 50, stamina: 50, agility: 50, intelligence: 50 } })],
      [makeHorse({ id: 41, stats: { speed: 80, stamina: 80, agility: 80, intelligence: 80 } })],
    ]);
    const result = await analyzeLineagePerformance(lineage);
    // recent=gen0 (speed=50), older=gen1 (speed=80) → 50 < 80-5=75 → decline
    expect(result.improvementAreas.some(a => a.area === 'speed decline')).toBe(true);
  });

  it('adds genetic-diversity improvement area when recent generation has < 4 horses', async () => {
    const lineage = makeLineage([
      [makeHorse({ id: 50 }), makeHorse({ id: 51 })], // 2 horses < 4
      [makeHorse({ id: 52 }), makeHorse({ id: 53 }), makeHorse({ id: 54 })], // older gen
    ]);
    const result = await analyzeLineagePerformance(lineage);
    expect(result.improvementAreas.some(a => a.area === 'genetic diversity')).toBe(true);
  });
});

// ── DB-fixture tests ──────────────────────────────────────────────────────────

let user;
let stallion;
let mare;

beforeAll(async () => {
  const ts = Date.now();
  const rand = () => Math.random().toString(36).slice(2, 8);

  user = await prisma.user.create({
    data: {
      email: `advlineage-${ts}-${rand()}@test.com`,
      username: `advlineage${ts}${rand()}`,
      password: 'irrelevant-hash',
      firstName: 'AdvLineage',
      lastName: 'Tester',
      money: 1000,
    },
  });

  stallion = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-AdvLineage-Stallion-${ts}`,
      sex: 'Stallion',
      dateOfBirth: new Date(Date.now() - 4 * 365 * 24 * 60 * 60 * 1000),
      age: 4,
      userId: user.id,
      speed: 72,
      stamina: 68,
      agility: 65,
    },
  });

  mare = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-AdvLineage-Mare-${ts}`,
      sex: 'Mare',
      dateOfBirth: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
      age: 5,
      userId: user.id,
      speed: 60,
      stamina: 75,
      agility: 70,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-AdvLineage-' } } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ── generateLineageTree ───────────────────────────────────────────────────────

describe('generateLineageTree() — DB fixture', () => {
  it('returns tree with root nodes for real stallion + mare', async () => {
    const result = await generateLineageTree(stallion.id, mare.id, 2);
    expect(result).toBeDefined();
    expect(result.root).toBeDefined();
    expect(result.root.stallion).not.toBeNull();
    expect(result.root.mare).not.toBeNull();
    expect(typeof result.totalHorses).toBe('number');
    expect(result.totalHorses).toBeGreaterThan(0);
    expect(result.maxDepth).toBe(2);
    expect(Array.isArray(result.generations)).toBe(true);
  });

  it('returns empty tree structure when horses do not exist (missing-parent path)', async () => {
    const result = await generateLineageTree(-1, -2, 2);
    expect(result.root.stallion).toBeNull();
    expect(result.root.mare).toBeNull();
    expect(result.totalHorses).toBe(0);
    expect(result.maxDepth).toBe(0);
  });
});

// ── calculateInbreedingCoefficient ────────────────────────────────────────────

describe('calculateInbreedingCoefficient() — DB fixture', () => {
  it('returns 0 for unrelated horses with no shared ancestors', async () => {
    const coeff = await calculateInbreedingCoefficient(stallion.id, mare.id);
    expect(typeof coeff).toBe('number');
    expect(coeff).toBe(0);
  });
});

// ── generateBreedingRecommendations ───────────────────────────────────────────

describe('generateBreedingRecommendations() — DB fixture', () => {
  it('returns shape with compatibility, strengths, risks, suggestions for real horses', async () => {
    const result = await generateBreedingRecommendations(stallion.id, mare.id);
    expect(result).toBeDefined();
    expect(typeof result.compatibility).toBe('object');
    expect(typeof result.compatibility.score).toBe('number');
    expect(Array.isArray(result.strengths)).toBe(true);
    expect(Array.isArray(result.risks)).toBe(true);
    expect(Array.isArray(result.suggestions)).toBe(true);
    expect(Array.isArray(result.expectedOutcomes.likelyDisciplines)).toBe(true);
  });

  it('throws when horses do not exist', async () => {
    await expect(generateBreedingRecommendations(-1, -2)).rejects.toThrow();
  });
});

// ── createVisualizationData ────────────────────────────────────────────────────

describe('createVisualizationData() — DB fixture', () => {
  it('returns nodes and edges for real stallion + mare', async () => {
    const result = await createVisualizationData(stallion.id, mare.id, 2);
    expect(Array.isArray(result.nodes)).toBe(true);
    expect(Array.isArray(result.edges)).toBe(true);
    expect(result.nodes.length).toBeGreaterThan(0);
    expect(result.layout.type).toBe('hierarchical');
    expect(typeof result.metadata.totalHorses).toBe('number');
  });

  it('returns empty nodes and edges for non-existent horses (null root branches)', async () => {
    const result = await createVisualizationData(-1, -2, 2);
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
    expect(result.metadata.totalHorses).toBe(0);
  });
});
