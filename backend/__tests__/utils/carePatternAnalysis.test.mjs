/**
 * carePatternAnalysis util unit tests (Equoria-rr7 coverage sprint).
 *
 * Tests the single exported async function analyzeCarePatterns with real DB
 * fixtures. Two code paths exercised:
 *   - newborn foal (age < 3 years) → eligible:true, patterns object
 *   - mature horse (age >= 3 years) → eligible:false, reason string
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import helpers, { analyzeCarePatterns } from '../../utils/carePatternAnalysis.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

let user;
let foal;
let matureHorse;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `careanalysis-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `careanalysis${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'CareAnalysis',
      lastName: 'Tester',
      money: 1000,
    },
  });

  foal = await prisma.horse.create({
    data: {
      name: `TestFixture-CareAnalysisFoal-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    },
  });

  matureHorse = await prisma.horse.create({
    data: {
      name: `TestFixture-CareAnalysisMature-${Date.now()}`,
      sex: 'Stallion',
      dateOfBirth: new Date(Date.now() - 4 * 365.25 * 24 * 60 * 60 * 1000),
      age: 4,
      userId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.horse.delete({ where: { id: foal.id } }).catch(() => {});
  await prisma.horse.delete({ where: { id: matureHorse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ── analyzeCarePatterns ───────────────────────────────────────────────────────

describe('analyzeCarePatterns', () => {
  it('throws for non-existent horse', async () => {
    await expect(analyzeCarePatterns(999999999)).rejects.toThrow();
  });

  it('returns eligible:true for newborn foal', async () => {
    const result = await analyzeCarePatterns(foal.id);

    expect(result).toBeDefined();
    expect(result.eligible).toBe(true);
    expect(result.horseId).toBe(foal.id);
    expect(typeof result.ageInDays).toBe('number');
    expect(typeof result.ageInYears).toBe('number');
    expect(result.ageInYears).toBeLessThan(3);
    expect(typeof result.currentBondScore).toBe('number');
    expect(typeof result.currentStressLevel).toBe('number');
    expect(result.patterns).toBeDefined();
    expect(result.evaluationDate).toBeInstanceOf(Date);
  });

  it('returns patterns with expected keys for eligible foal', async () => {
    const result = await analyzeCarePatterns(foal.id);
    const { patterns } = result;

    expect(patterns.consistentCare).toBeDefined();
    expect(patterns.noveltyExposure).toBeDefined();
    expect(patterns.stressManagement).toBeDefined();
    expect(patterns.bondingPatterns).toBeDefined();
    expect(patterns.neglectPatterns).toBeDefined();
    expect(patterns.environmentalFactors).toBeDefined();
  });

  it('returns eligible:false for mature horse (>= 3 years)', async () => {
    const result = await analyzeCarePatterns(matureHorse.id);

    expect(result).toBeDefined();
    expect(result.eligible).toBe(false);
    expect(typeof result.reason).toBe('string');
    expect(result.reason).toMatch(/too old/i);
    expect(result.ageInYears).toBeGreaterThanOrEqual(3);
    expect(result.patterns).toBeDefined();
  });

  it('accepts a custom evaluation date', async () => {
    const customDate = new Date();
    const result = await analyzeCarePatterns(foal.id, customDate);
    expect(result.evaluationDate).toEqual(customDate);
  });

  it('consistentCare has totalInteractions of 0 for horse with no groom interactions', async () => {
    const result = await analyzeCarePatterns(foal.id);
    expect(result.patterns.consistentCare.totalInteractions).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Pure-helper && branch coverage (Equoria-jkht)
// Calls private helpers via the default export — no DB needed.
// Each &&-guarded threshold has its left-side-true branch covered here;
// the left-side-false branches are already covered by the zero-interaction
// foal tests above.
// ---------------------------------------------------------------------------

const {
  analyzeConsistentCare,
  analyzeNoveltyExposure,
  analyzeStressManagement,
  analyzeBondingPatterns,
  analyzeNeglectPatterns,
  analyzeEnvironmentalFactors,
} = helpers;

function mkInteraction(daysAgo = 0, overrides = {}) {
  return {
    interactionType: 'daily_care',
    quality: 'good',
    bondingChange: 2,
    stressChange: 0,
    createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
    notes: null,
    ...overrides,
  };
}

describe('analyzeConsistentCare — && branch coverage (Equoria-jkht)', () => {
  const sevenDayInteractions = [0, 1, 2, 3, 4, 5, 6].map(d => mkInteraction(d));

  it('meetsConsistentCareThreshold: true when consecutiveDays>=7 and bondScore>=40', () => {
    const r = analyzeConsistentCare(sevenDayInteractions, 50);
    expect(r.meetsConsistentCareThreshold).toBe(true);
    expect(r.consecutiveDaysWithCare).toBeGreaterThanOrEqual(7);
  });

  it('meetsConsistentCareThreshold: false when consecutiveDays>=7 but bondScore<40', () => {
    const r = analyzeConsistentCare(sevenDayInteractions, 30);
    expect(r.meetsConsistentCareThreshold).toBe(false);
  });
});

describe('analyzeNoveltyExposure — && branch coverage (Equoria-jkht)', () => {
  const noveltyInteractions = [1, 2, 3].map(d =>
    mkInteraction(d, { interactionType: 'desensitization', bondingChange: 3, quality: 'excellent' }),
  );

  it('meetsBraveThreshold: true when noveltyWithSupport>=3 and bondScore>=30', () => {
    const r = analyzeNoveltyExposure(noveltyInteractions, 35);
    expect(r.meetsBraveThreshold).toBe(true);
    expect(r.noveltyWithSupport).toBeGreaterThanOrEqual(3);
  });

  it('meetsBraveThreshold: false when noveltyWithSupport>=3 but bondScore<30', () => {
    const r = analyzeNoveltyExposure(noveltyInteractions, 20);
    expect(r.meetsBraveThreshold).toBe(false);
  });
});

describe('analyzeStressManagement — && branch coverage (Equoria-jkht)', () => {
  it('meetsFragileThreshold: true when 3+ stress events with no recovery support', () => {
    const stressOnly = [0, 2, 4].map(d => mkInteraction(d, { stressChange: 5 }));
    const r = analyzeStressManagement(stressOnly, 30);
    expect(r.meetsFragileThreshold).toBe(true);
    expect(r.stressWithSupport).toBe(0);
  });

  it('meetsFragileThreshold: false when stressWithSupport>0 (support present for each event)', () => {
    const now = Date.now();
    const interactions = [];
    for (let i = 0; i < 3; i++) {
      const base = now - (i * 48 + 10) * 60 * 60 * 1000;
      interactions.push(mkInteraction(0, { stressChange: 5, createdAt: new Date(base) }));
      interactions.push(mkInteraction(0, { stressChange: -3, createdAt: new Date(base + 2 * 60 * 60 * 1000) }));
    }
    const r = analyzeStressManagement(interactions, 30);
    expect(r.meetsFragileThreshold).toBe(false);
    expect(r.stressWithSupport).toBeGreaterThanOrEqual(3);
  });
});

describe('analyzeBondingPatterns — && branch coverage (Equoria-jkht)', () => {
  const sevenDayPositive = [0, 1, 2, 3, 4, 5, 6].map(d => mkInteraction(d, { bondingChange: 3 }));
  const tenPositive = Array.from({ length: 10 }, (_, i) => mkInteraction(i, { bondingChange: 3 }));

  it('meetsAffectionateThreshold: true when 7+ days with interaction and bondScore>=50', () => {
    const r = analyzeBondingPatterns(sevenDayPositive, 60);
    expect(r.meetsAffectionateThreshold).toBe(true);
    expect(r.daysWithInteraction).toBeGreaterThanOrEqual(7);
  });

  it('meetsAffectionateThreshold: false when 7+ days but bondScore<50', () => {
    const r = analyzeBondingPatterns(sevenDayPositive, 30);
    expect(r.meetsAffectionateThreshold).toBe(false);
  });

  it('meetsConfidentThreshold: true when positiveInteractions>=10 and bondScore>=40', () => {
    const r = analyzeBondingPatterns(tenPositive, 50);
    expect(r.meetsConfidentThreshold).toBe(true);
    expect(r.positiveInteractions).toBeGreaterThanOrEqual(10);
  });

  it('meetsConfidentThreshold: false when positiveInteractions>=10 but bondScore<40', () => {
    const r = analyzeBondingPatterns(tenPositive, 30);
    expect(r.meetsConfidentThreshold).toBe(false);
  });
});

describe('analyzeNeglectPatterns — && branch coverage (Equoria-jkht)', () => {
  const gapped = [mkInteraction(6), mkInteraction(1)]; // 4-day gap between them

  it('meetsInsecureThreshold: true when daysWithoutCare>=4 and bondScore<=25', () => {
    const r = analyzeNeglectPatterns(gapped, 20);
    expect(r.meetsInsecureThreshold).toBe(true);
    expect(r.maxConsecutiveDaysWithoutCare).toBeGreaterThanOrEqual(4);
  });

  it('meetsInsecureThreshold: false when daysWithoutCare>=4 but bondScore>25', () => {
    const r = analyzeNeglectPatterns(gapped, 40);
    expect(r.meetsInsecureThreshold).toBe(false);
  });

  it('meetsAloofThreshold: true when <3 interactions and bondScore<=30', () => {
    const sparse = [mkInteraction(0), mkInteraction(1)];
    const r = analyzeNeglectPatterns(sparse, 20);
    expect(r.meetsAloofThreshold).toBe(true);
  });

  it('meetsAloofThreshold: false when <3 interactions but bondScore>30', () => {
    const sparse = [mkInteraction(0), mkInteraction(1)];
    const r = analyzeNeglectPatterns(sparse, 40);
    expect(r.meetsAloofThreshold).toBe(false);
  });
});

describe('calculateConsecutiveDays via analyzeConsistentCare — streak-reset branch (Equoria-jkht)', () => {
  it('resets streak when gap > 2 days (covers else-branch at line 293)', () => {
    // Day 10 and day 0 — 10-day gap triggers currentStreak = 1 reset
    const withGap = [mkInteraction(10), mkInteraction(0)];
    const r = analyzeConsistentCare(withGap, 50);
    expect(r.consecutiveDaysWithCare).toBe(1);
    expect(r.meetsConsistentCareThreshold).toBe(false);
  });
});

describe('analyzeEnvironmentalFactors — filter-predicate branch coverage (Equoria-jkht)', () => {
  it('notes===null covers && left-false branch; stressChange>5 covers || right branch', () => {
    const interactions = [
      mkInteraction(0, { stressChange: 6, notes: null, interactionType: 'exercise' }), // non-routine; stressChange>5 → startle
      mkInteraction(1, { interactionType: 'feeding' }), // feeding → || right-branch of routineInteractions filter
    ];
    const r = analyzeEnvironmentalFactors(interactions);
    expect(r.startleEvents).toBe(1);
    expect(r.routineInteractions).toBe(1);
  });

  it('notes containing "startle" covers && right branch (notes truthy and includes startle)', () => {
    const interactions = [mkInteraction(0, { notes: 'horse startled at loud noise', stressChange: 0 })];
    const r = analyzeEnvironmentalFactors(interactions);
    expect(r.startleEvents).toBe(1);
  });

  it('meetsSkittishThreshold: true when 2+ startle events (stressChange>5)', () => {
    const interactions = [
      mkInteraction(0, { stressChange: 6, notes: null }),
      mkInteraction(1, { stressChange: 8, notes: null }),
    ];
    const r = analyzeEnvironmentalFactors(interactions);
    expect(r.meetsSkittishThreshold).toBe(true);
    expect(r.startleEvents).toBe(2);
  });

  it('hasRoutine: true when 5+ routine interactions (interactionType daily_care)', () => {
    const interactions = [0, 1, 2, 3, 4].map(d => mkInteraction(d));
    const r = analyzeEnvironmentalFactors(interactions);
    expect(r.hasRoutine).toBe(true);
    expect(r.routineInteractions).toBe(5);
  });
});

describe('analyzeNoveltyExposure — || and && branch coverage (line 131, Equoria-jkht)', () => {
  it('exploration and showground_exposure types count as novelty (covers || right branches)', () => {
    const exploration = mkInteraction(1, {
      interactionType: 'exploration',
      bondingChange: 2,
      quality: 'good',
    });
    const showground = mkInteraction(2, {
      interactionType: 'showground_exposure',
      bondingChange: 2,
      quality: 'good',
    });
    const r = analyzeNoveltyExposure([exploration, showground], 35);
    expect(r.noveltyEvents).toBe(2);
  });

  it('bondingChange<0 excludes from noveltyWithSupport (covers && left-false branch)', () => {
    const negBond = mkInteraction(1, {
      interactionType: 'desensitization',
      bondingChange: -2,
      quality: 'poor',
    });
    const r = analyzeNoveltyExposure([negBond], 50);
    expect(r.noveltyWithSupport).toBe(0);
  });
});

describe('groupInteractionsByDay — same-day grouping branch (line 263, Equoria-jkht)', () => {
  it('two interactions on the same day group into one bucket (covers if(!groups[day]) false-branch)', () => {
    const now = Date.now();
    const sameDay = [
      mkInteraction(0, { createdAt: new Date(now - 1 * 60 * 60 * 1000) }), // 1 h ago (today)
      mkInteraction(0, { createdAt: new Date(now - 2 * 60 * 60 * 1000) }), // 2 h ago (same today)
    ];
    const r = analyzeConsistentCare(sameDay, 50);
    expect(r.consecutiveDaysWithCare).toBe(1); // both in same day bucket → 1 unique day
    expect(r.totalInteractions).toBe(2);
  });
});

describe('calculateAverageBondChange — || falsy-bondingChange branch (line 330, Equoria-jkht)', () => {
  it('bondingChange===0 covers || right branch (0 is falsy)', () => {
    const zeroBond = [mkInteraction(0, { bondingChange: 0 })];
    const r = analyzeConsistentCare(zeroBond, 50);
    expect(r.averageBondChange).toBe(0);
  });

  it('bondingChange===null covers || right branch (null is falsy)', () => {
    const nullBond = [mkInteraction(0, { bondingChange: null })];
    const r = analyzeConsistentCare(nullBond, 50);
    expect(r.averageBondChange).toBe(0);
  });
});
