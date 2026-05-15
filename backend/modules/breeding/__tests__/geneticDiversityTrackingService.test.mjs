/**
 * geneticDiversityTrackingService unit tests (Equoria-rr7 coverage sprint).
 *
 * DB fixture: user + Stallion + Mare (no lineage / trait history).
 * Array-based functions use [] to exercise the default/empty-population paths.
 * Pair functions use the real stallion/mare fixture.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import {
  calculateAdvancedGeneticDiversity,
  calculateEffectivePopulationSize,
  identifyGeneticFounders,
  calculateDetailedInbreedingCoefficient,
  trackPopulationGeneticHealth,
  analyzeGeneticTrends,
  generateOptimalBreedingRecommendations,
  assessBreedingPairCompatibility,
  trackGeneticDiversityOverTime,
  generateGeneticDiversityReport,
} from '../../../services/geneticDiversityTrackingService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';

let user;
let stallion;
let mare;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `gendiv-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `gendiv${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'GenDiv',
      lastName: 'Tester',
      money: 1000,
    },
  });

  stallion = await prisma.horse.create({
    data: {
      name: `TestFixture-GenDivStallion-${Date.now()}`,
      sex: 'Stallion',
      dateOfBirth: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
      age: 5,
      userId: user.id,
    },
  });

  mare = await prisma.horse.create({
    data: {
      name: `TestFixture-GenDivMare-${Date.now()}`,
      sex: 'Mare',
      dateOfBirth: new Date(Date.now() - 4 * 365 * 24 * 60 * 60 * 1000),
      age: 4,
      userId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.horse.delete({ where: { id: stallion.id } }).catch(() => {});
  await prisma.horse.delete({ where: { id: mare.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ── calculateAdvancedGeneticDiversity ─────────────────────────────────────────

describe('calculateAdvancedGeneticDiversity', () => {
  it('returns default zero metrics for empty population', async () => {
    const result = await calculateAdvancedGeneticDiversity([]);
    expect(typeof result.shannonIndex).toBe('number');
    expect(typeof result.simpsonIndex).toBe('number');
    expect(typeof result.diversityScore).toBe('number');
    expect(typeof result.alleleFrequencies).toBe('object');
  });

  it('returns metrics object for a small population', async () => {
    const result = await calculateAdvancedGeneticDiversity([stallion.id, mare.id]);
    expect(typeof result.diversityScore).toBe('number');
    expect(result.diversityScore).toBeGreaterThanOrEqual(0);
    expect(result.diversityScore).toBeLessThanOrEqual(100);
  });
});

// ── calculateEffectivePopulationSize ──────────────────────────────────────────

describe('calculateEffectivePopulationSize', () => {
  it('returns zero effectiveSize for empty population', async () => {
    const result = await calculateEffectivePopulationSize([]);
    expect(result.effectiveSize).toBe(0);
    expect(result.actualSize).toBe(0);
    expect(typeof result.breedingContributors).toBe('object');
  });

  it('returns populated shape for a mixed-sex group', async () => {
    const result = await calculateEffectivePopulationSize([stallion.id, mare.id]);
    expect(typeof result.effectiveSize).toBe('number');
    expect(result.actualSize).toBe(2);
    expect(typeof result.ratio).toBe('number');
  });
});

// ── identifyGeneticFounders ───────────────────────────────────────────────────

describe('identifyGeneticFounders', () => {
  it('returns empty array for empty population', async () => {
    const result = await identifyGeneticFounders([]);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it('returns founder shape for horses with no parents in population', async () => {
    const result = await identifyGeneticFounders([stallion.id, mare.id]);
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(typeof result[0].id).toBe('number');
      expect(typeof result[0].geneticInfluence).toBe('number');
    }
  });
});

// ── calculateDetailedInbreedingCoefficient ────────────────────────────────────

describe('calculateDetailedInbreedingCoefficient', () => {
  it('returns coefficient shape for unrelated horses', async () => {
    const result = await calculateDetailedInbreedingCoefficient(stallion.id, mare.id);
    expect(typeof result.coefficient).toBe('number');
    expect(result.coefficient).toBeGreaterThanOrEqual(0);
    expect(result.coefficient).toBeLessThanOrEqual(1);
    expect(Array.isArray(result.commonAncestors)).toBe(true);
    expect(typeof result.riskAssessment).toBe('object');
  });
});

// ── trackPopulationGeneticHealth ──────────────────────────────────────────────

describe('trackPopulationGeneticHealth', () => {
  it('returns health shape for empty population', async () => {
    const result = await trackPopulationGeneticHealth([]);
    expect(typeof result.overallHealth).toBe('object');
    expect(typeof result.diversityTrends).toBe('object');
    expect(Array.isArray(result.recommendations)).toBe(true);
  });

  it('returns health shape for small population', async () => {
    const result = await trackPopulationGeneticHealth([stallion.id, mare.id]);
    expect(typeof result.overallHealth.grade).toBe('string');
    expect(typeof result.diversityTrends.current).toBe('number');
  });
});

// ── analyzeGeneticTrends ──────────────────────────────────────────────────────

describe('analyzeGeneticTrends', () => {
  it('returns trend shape for empty population', async () => {
    const result = await analyzeGeneticTrends([]);
    expect(Array.isArray(result.generationalAnalysis)).toBe(true);
    expect(typeof result.diversityProgression).toBe('object');
    expect(typeof result.predictions).toBe('object');
  });
});

// ── generateOptimalBreedingRecommendations ────────────────────────────────────

describe('generateOptimalBreedingRecommendations', () => {
  it('returns recommendations shape for empty population', async () => {
    const result = await generateOptimalBreedingRecommendations([]);
    expect(Array.isArray(result.optimalPairs)).toBe(true);
    expect(Array.isArray(result.avoidPairs)).toBe(true);
    expect(typeof result.diversityGoals).toBe('object');
  });

  it('returns shape for a stallion+mare population', async () => {
    const result = await generateOptimalBreedingRecommendations([stallion.id, mare.id]);
    expect(Array.isArray(result.optimalPairs)).toBe(true);
    expect(typeof result.timeline).toBe('object');
  });
});

// ── assessBreedingPairCompatibility ───────────────────────────────────────────

describe('assessBreedingPairCompatibility', () => {
  it('returns compatibility shape for valid pair', async () => {
    const result = await assessBreedingPairCompatibility(stallion.id, mare.id);
    expect(typeof result.overallScore).toBe('number');
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
    expect(typeof result.geneticCompatibility).toBe('number');
    expect(typeof result.inbreedingRisk).toBe('number');
    expect(typeof result.recommendation).toBe('string');
  });
});

// ── trackGeneticDiversityOverTime ─────────────────────────────────────────────

describe('trackGeneticDiversityOverTime', () => {
  it('returns tracking shape for empty population', async () => {
    const result = await trackGeneticDiversityOverTime([]);
    expect(typeof result.diversityMetrics).toBe('object');
    expect(Array.isArray(result.milestones)).toBe(true);
    expect(Array.isArray(result.alerts)).toBe(true);
  });
});

// ── generateGeneticDiversityReport ────────────────────────────────────────────

describe('generateGeneticDiversityReport', () => {
  it('returns report shape for empty population', async () => {
    const result = await generateGeneticDiversityReport([]);
    expect(typeof result.currentStatus).toBe('object');
    expect(typeof result.currentStatus.diversityScore).toBe('number');
    expect(typeof result.currentStatus.populationSize).toBe('number');
    expect(Array.isArray(result.recommendations.optimalPairs)).toBe(true);
  });
});

// ── calculateDetailedInbreedingCoefficient — critical path (Equoria-jkht) ────
// Fixture: ancestorA (Stallion) → motherMare (Mare, sireId=A) + offspringStallion (sireId=A, damId=motherMare)
// offspringStallion lineage: A at gen1 (contribution 0.125) + motherMare at gen1 (contribution 0.25)
// → total coefficient = 0.375 > 0.25 → 'critical'

describe('calculateDetailedInbreedingCoefficient — critical inbreeding (Equoria-jkht)', () => {
  let critUser;
  let ancestorA;
  let motherMare;
  let offspringStallion;

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    critUser = await prisma.user.create({
      data: {
        email: `gdt-crit-${ts}-${rand()}@test.com`,
        username: `gdtcrit${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'GDT',
        lastName: 'Crit',
        money: 1000,
      },
    });

    ancestorA = await prisma.horse.create({
      data: {
        name: `TestFixture-GDT-Crit-AncestorA-${ts}`,
        sex: 'Stallion',
        dateOfBirth: new Date(Date.now() - 10 * 365 * 24 * 60 * 60 * 1000),
        age: 10,
        userId: critUser.id,
      },
    });

    motherMare = await prisma.horse.create({
      data: {
        name: `TestFixture-GDT-Crit-MotherMare-${ts}`,
        sex: 'Mare',
        dateOfBirth: new Date(Date.now() - 7 * 365 * 24 * 60 * 60 * 1000),
        age: 7,
        userId: critUser.id,
        sireId: ancestorA.id,
      },
    });

    offspringStallion = await prisma.horse.create({
      data: {
        name: `TestFixture-GDT-Crit-OffspringS-${ts}`,
        sex: 'Stallion',
        dateOfBirth: new Date(Date.now() - 4 * 365 * 24 * 60 * 60 * 1000),
        age: 4,
        userId: critUser.id,
        sireId: ancestorA.id,
        damId: motherMare.id,
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-GDT-Crit-' } } }).catch(() => {});
    await prisma.user.delete({ where: { id: critUser.id } }).catch(() => {});
  }, 30000);

  it('returns coefficient > 0.25 and riskAssessment.level=critical for parent×child mating', async () => {
    const result = await calculateDetailedInbreedingCoefficient(offspringStallion.id, motherMare.id);
    expect(result.coefficient).toBeGreaterThan(0.25);
    expect(result.riskAssessment.level).toBe('critical');
    expect(result.riskAssessment.description).toMatch(/Critical/);
  });

  it('recommendations[0].priority=urgent for critical inbreeding', async () => {
    const result = await calculateDetailedInbreedingCoefficient(offspringStallion.id, motherMare.id);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations[0].priority).toBe('urgent');
  });

  it('assessBreedingPairCompatibility returns avoid when inbreedingRisk > 0.25', async () => {
    const result = await assessBreedingPairCompatibility(offspringStallion.id, motherMare.id);
    expect(result.recommendation).toBe('avoid');
    expect(result.inbreedingRisk).toBeGreaterThan(0.25);
  });
});

// ── calculateDetailedInbreedingCoefficient — high path (full siblings) ────────
// Fixture: sireP + damD → fullSibSF (Stallion) + fullSibMF (Mare) — both sireId=P, damId=D
// coefficient = (0.5)^3 + (0.5)^3 = 0.25 → 0.25 > 0.125 → 'high'

describe('calculateDetailedInbreedingCoefficient — high inbreeding full siblings (Equoria-jkht)', () => {
  let highUser;
  let sireP;
  let damD;
  let fullSibSF;
  let fullSibMF;

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    highUser = await prisma.user.create({
      data: {
        email: `gdt-high-${ts}-${rand()}@test.com`,
        username: `gdthigh${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'GDT',
        lastName: 'High',
        money: 1000,
      },
    });

    sireP = await prisma.horse.create({
      data: {
        name: `TestFixture-GDT-High-SireP-${ts}`,
        sex: 'Stallion',
        dateOfBirth: new Date(Date.now() - 10 * 365 * 24 * 60 * 60 * 1000),
        age: 10,
        userId: highUser.id,
      },
    });

    damD = await prisma.horse.create({
      data: {
        name: `TestFixture-GDT-High-DamD-${ts}`,
        sex: 'Mare',
        dateOfBirth: new Date(Date.now() - 10 * 365 * 24 * 60 * 60 * 1000),
        age: 10,
        userId: highUser.id,
      },
    });

    fullSibSF = await prisma.horse.create({
      data: {
        name: `TestFixture-GDT-High-FullSibSF-${ts}`,
        sex: 'Stallion',
        dateOfBirth: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
        age: 5,
        userId: highUser.id,
        sireId: sireP.id,
        damId: damD.id,
      },
    });

    fullSibMF = await prisma.horse.create({
      data: {
        name: `TestFixture-GDT-High-FullSibMF-${ts}`,
        sex: 'Mare',
        dateOfBirth: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
        age: 5,
        userId: highUser.id,
        sireId: sireP.id,
        damId: damD.id,
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-GDT-High-' } } }).catch(() => {});
    await prisma.user.delete({ where: { id: highUser.id } }).catch(() => {});
  }, 30000);

  it('returns coefficient=0.25 and riskAssessment.level=high for full siblings', async () => {
    const result = await calculateDetailedInbreedingCoefficient(fullSibSF.id, fullSibMF.id);
    expect(result.coefficient).toBe(0.25);
    expect(result.riskAssessment.level).toBe('high');
    expect(result.riskAssessment.description).toMatch(/High/i);
  });

  it('recommendations[0].priority=high for high inbreeding', async () => {
    const result = await calculateDetailedInbreedingCoefficient(fullSibSF.id, fullSibMF.id);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations[0].priority).toBe('high');
  });
});

// ── calculateDetailedInbreedingCoefficient — medium path (half-siblings) ──────
// Fixture: parentPH (Stallion) → halfSibSH (Stallion, sireId=PH) + halfSibMH (Mare, sireId=PH)
// coefficient = (0.5)^3 = 0.125 → 0.125 > 0.0625 → 'medium'; generates 2 medium-priority recommendations

describe('calculateDetailedInbreedingCoefficient — medium inbreeding half-siblings (Equoria-jkht)', () => {
  let medUser;
  let parentPH;
  let halfSibSH;
  let halfSibMH;

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    medUser = await prisma.user.create({
      data: {
        email: `gdt-med-${ts}-${rand()}@test.com`,
        username: `gdtmed${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'GDT',
        lastName: 'Med',
        money: 1000,
      },
    });

    parentPH = await prisma.horse.create({
      data: {
        name: `TestFixture-GDT-Med-ParentPH-${ts}`,
        sex: 'Stallion',
        dateOfBirth: new Date(Date.now() - 10 * 365 * 24 * 60 * 60 * 1000),
        age: 10,
        userId: medUser.id,
      },
    });

    halfSibSH = await prisma.horse.create({
      data: {
        name: `TestFixture-GDT-Med-HalfSibSH-${ts}`,
        sex: 'Stallion',
        dateOfBirth: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
        age: 5,
        userId: medUser.id,
        sireId: parentPH.id,
      },
    });

    halfSibMH = await prisma.horse.create({
      data: {
        name: `TestFixture-GDT-Med-HalfSibMH-${ts}`,
        sex: 'Mare',
        dateOfBirth: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
        age: 5,
        userId: medUser.id,
        sireId: parentPH.id,
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-GDT-Med-' } } }).catch(() => {});
    await prisma.user.delete({ where: { id: medUser.id } }).catch(() => {});
  }, 30000);

  it('returns coefficient=0.125 and riskAssessment.level=medium for half-siblings', async () => {
    const result = await calculateDetailedInbreedingCoefficient(halfSibSH.id, halfSibMH.id);
    expect(result.coefficient).toBe(0.125);
    expect(result.riskAssessment.level).toBe('medium');
    expect(result.riskAssessment.description).toMatch(/Moderate/);
  });

  it('generates 2 medium-priority recommendations for medium inbreeding', async () => {
    const result = await calculateDetailedInbreedingCoefficient(halfSibSH.id, halfSibMH.id);
    const mediumRecs = result.recommendations.filter(r => r.priority === 'medium');
    expect(mediumRecs).toHaveLength(2);
  });
});

// ── calculateGeneticCompatibility + generateCompatibilityRecommendation branches ─
// 4 horse pairs exercising: traitScore=40 (overlapRatio>0.8), traitScore=85 (0.2≤ratio≤0.8),
// traitScore=60 + statScore+=85 (diff 10-24 → 'fair'), statScore+=40 (diff≥25 → 'poor')

describe('calculateGeneticCompatibility and generateCompatibilityRecommendation — branches (Equoria-jkht)', () => {
  let bcUser;
  let sameTraitStallion;
  let sameTraitMare;
  let diffTraitStallion;
  let diffTraitMare;
  let partialOverlapStallion;
  let partialOverlapMare;
  let bigStatStallion;
  let bigStatMare;

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    bcUser = await prisma.user.create({
      data: {
        email: `gdt-bc-${ts}-${rand()}@test.com`,
        username: `gdtbc${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'GDT',
        lastName: 'BC',
        money: 1000,
      },
    });

    // traitScore=40: both share all 3 traits → overlapRatio=1.0 > 0.8
    sameTraitStallion = await prisma.horse.create({
      data: {
        name: `TestFixture-GDT-BC-SameS-${ts}`,
        sex: 'Stallion',
        dateOfBirth: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
        age: 5,
        userId: bcUser.id,
        epigeneticModifiers: { positive: ['bold', 'calm', 'swift'], negative: [], hidden: [] },
      },
    });

    sameTraitMare = await prisma.horse.create({
      data: {
        name: `TestFixture-GDT-BC-SameM-${ts}`,
        sex: 'Mare',
        dateOfBirth: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
        age: 5,
        userId: bcUser.id,
        epigeneticModifiers: { positive: ['bold', 'calm', 'swift'], negative: [], hidden: [] },
      },
    });

    // traitScore=60 (no overlap) + statScore+=85 (diff=14, 10≤14<25) → recommendation='fair'
    diffTraitStallion = await prisma.horse.create({
      data: {
        name: `TestFixture-GDT-BC-DiffS-${ts}`,
        sex: 'Stallion',
        dateOfBirth: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
        age: 5,
        userId: bcUser.id,
        speed: 60,
        stamina: 60,
        agility: 60,
        intelligence: 60,
        epigeneticModifiers: { positive: ['aa', 'bb', 'cc', 'dd', 'ee'], negative: [], hidden: [] },
      },
    });

    diffTraitMare = await prisma.horse.create({
      data: {
        name: `TestFixture-GDT-BC-DiffM-${ts}`,
        sex: 'Mare',
        dateOfBirth: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
        age: 5,
        userId: bcUser.id,
        speed: 74,
        stamina: 74,
        agility: 74,
        intelligence: 74,
        epigeneticModifiers: { positive: ['ff', 'gg', 'hh', 'ii', 'jj'], negative: [], hidden: [] },
      },
    });

    // traitScore=85: partial overlap → overlapRatio=2/9≈0.22 (0.2≤x≤0.8) → recommendation='fair'
    partialOverlapStallion = await prisma.horse.create({
      data: {
        name: `TestFixture-GDT-BC-PartS-${ts}`,
        sex: 'Stallion',
        dateOfBirth: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
        age: 5,
        userId: bcUser.id,
        speed: 70,
        stamina: 70,
        agility: 70,
        intelligence: 70,
        epigeneticModifiers: { positive: ['aa', 'bb', 'cc', 'dd', 'ee', 'xx', 'yy'], negative: [], hidden: [] },
      },
    });

    partialOverlapMare = await prisma.horse.create({
      data: {
        name: `TestFixture-GDT-BC-PartM-${ts}`,
        sex: 'Mare',
        dateOfBirth: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
        age: 5,
        userId: bcUser.id,
        speed: 74,
        stamina: 74,
        agility: 74,
        intelligence: 74,
        epigeneticModifiers: { positive: ['ff', 'gg', 'xx', 'yy'], negative: [], hidden: [] },
      },
    });

    // statScore+=40: stat diff=30 ≥ 25 → recommendation='poor'
    bigStatStallion = await prisma.horse.create({
      data: {
        name: `TestFixture-GDT-BC-BigS-${ts}`,
        sex: 'Stallion',
        dateOfBirth: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
        age: 5,
        userId: bcUser.id,
        speed: 50,
        stamina: 50,
        agility: 50,
        intelligence: 50,
        epigeneticModifiers: { positive: ['aa', 'bb'], negative: [], hidden: [] },
      },
    });

    bigStatMare = await prisma.horse.create({
      data: {
        name: `TestFixture-GDT-BC-BigM-${ts}`,
        sex: 'Mare',
        dateOfBirth: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
        age: 5,
        userId: bcUser.id,
        speed: 80,
        stamina: 80,
        agility: 80,
        intelligence: 80,
        epigeneticModifiers: { positive: ['cc', 'dd'], negative: [], hidden: [] },
      },
    });
  }, 60000);

  afterAll(async () => {
    await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-GDT-BC-' } } }).catch(() => {});
    await prisma.user.delete({ where: { id: bcUser.id } }).catch(() => {});
  }, 30000);

  it('traitScore=40 branch: shared 3/3 traits → geneticCompatibility=55 and recommendation=avoid', async () => {
    const result = await assessBreedingPairCompatibility(sameTraitStallion.id, sameTraitMare.id);
    // overlapRatio=1.0 > 0.8 → traitScore=40; statScore=70 (diff=0); compatibility=(40+70)/2=55
    expect(result.geneticCompatibility).toBe(55);
    expect(result.recommendation).toBe('avoid');
  });

  it('traitScore=60 + statScore+=85 branch: unique traits + stat diff 10-24 → recommendation=fair', async () => {
    const result = await assessBreedingPairCompatibility(diffTraitStallion.id, diffTraitMare.id);
    // overlapRatio=0 → traitScore=60; diffs=14 → statScore=85; compatibility=(60+85)/2=72.5→73; overall→69
    expect(result.recommendation).toBe('fair');
    expect(result.geneticCompatibility).toBeGreaterThanOrEqual(70);
  });

  it('traitScore=85 branch: partial trait overlap → recommendation=fair (overlapRatio 0.2-0.8)', async () => {
    const result = await assessBreedingPairCompatibility(partialOverlapStallion.id, partialOverlapMare.id);
    // overlapRatio=2/9≈0.22 → traitScore=85; diffs=4 → statScore=70; compatibility=(85+70)/2=77.5→78; overall→65
    expect(result.recommendation).toBe('fair');
    expect(result.geneticCompatibility).toBeGreaterThan(70);
  });

  it('statScore+=40 branch: stat diff >= 25 → geneticCompatibility=50 and recommendation=poor', async () => {
    const result = await assessBreedingPairCompatibility(bigStatStallion.id, bigStatMare.id);
    // diffs=30 ≥ 25 → statScore=40; traitScore=60 (no overlap); compatibility=(60+40)/2=50; overall→42
    expect(result.geneticCompatibility).toBe(50);
    expect(result.recommendation).toBe('poor');
  });
});
