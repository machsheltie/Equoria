/**
 * traitTimelineService branch-coverage tests (Equoria-jkht coverage sprint).
 *
 * No-fixture paths (non-existent horseId → empty timeline):
 *   generateTraitTimeline — isEmpty=true, 'no_data' bond/stress trend, 'no_development' quality
 *   getTraitTimelineSummary — hasTraits=false, all empty stats
 *
 * DB fixture — 1-trait horse:
 *   analyzeBondStressTrend — 'insufficient_data' (dataPoints.length=1)
 *   calculateDevelopmentQuality — 'poor' (score=1)
 *
 * DB fixture — 5-trait horse (all 5 formatAgeDescription branches, improving/decreasing trend):
 *   formatAgeDescription: ≤7, ≤30, ≤90, ≤365, >365
 *   analyzeBondStressTrend: 'improving' bond, 'decreasing' stress
 *   calculateDevelopmentQuality: 'exceptional' (score=9)
 *   calculateTimelineSummary: non-empty averages, rareTraits, negativeTraits, sourceTypes
 *   organizeByAgeRanges: events placed in firstWeek, firstMonth, firstThreeMonths, firstYear, secondYear
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { generateTraitTimeline, getTraitTimelineSummary } from '../../services/traitTimelineService.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

// ── No-fixture paths — non-existent horse returns empty timeline ──────────────

describe('generateTraitTimeline — empty timeline (no traits, non-existent horse)', () => {
  it('returns isEmpty=true for non-existent horseId', async () => {
    const result = await generateTraitTimeline(999999999);
    expect(result.isEmpty).toBe(true);
    expect(result.timelineEvents).toHaveLength(0);
    expect(result.excludedTraits).toHaveLength(0);
  });

  it('bondStressTrend is no_data for empty timeline', async () => {
    const result = await generateTraitTimeline(999999999);
    expect(result.bondStressTrend.bondTrend).toBe('no_data');
    expect(result.bondStressTrend.stressTrend).toBe('no_data');
    expect(result.bondStressTrend.dataPoints).toHaveLength(0);
  });

  it('summary averages default to 0/50 when timelineEvents is empty', async () => {
    const result = await generateTraitTimeline(999999999);
    expect(result.summary.totalTraits).toBe(0);
    expect(result.summary.averageInfluenceScore).toBe(0);
    expect(result.summary.averageBondScore).toBe(50);
    expect(result.summary.averageStressLevel).toBe(50);
    expect(result.summary.sourceTypeCount).toBe(0);
  });

  it('getTraitTimelineSummary: hasTraits=false, developmentQuality=no_development', async () => {
    const summary = await getTraitTimelineSummary(999999999);
    expect(summary.hasTraits).toBe(false);
    expect(summary.totalTraits).toBe(0);
    expect(summary.bondTrend).toBe('no_data');
    expect(summary.stressTrend).toBe('no_data');
    expect(summary.developmentQuality).toBe('no_development');
  });
});

// ── DB fixture tests ──────────────────────────────────────────────────────────

describe('traitTimelineService — DB fixture branch coverage (Equoria-jkht)', () => {
  let ttsUser;
  let ttsHorse1Trait; // 1 trait with bondScore → insufficient_data + poor quality
  let ttsHorse5Traits; // 5 traits at 5 ages → all formatAgeDescription branches + improving/decreasing

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    ttsUser = await prisma.user.create({
      data: {
        email: `tts-${ts}-${rand()}@test.com`,
        username: `tts${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'TTS',
        lastName: 'Tester',
        money: 1000,
      },
    });

    ttsHorse1Trait = await prisma.horse.create({
      data: {
        name: `TestFixture-TTS-Horse1-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: ttsUser.id,
      },
    });

    ttsHorse5Traits = await prisma.horse.create({
      data: {
        name: `TestFixture-TTS-Horse5-${ts}`,
        sex: 'Colt',
        dateOfBirth: new Date(),
        age: 0,
        userId: ttsUser.id,
      },
    });

    // 1-trait horse: 1 trait with bondScore+stressLevel → dataPoints.length=1 → insufficient_data
    await prisma.traitHistoryLog.create({
      data: {
        horseId: ttsHorse1Trait.id,
        traitName: 'curious',
        sourceType: 'groom',
        influenceScore: 4,
        isEpigenetic: false,
        ageInDays: 15,
        bondScore: 50,
        stressLevel: 40,
        timestamp: new Date(ts),
      },
    });

    // 5-trait horse: traits at ages 5, 14, 60, 200, 500 — covering all formatAgeDescription branches
    const fiveTraits = [
      // ageInDays=5 → formatAgeDescription("Day 5"), firstWeek range, rare noble
      { traitName: 'noble', sourceType: 'milestone', ageInDays: 5, bondScore: 40, stressLevel: 60 },
      // ageInDays=14 → formatAgeDescription("2 weeks"), firstMonth range
      { traitName: 'curious', sourceType: 'groom', ageInDays: 14, bondScore: 50, stressLevel: 50 },
      // ageInDays=60 → formatAgeDescription("2 months"), firstThreeMonths range, negative anxious
      {
        traitName: 'anxious',
        sourceType: 'environmental',
        ageInDays: 60,
        bondScore: 55,
        stressLevel: 45,
      },
      // ageInDays=200 → formatAgeDescription("6 months"), firstYear range, rare legacy_talent
      {
        traitName: 'legacy_talent',
        sourceType: 'genetic',
        ageInDays: 200,
        bondScore: 65,
        stressLevel: 35,
      },
      // ageInDays=500 → formatAgeDescription("1 years"), secondYear range
      { traitName: 'brave', sourceType: 'milestone', ageInDays: 500, bondScore: 80, stressLevel: 20 },
    ];

    for (const t of fiveTraits) {
      await prisma.traitHistoryLog.create({
        data: {
          horseId: ttsHorse5Traits.id,
          traitName: t.traitName,
          sourceType: t.sourceType,
          influenceScore: 5,
          isEpigenetic: false,
          ageInDays: t.ageInDays,
          bondScore: t.bondScore,
          stressLevel: t.stressLevel,
          timestamp: new Date(ts),
        },
      });
    }
  }, 60000);

  afterAll(async () => {
    const horseIds = [ttsHorse1Trait?.id, ttsHorse5Traits?.id].filter(Boolean);
    await prisma.traitHistoryLog.deleteMany({ where: { horseId: { in: horseIds } } }).catch(() => {});
    await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-TTS-Horse' } } }).catch(() => {});
    await prisma.user.delete({ where: { id: ttsUser.id } }).catch(() => {});
  }, 30000);

  // ── 1-trait horse — insufficient_data and poor quality ───────────────────────

  it('1-trait horse: bondStressTrend=insufficient_data (dataPoints.length=1)', async () => {
    const result = await generateTraitTimeline(ttsHorse1Trait.id);
    expect(result.isEmpty).toBe(false);
    expect(result.timelineEvents).toHaveLength(1);
    expect(result.bondStressTrend.bondTrend).toBe('insufficient_data');
    expect(result.bondStressTrend.stressTrend).toBe('insufficient_data');
    expect(result.bondStressTrend.dataPoints).toHaveLength(1);
  });

  it('1-trait horse: developmentQuality=poor (score=1, totalTraits=1)', async () => {
    const summary = await getTraitTimelineSummary(ttsHorse1Trait.id);
    expect(summary.developmentQuality).toBe('poor');
    expect(summary.hasTraits).toBe(true);
  });

  // ── 5-trait horse — all formatAgeDescription branches ────────────────────────

  it('5-trait horse: 5 events, correct ageDescriptions for all 5 age branches', async () => {
    const result = await generateTraitTimeline(ttsHorse5Traits.id);
    expect(result.timelineEvents).toHaveLength(5);

    // ageInDays=5 → ≤7 → "Day 5"
    const ev5 = result.timelineEvents.find(e => e.ageInDays === 5);
    expect(ev5.ageDescription).toBe('Day 5');

    // ageInDays=14 → ≤30 → "2 weeks"
    const ev14 = result.timelineEvents.find(e => e.ageInDays === 14);
    expect(ev14.ageDescription).toBe('2 weeks');

    // ageInDays=60 → ≤90 → "2 months"
    const ev60 = result.timelineEvents.find(e => e.ageInDays === 60);
    expect(ev60.ageDescription).toBe('2 months');

    // ageInDays=200 → ≤365 → "6 months"
    const ev200 = result.timelineEvents.find(e => e.ageInDays === 200);
    expect(ev200.ageDescription).toBe('6 months');

    // ageInDays=500 → >365 → "1 years"
    const ev500 = result.timelineEvents.find(e => e.ageInDays === 500);
    expect(ev500.ageDescription).toBe('1 years');
  });

  it('5-trait horse: bondTrend=improving, stressTrend=decreasing (first→last δ > 5)', async () => {
    const result = await generateTraitTimeline(ttsHorse5Traits.id);
    // first bond=40 → last bond=80, change=40 > 5 → 'improving'
    expect(result.bondStressTrend.bondTrend).toBe('improving');
    // first stress=60 → last stress=20, change=-40, lastStress < firstStress-5 → 'decreasing'
    expect(result.bondStressTrend.stressTrend).toBe('decreasing');
    expect(result.bondStressTrend.bondChange).toBe(40);
    expect(result.bondStressTrend.stressChange).toBe(-40);
  });

  it('5-trait horse: categorization has rare=2 (noble+legacy_talent), negative=1 (anxious)', async () => {
    const result = await generateTraitTimeline(ttsHorse5Traits.id);
    expect(result.categorization.rare).toHaveLength(2);
    expect(result.categorization.negative).toHaveLength(1);
    expect(result.categorization.positive).toHaveLength(4); // 5 - 1 negative
    expect(result.summary.rareTraits).toBe(2);
    expect(result.summary.negativeTraits).toBe(1);
  });

  it('5-trait horse: summary sourceTypeCount=4 (milestone,groom,environmental,genetic)', async () => {
    const result = await generateTraitTimeline(ttsHorse5Traits.id);
    expect(result.summary.sourceTypeCount).toBe(4);
    expect(result.summary.sourceTypes).toContain('milestone');
    expect(result.summary.sourceTypes).toContain('groom');
    expect(result.summary.sourceTypes).toContain('environmental');
    expect(result.summary.sourceTypes).toContain('genetic');
  });

  it('5-trait horse: ageRanges correctly populated (firstWeek, firstMonth, secondYear)', async () => {
    const result = await generateTraitTimeline(ttsHorse5Traits.id);
    expect(result.ageRanges.firstWeek).toHaveLength(1); // ageInDays=5
    expect(result.ageRanges.firstMonth).toHaveLength(1); // ageInDays=14
    expect(result.ageRanges.firstThreeMonths).toHaveLength(1); // ageInDays=60
    expect(result.ageRanges.firstYear).toHaveLength(1); // ageInDays=200
    expect(result.ageRanges.secondYear).toHaveLength(1); // ageInDays=500
  });

  it('5-trait horse: developmentQuality=exceptional (score=9 ≥ 8)', async () => {
    // totalTraits=5→+3, sourceTypeCount=4→+2, rareTraits=2→+2, improving→+2, decreasing→+1, negative=1→-1 = 9
    const summary = await getTraitTimelineSummary(ttsHorse5Traits.id);
    expect(summary.developmentQuality).toBe('exceptional');
    expect(summary.bondTrend).toBe('improving');
    expect(summary.stressTrend).toBe('decreasing');
  });
});
