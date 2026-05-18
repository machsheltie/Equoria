/**
 * legacyScoreTraitCalculator branch-coverage tests (Equoria-rr7 coverage sprint).
 *
 * Pure functions (no DB):
 *   calculateGroomCareConsistency — empty, full, below-50 bondScore clip
 *   getTraitScoringDefinitions — structure
 *
 * DB-fixture paths (two horses):
 *   lstExceptionalHorse — 3 rare traits (rareTraitScore=9>5), 4 source types (diversity>=4),
 *     1 post-age-4 trait (traitsExcluded path), milestone data (groomCareConsistency>=4)
 *   lstWeakHorse — 2 negative traits (penalty=-4<-3), 0 rare traits, traitCount=2<3,
 *     no milestone data (groomCareConsistency=0<2)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  calculateTraitScore,
  calculateGroomCareConsistency,
  getTraitScoreSummary,
  getTraitScoringDefinitions,
} from '../../../services/legacyScoreTraitCalculator.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

// ── Pure function tests (no DB) ───────────────────────────────────────────────

describe('calculateGroomCareConsistency()', () => {
  it('returns 0 for empty milestoneData array', () => {
    expect(calculateGroomCareConsistency([])).toBe(0);
  });

  it('returns 5 (max) for perfect taskConsistency=10, taskDiversity=10, bondScore=100', () => {
    const data = [{ taskConsistency: 10, taskDiversity: 10, bondScore: 100 }];
    expect(calculateGroomCareConsistency(data)).toBe(5);
  });

  it('clips negative bondScore contribution to 0 when bondScore < 50', () => {
    // bondScore < 50 → (bondScore-50)/50 < 0 → Math.max(0, ...) clips it to 0
    const data = [{ taskConsistency: 0, taskDiversity: 0, bondScore: 0 }];
    expect(calculateGroomCareConsistency(data)).toBe(0);
  });

  it('returns moderate score for mixed milestone data', () => {
    const data = [
      { taskConsistency: 5, taskDiversity: 5, bondScore: 75 },
      { taskConsistency: 5, taskDiversity: 5, bondScore: 75 },
    ];
    const score = calculateGroomCareConsistency(data);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(5);
    expect(typeof score).toBe('number');
  });
});

// ── getTraitScoringDefinitions ────────────────────────────────────────────────

describe('getTraitScoringDefinitions()', () => {
  it('returns structure with correct max scores, rareTraits, negativeTraits', () => {
    const defs = getTraitScoringDefinitions();
    expect(defs.maxScores.traitCount).toBe(10);
    expect(defs.maxScores.diversity).toBe(5);
    expect(defs.maxScores.rareTraits).toBe(10);
    expect(defs.maxScores.groomCare).toBe(5);
    expect(defs.maxScores.total).toBe(30);
    expect(defs.ageCutoff.days).toBe(1460);
    expect(Array.isArray(defs.rareTraits)).toBe(true);
    expect(defs.rareTraits).toContain('noble');
    expect(Array.isArray(defs.negativeTraits)).toBe(true);
    expect(defs.negativeTraits).toContain('anxious');
    expect(typeof defs.negativeTraitPenalties.aggressive).toBe('number');
    expect(typeof defs.scoringRules.traitCount).toBe('string');
  });
});

// ── DB-fixture test suite ─────────────────────────────────────────────────────

describe('legacyScoreTraitCalculator — DB branch coverage (Equoria-rr7)', () => {
  let lstUser;
  let lstExceptionalHorse;
  let lstWeakHorse;

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    lstUser = await prisma.user.create({
      data: {
        email: `lst-${ts}-${rand()}@test.com`,
        username: `lst${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'LST',
        lastName: 'Tester',
        money: 1000,
      },
    });

    // Exceptional horse: 3 rare traits (rareTraitScore 9>5), 4 source types (diversity=4>=4),
    // 1 post-4y trait (exercises traitsExcluded path), milestone with groomCareConsistency=5
    lstExceptionalHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-LST-ExceptionalHorse-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: lstUser.id,
      },
    });

    // 3 rare traits from 3 different source types (< age 4 = < 1460 days)
    const exceptionalTraits = [
      { traitName: 'noble', sourceType: 'milestone', ageInDays: 30 },
      { traitName: 'legacy_talent', sourceType: 'groom', ageInDays: 200 },
      { traitName: 'exceptional', sourceType: 'environmental', ageInDays: 500 },
      // 4th trait adds 'genetic' source type → diversity = 4 unique types >= 4
      { traitName: 'curious', sourceType: 'genetic', ageInDays: 800 },
    ];
    for (const t of exceptionalTraits) {
      await prisma.traitHistoryLog.create({
        data: {
          horseId: lstExceptionalHorse.id,
          traitName: t.traitName,
          sourceType: t.sourceType,
          sourceId: null,
          influenceScore: 5,
          isEpigenetic: false,
          ageInDays: t.ageInDays,
          timestamp: new Date(ts),
        },
      });
    }
    // 1 post-age-4 trait to exercise the traitsExcluded query and map (lines 103-160)
    await prisma.traitHistoryLog.create({
      data: {
        horseId: lstExceptionalHorse.id,
        traitName: 'brave',
        sourceType: 'milestone',
        sourceId: null,
        influenceScore: 2,
        isEpigenetic: false,
        ageInDays: 1500, // >= 1460 → excluded
        timestamp: new Date(ts + 1000),
      },
    });

    // Milestone entry: taskConsistency=10, taskDiversity=10, bondScore=100
    // → combinedScore = 0.4*1 + 0.3*1 + 0.3*1 = 1.0 → groomCareConsistency = 5 >= 4
    await prisma.milestoneTraitLog.create({
      data: {
        horseId: lstExceptionalHorse.id,
        milestoneType: 'imprinting',
        score: 95,
        taskConsistency: 10,
        taskDiversity: 10,
        bondScore: 100,
        ageInDays: 15,
      },
    });

    // Weak horse: 2 negative traits only → penalty = -3+-1 = -4 < -3, traitCount=2 < 3
    // No milestone data → groomCareConsistency = 0 < 2, rareTraits = 0
    lstWeakHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-LST-WeakHorse-${ts}`,
        sex: 'Colt',
        dateOfBirth: new Date(),
        age: 0,
        userId: lstUser.id,
      },
    });

    // aggressive: -3 penalty, anxious: -1 penalty → total -4 < -3
    for (const trait of ['aggressive', 'anxious']) {
      await prisma.traitHistoryLog.create({
        data: {
          horseId: lstWeakHorse.id,
          traitName: trait,
          sourceType: 'groom',
          sourceId: null,
          influenceScore: 2,
          isEpigenetic: true,
          ageInDays: 50,
          timestamp: new Date(ts),
        },
      });
    }
  }, 60000);

  afterAll(async () => {
    await prisma.milestoneTraitLog
      .deleteMany({ where: { horseId: { in: [lstExceptionalHorse.id, lstWeakHorse.id] } } })
      .catch(() => {});
    await prisma.traitHistoryLog
      .deleteMany({ where: { horseId: { in: [lstExceptionalHorse.id, lstWeakHorse.id] } } })
      .catch(() => {});
    await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-LST-' } } }).catch(() => {});
    await prisma.user.delete({ where: { id: lstUser.id } }).catch(() => {});
  }, 30000);

  // ── calculateTraitScore ──────────────────────────────────────────────────────

  it('calculateTraitScore: exceptional horse — 4 considered traits, 1 excluded, 3 rare', async () => {
    const result = await calculateTraitScore(lstExceptionalHorse.id);
    expect(result.breakdown.traitsConsidered).toHaveLength(4); // 4 traits < 1460 days
    expect(result.breakdown.traitsExcluded).toHaveLength(1); // 1 post-age-4 trait
    expect(result.breakdown.traitsExcluded[0].ageInDays).toBe(1500);
    expect(result.breakdown.traitsExcluded[0].reason).toMatch(/age 4/i);
    expect(result.breakdown.rareTraitNames).toContain('noble');
    expect(result.breakdown.rareTraitNames).toHaveLength(3);
    // rareTraitScore = min(3*3, 10) = 9
    expect(result.breakdown.rareTraits).toBe(9);
    expect(result.breakdown.diversity).toBe(4); // 4 unique source types
    expect(result.breakdown.groomCareConsistency).toBe(5);
    expect(result.totalScore).toBeGreaterThan(0);
  });

  it('calculateTraitScore: weak horse — 2 negative traits, penalty=-4, no milestone', async () => {
    const result = await calculateTraitScore(lstWeakHorse.id);
    expect(result.breakdown.traitCount).toBe(2);
    expect(result.breakdown.negativeTraitPenalty).toBe(-4); // aggressive(-3) + anxious(-1)
    expect(result.breakdown.groomCareConsistency).toBe(0); // no milestone data
    expect(result.breakdown.rareTraits).toBe(0);
    expect(result.breakdown.traitsExcluded).toHaveLength(0);
  });

  // ── getTraitScoreSummary — strengths branches ────────────────────────────────

  it('getTraitScoreSummary: exceptional horse — pushes strengths for rare>5, diversity>=4, groomCare>=4', async () => {
    const summary = await getTraitScoreSummary(lstExceptionalHorse.id);
    expect(summary.horseId).toBe(lstExceptionalHorse.id);
    expect(summary.strengths).toContain('Exceptional rare trait collection');
    expect(summary.strengths).toContain('Excellent trait source diversity');
    expect(summary.strengths).toContain('Outstanding groom care consistency');
    expect(summary.weaknesses).not.toContain('Significant negative trait burden');
    expect(typeof summary.percentage).toBe('number');
  });

  // ── getTraitScoreSummary — weaknesses branches ───────────────────────────────

  it('getTraitScoreSummary: weak horse — pushes weaknesses for penalty<-3, traitCount<3, groomCare<2', async () => {
    const summary = await getTraitScoreSummary(lstWeakHorse.id);
    expect(summary.weaknesses).toContain('Significant negative trait burden');
    expect(summary.weaknesses).toContain('Limited trait development');
    expect(summary.weaknesses).toContain('Inconsistent early care');
  });

  // ── getTraitScoreSummary — recommendations branches ─────────────────────────

  it('getTraitScoreSummary: weak horse — generates all 3 recommendations (traitCount<10, diversity<5, rareTraits===0)', async () => {
    const summary = await getTraitScoreSummary(lstWeakHorse.id);
    expect(summary.recommendations).toContain('Focus on trait development before age 4');
    expect(summary.recommendations).toContain('Diversify trait sources (milestone, groom, environmental)');
    expect(summary.recommendations).toContain('Work toward acquiring rare traits');
  });
});
