/**
 * Genetic diversity report — shared aggregates computed once; founders walk
 * from one in-memory descendant map (Equoria-cmw85.14, Equoria-cmw85.32).
 *
 * generateGeneticDiversityReport() recomputed its own inputs: the population
 * diversity score five times, population health twice, and each birth-year's
 * diversity twice (trend analysis and the over-time timeline). identifyGenetic-
 * Founders() ran one descendant BFS - a query per visited horse - for every
 * founder candidate.
 *
 * Real database and real services. horse.findMany is wrapped with a delegating
 * recorder so the read shape is observable; outputs are checked against the
 * standalone functions (which share the same code but none of the report's
 * shared state) and against a descendant oracle derived from the known pedigree.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import {
  calculateAdvancedGeneticDiversity,
  identifyGeneticFounders,
} from '../services/genetics/geneticDiversityMetrics.mjs';
import { trackPopulationGeneticHealth } from '../services/genetics/populationHealth.mjs';
import {
  analyzeGeneticTrends,
  generateGeneticDiversityReport,
} from '../services/genetics/recommendationGenerators.mjs';

const SCOPE = 'TestFixture-GenReport';
const RUN = randomBytes(6).toString('hex');
const cleanup = createCleanupTracker();
const horses = {};
const horseIds = [];
let user;

async function makeHorse(key, sex, year, sireId = null, damId = null) {
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${SCOPE}-${key}-${RUN}`,
      sex,
      dateOfBirth: new Date(`${year}-06-15`),
      age: 5,
      userId: user.id,
      sireId,
      damId,
      epigeneticModifiers: {
        positive: key.startsWith('F') ? ['bold'] : ['bold', 'calm'],
        negative: [],
        hidden: [],
      },
    },
  });
  horses[key] = horse;
  horseIds.push(horse.id);
  return horse;
}

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `genreport-${RUN}@test.com`,
      username: `genreport${RUN}`,
      password: 'irrelevant-hash',
      firstName: 'Gen',
      lastName: 'Report',
      money: 0,
    },
  });
  // F1 x F2 -> C1, C2 ; C1 x C2 -> G1, G2 (an inbred, three-birth-year herd).
  const f1 = await makeHorse('F1', 'Stallion', 2016);
  const f2 = await makeHorse('F2', 'Mare', 2016);
  const c1 = await makeHorse('C1', 'Stallion', 2018, f1.id, f2.id);
  const c2 = await makeHorse('C2', 'Mare', 2018, f1.id, f2.id);
  await makeHorse('G1', 'Stallion', 2020, c1.id, c2.id);
  await makeHorse('G2', 'Mare', 2020, c1.id, c2.id);

  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
}, 60_000);

afterAll(() => cleanup.run(), 60_000);

function recordHorseFindMany() {
  const calls = [];
  const original = prisma.horse.findMany;
  prisma.horse.findMany = (...args) => {
    calls.push(args[0]);
    return original.apply(prisma.horse, args);
  };
  return {
    calls,
    restore() {
      prisma.horse.findMany = original;
    },
  };
}

const fingerprint = call =>
  `${Object.keys(call.select ?? {})
    .sort()
    .join(',')}|${[...(call.where?.id?.in ?? [])].sort((a, b) => a - b).join(',')}`;

describe('generateGeneticDiversityReport() (Equoria-cmw85.14)', () => {
  it('computes diversity and population health once, and reports what the standalone functions report', async () => {
    const standaloneDiversity = await calculateAdvancedGeneticDiversity(horseIds);
    const standaloneHealth = await trackPopulationGeneticHealth(horseIds);
    const standaloneTrends = await analyzeGeneticTrends(horseIds);

    const rec = recordHorseFindMany();
    let report;
    try {
      report = await generateGeneticDiversityReport(horseIds);
    } finally {
      rec.restore();
    }

    // Output unchanged.
    expect(report.metrics.diversity).toEqual(standaloneDiversity);
    expect(report.metrics.populationHealth).toEqual(standaloneHealth);
    expect(report.historicalAnalysis.trends).toEqual(standaloneTrends.diversityProgression);
    expect(report.currentStatus.diversityScore).toBe(standaloneDiversity.diversityScore);
    expect(report.currentStatus.populationSize).toBe(horseIds.length);

    // Each aggregate is read exactly once per population / birth-year set.
    const diversityReads = rec.calls.filter(call => {
      const keys = Object.keys(call.select ?? {});
      return keys.includes('speed') && keys.includes('epigeneticModifiers') && keys.includes('sireId');
    });
    const bottleneckReads = rec.calls.filter(
      call =>
        Object.keys(call.select ?? {})
          .sort()
          .join(',') === 'damId,epigeneticModifiers,id,name,sireId',
    );
    const populationScan = rec.calls.filter(
      call =>
        Object.keys(call.select ?? {})
          .sort()
          .join(',') === 'damId,id,sireId' && call.where?.id?.in?.length === horseIds.length,
    );
    for (const group of [diversityReads, bottleneckReads, populationScan]) {
      expect(group.length).toBeGreaterThanOrEqual(1);
      const seen = new Set();
      for (const call of group) {
        const key = fingerprint(call);
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  }, 120_000);
});

describe('identifyGeneticFounders() (Equoria-cmw85.32)', () => {
  it('derives every founder’s descendants from one pass, with the same results', async () => {
    const rec = recordHorseFindMany();
    let founders;
    try {
      founders = await identifyGeneticFounders(horseIds);
    } finally {
      rec.restore();
    }

    // One read of the population; no per-candidate descendant queries.
    expect(rec.calls).toHaveLength(1);

    const idOf = key => horses[key].id;
    const expected = {
      F1: ['C1', 'C2', 'G1', 'G2'],
      F2: ['C1', 'C2', 'G1', 'G2'],
      C1: ['G1', 'G2'],
      C2: ['G1', 'G2'],
    };
    expect(founders.map(f => f.id).sort()).toEqual(Object.keys(expected).map(idOf).sort());
    for (const founder of founders) {
      const key = Object.keys(horses).find(k => horses[k].id === founder.id);
      expect([...founder.descendants].sort()).toEqual(expected[key].map(idOf).sort());
      expect(founder.contribution).toBe(Math.round((expected[key].length / horseIds.length) * 100));
      expect(founder.isFounder).toBe(key.startsWith('F'));
      expect(founder.offspringCount).toBe(2);
    }
    // Ordered by influence, most influential first.
    const influences = founders.map(f => f.geneticInfluence);
    expect(influences).toEqual([...influences].sort((a, b) => b - a));
  }, 60_000);
});
