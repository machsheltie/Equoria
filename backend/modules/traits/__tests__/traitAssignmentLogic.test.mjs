/**
 * traitAssignmentLogic util unit tests (Equoria-rr7 coverage sprint).
 *
 * Tests 4 exported async functions with real DB fixtures.
 * groomId=null paths are pure (no groom DB calls needed for those branches).
 * groomId-based paths require a real groom fixture.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import {
  calculateTraitProbabilityWithBonus,
  applyGroomBonusesToTraitCandidates,
  selectTraitsWithGroomBonuses,
  getTraitAssignmentSummary,
} from '../../../utils/traitAssignmentLogic.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

let user;
let horse;
let groom;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `traitassignlogic-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `traitassignlogic${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'TraitAssign',
      lastName: 'Tester',
      money: 1000,
    },
  });

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-TraitAssignLogicHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    },
  });

  groom = await prisma.groom.create({
    data: {
      name: `TestFixture-TraitAssignLogicGroom-${Date.now()}`,
      speciality: 'foal_care',
      personality: 'gentle',
      userId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.groom.delete({ where: { id: groom.id } }).catch(() => {});
  await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ── calculateTraitProbabilityWithBonus ────────────────────────────────────────

describe('calculateTraitProbabilityWithBonus', () => {
  it('returns base probability when no groom assigned', async () => {
    const result = await calculateTraitProbabilityWithBonus(horse.id, 'Brave', 0.5, null);

    expect(result).toBeDefined();
    expect(result.horseId).toBe(horse.id);
    expect(result.traitName).toBe('Brave');
    expect(result.baseProbability).toBe(0.5);
    expect(result.finalProbability).toBe(0.5);
    expect(result.bonusApplied).toBe(false);
    expect(result.bonusAmount).toBe(0);
    expect(result.reason).toMatch(/no groom/i);
  });

  it('returns result shape when groom has no bonus for the trait', async () => {
    const result = await calculateTraitProbabilityWithBonus(horse.id, 'Brave', 0.3, groom.id);

    expect(result).toBeDefined();
    expect(result.bonusApplied).toBe(false);
    expect(result.finalProbability).toBe(0.3);
  });

  it('result has groomId set when groom is provided', async () => {
    const result = await calculateTraitProbabilityWithBonus(horse.id, 'Calm', 0.4, groom.id);
    expect(result.groomId).toBe(groom.id);
  });
});

// ── applyGroomBonusesToTraitCandidates ────────────────────────────────────────

describe('applyGroomBonusesToTraitCandidates', () => {
  it('returns original probabilities when no groom assigned', async () => {
    const candidates = [
      { name: 'Brave', baseProbability: 0.4 },
      { name: 'Calm', baseProbability: 0.3 },
    ];
    const result = await applyGroomBonusesToTraitCandidates(horse.id, candidates, null);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect(result[0].finalProbability).toBe(0.4);
    expect(result[0].bonusApplied).toBe(false);
    expect(result[1].finalProbability).toBe(0.3);
  });

  it('returns empty array for empty candidates list', async () => {
    const result = await applyGroomBonusesToTraitCandidates(horse.id, [], null);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it('returns array of same length with groom assigned', async () => {
    const candidates = [{ name: 'Curious', baseProbability: 0.5 }];
    const result = await applyGroomBonusesToTraitCandidates(horse.id, candidates, groom.id);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('finalProbability');
    expect(result[0]).toHaveProperty('bonusApplied');
  });
});

// ── selectTraitsWithGroomBonuses ──────────────────────────────────────────────

describe('selectTraitsWithGroomBonuses', () => {
  it('returns result shape with no groom', async () => {
    const candidates = [{ name: 'Brave', baseProbability: 0.5 }];
    const result = await selectTraitsWithGroomBonuses(horse.id, candidates, null, 1);

    expect(result).toBeDefined();
    expect(result.horseId).toBe(horse.id);
    expect(result.groomId).toBeNull();
    expect(Array.isArray(result.selectedTraits)).toBe(true);
    expect(Array.isArray(result.selectionDetails)).toBe(true);
    expect(result.totalCandidates).toBe(1);
    expect(result.bonusesApplied).toBe(0);
    expect(typeof result.traitsSelected).toBe('number');
  });

  it('returns zero selected for empty candidates', async () => {
    const result = await selectTraitsWithGroomBonuses(horse.id, [], null, 1);
    expect(result.selectedTraits).toHaveLength(0);
    expect(result.totalCandidates).toBe(0);
  });

  it('never selects more than maxTraits', async () => {
    const candidates = [
      { name: 'Brave', baseProbability: 1.0 },
      { name: 'Calm', baseProbability: 1.0 },
      { name: 'Curious', baseProbability: 1.0 },
    ];
    const result = await selectTraitsWithGroomBonuses(horse.id, candidates, null, 1);
    expect(result.selectedTraits.length).toBeLessThanOrEqual(1);
  });
});

// ── getTraitAssignmentSummary ─────────────────────────────────────────────────

describe('getTraitAssignmentSummary', () => {
  it('returns summary shape for horse+groom pair', async () => {
    const result = await getTraitAssignmentSummary(horse.id, groom.id);

    expect(result).toBeDefined();
    expect(result.horseId).toBe(horse.id);
    expect(result.groomId).toBe(groom.id);
    expect(typeof result.bonusTraits).toBe('object');
    expect(result.eligibility).toBeDefined();
    expect(typeof result.potentialBonuses).toBe('number');
    expect(typeof result.canApplyBonuses).toBe('boolean');
    expect(typeof result.summary).toBe('string');
  });
});

// ── catch paths — null traitCandidates triggers TypeError → rethrow ────────────

describe('applyGroomBonusesToTraitCandidates() — catch path (lines 177-180)', () => {
  it('rejects when traitCandidates is null (null.length → TypeError → catch + rethrow)', async () => {
    let thrown = false;
    try {
      await applyGroomBonusesToTraitCandidates(1, null, null);
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
  });
});

describe('selectTraitsWithGroomBonuses() — catch path (lines 260-263)', () => {
  it('rejects when traitCandidates is null (null.length → TypeError → catch + rethrow)', async () => {
    let thrown = false;
    try {
      await selectTraitsWithGroomBonuses(1, null, null, 1);
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
  });
});

// ── getTraitAssignmentSummary() — catch path (lines 299-304) ─────────────────

describe('getTraitAssignmentSummary() — catch path (lines 299-304) (Equoria-jkht)', () => {
  it('rejects for non-existent groomId (-9999) — getBonusTraits throws → catch + rethrow', async () => {
    let thrown = false;
    try {
      await getTraitAssignmentSummary(horse.id, -9999);
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
  });
});

// ── calculateTraitProbabilityWithBonus() — bonus-trait ineligibility path (lines 77-90) ──

describe('calculateTraitProbabilityWithBonus() — bonus-trait eligibility check (lines 77-90) (Equoria-jkht)', () => {
  let groomWithBonus;

  beforeAll(async () => {
    groomWithBonus = await prisma.groom.create({
      data: {
        name: `TestFixture-BonusTraitGroom-${Date.now()}`,
        speciality: 'foal_care',
        personality: 'gentle',
        userId: user.id,
        bonusTraitMap: { Brave: 0.1 },
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.groom.delete({ where: { id: groomWithBonus.id } }).catch(() => {});
  }, 30000);

  it('enters eligibility check when groom has bonus for trait; returns ineligible (bond 50 < 60) — covers lines 77-90', async () => {
    const result = await calculateTraitProbabilityWithBonus(horse.id, 'Brave', 0.3, groomWithBonus.id);
    expect(result).toBeDefined();
    expect(result.bonusApplied).toBe(false);
    expect(result.horseId).toBe(horse.id);
    expect(result.groomId).toBe(groomWithBonus.id);
    expect(result.eligibilityDetails).toBeDefined();
  });
});

// ── calculateTraitProbabilityWithBonus() — catch block (lines 111-115) ───────

describe('calculateTraitProbabilityWithBonus() — catch block (lines 111-115) (Equoria-jkht)', () => {
  it('rejects when groomId does not exist (getBonusTraits throws Groom not found)', async () => {
    await expect(calculateTraitProbabilityWithBonus(horse.id, 'Brave', 0.3, -9999)).rejects.toThrow();
  });
});

// ── default-parameter branch coverage (Equoria-jkht) ────────────────────────
// Calling with fewer args exercises the groomId=null default (lines 37, 126).

describe('calculateTraitProbabilityWithBonus() — omitted groomId default (line 37) (Equoria-jkht)', () => {
  it('uses null groomId when argument is omitted and returns base probability', async () => {
    const result = await calculateTraitProbabilityWithBonus(horse.id, 'Brave', 0.5);
    expect(result.groomId).toBeNull();
    expect(result.finalProbability).toBe(0.5);
    expect(result.bonusApplied).toBe(false);
    expect(result.reason).toMatch(/no groom/i);
  });
});

describe('applyGroomBonusesToTraitCandidates() — omitted groomId default (line 126) (Equoria-jkht)', () => {
  it('uses null groomId when argument is omitted and returns original probabilities', async () => {
    const candidates = [{ name: 'Brave', baseProbability: 0.4 }];
    const result = await applyGroomBonusesToTraitCandidates(horse.id, candidates);
    expect(result).toHaveLength(1);
    expect(result[0].finalProbability).toBe(0.4);
    expect(result[0].bonusApplied).toBe(false);
  });
});

// ── selectTraitsWithGroomBonuses — if(selected) true + break branches ─────────

describe('selectTraitsWithGroomBonuses() — selected=true path and break path (lines 232, 215-216) (Equoria-jkht)', () => {
  it('pushes to selectedTraits when finalProbability=1.0 (covers if-selected true branch)', async () => {
    const candidates = [{ name: 'Brave', baseProbability: 1.0 }];
    const result = await selectTraitsWithGroomBonuses(horse.id, candidates, null, 1);
    expect(result.selectedTraits).toHaveLength(1);
    expect(result.selectedTraits[0].name).toBe('Brave');
    expect(result.selectedTraits[0].source).toBe('randomized_with_groom_bonus');
  });

  it('breaks after maxTraits reached (covers break branch at line 215)', async () => {
    // Two candidates both at 100% probability with maxTraits=1 → second candidate hits the break
    const candidates = [
      { name: 'Brave', baseProbability: 1.0 },
      { name: 'Calm', baseProbability: 1.0 },
    ];
    const result = await selectTraitsWithGroomBonuses(horse.id, candidates, null, 1);
    expect(result.selectedTraits).toHaveLength(1);
    // Only the first trait should be selected; second was short-circuited by break
    expect(result.selectedTraits[0].name).toBe('Brave');
    // selectionDetails should only have the first candidate (loop broke before second)
    expect(result.selectionDetails).toHaveLength(1);
  });
});

// ── getTraitAssignmentSummary() — eligible=true branch (line 289-290) ─────────

describe('getTraitAssignmentSummary() — eligibility.eligible=true branch (lines 289-290) (Equoria-jkht)', () => {
  let eligibleGroom2, eligibleHorse2;

  beforeAll(async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const twentyNineDaysAgo = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    eligibleHorse2 = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-EligibleSummaryHorse-${Date.now()}`,
        sex: 'Filly',
        dateOfBirth: thirtyDaysAgo,
        age: 0,
        userId: user.id,
      },
    });

    eligibleGroom2 = await prisma.groom.create({
      data: {
        name: `TestFixture-EligibleSummaryGroom-${Date.now()}`,
        speciality: 'foal_care',
        personality: 'gentle',
        userId: user.id,
        bonusTraitMap: { SummaryTrait: 0.1 },
      },
    });

    await prisma.groomAssignment.create({
      data: {
        foalId: eligibleHorse2.id,
        groomId: eligibleGroom2.id,
        startDate: twentyNineDaysAgo,
        isActive: true,
      },
    });

    await prisma.groomInteraction.create({
      data: {
        foalId: eligibleHorse2.id,
        groomId: eligibleGroom2.id,
        interactionType: 'grooming',
        duration: 30,
        bondingChange: 10,
        timestamp: oneDayAgo,
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.groomInteraction.deleteMany({ where: { foalId: eligibleHorse2.id } }).catch(() => {});
    await prisma.groomAssignment.deleteMany({ where: { foalId: eligibleHorse2.id } }).catch(() => {});
    await prisma.groom.delete({ where: { id: eligibleGroom2.id } }).catch(() => {});
    await prisma.horse.delete({ where: { id: eligibleHorse2.id } }).catch(() => {});
  }, 30000);

  it('returns eligible summary string when groom qualifies for bonuses — covers line 290', async () => {
    const result = await getTraitAssignmentSummary(eligibleHorse2.id, eligibleGroom2.id);
    expect(result.canApplyBonuses).toBe(true);
    expect(result.summary).toMatch(/groom can apply bonuses/i);
    expect(result.potentialBonuses).toBeGreaterThanOrEqual(1);
  });
});

// ── calculateTraitProbabilityWithBonus() — bonus applied path (lines 93-110) ─
// Requires: groom with bonusTraitMap, eligible horse (bond >= 60, coverage >= 75%)
// Bond: start at 50, add bondingChange=10 → 60 >= 60 ✓
// Coverage: assignment for 29 of 30 days → 96.7% >= 75% ✓

describe('calculateTraitProbabilityWithBonus() — bonus applied (lines 93-110) (Equoria-jkht)', () => {
  let eligibleGroom, eligibleHorse;

  beforeAll(async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const twentyNineDaysAgo = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    eligibleHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-EligibleBonusHorse-${Date.now()}`,
        sex: 'Filly',
        dateOfBirth: thirtyDaysAgo,
        age: 0,
        userId: user.id,
      },
    });

    eligibleGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-EligibleBonusGroom-${Date.now()}`,
        speciality: 'foal_care',
        personality: 'gentle',
        userId: user.id,
        bonusTraitMap: { TestEligibleTrait: 0.15 },
      },
    });

    // Assignment from 29 days ago → coverageDays=29, coveragePercentage=29/30=0.967 >= 0.75
    await prisma.groomAssignment.create({
      data: {
        foalId: eligibleHorse.id,
        groomId: eligibleGroom.id,
        startDate: twentyNineDaysAgo,
        isActive: true,
      },
    });

    // Interaction with bondingChange=10 → averageBondScore = 50+10 = 60 >= 60
    await prisma.groomInteraction.create({
      data: {
        foalId: eligibleHorse.id,
        groomId: eligibleGroom.id,
        interactionType: 'grooming',
        duration: 30,
        bondingChange: 10,
        timestamp: oneDayAgo,
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.groomInteraction.deleteMany({ where: { foalId: eligibleHorse.id } }).catch(() => {});
    await prisma.groomAssignment.deleteMany({ where: { foalId: eligibleHorse.id } }).catch(() => {});
    await prisma.groom.delete({ where: { id: eligibleGroom.id } }).catch(() => {});
    await prisma.horse.delete({ where: { id: eligibleHorse.id } }).catch(() => {});
  }, 30000);

  it('applies bonus and returns bonusApplied=true — covers lines 93-110', async () => {
    const result = await calculateTraitProbabilityWithBonus(
      eligibleHorse.id,
      'TestEligibleTrait',
      0.3,
      eligibleGroom.id,
    );
    expect(result.bonusApplied).toBe(true);
    expect(result.bonusAmount).toBe(0.15);
    expect(result.finalProbability).toBeCloseTo(0.45);
    expect(result.reason).toBe('Bonus applied successfully');
    expect(result.eligibilityDetails).toBeDefined();
    expect(result.eligibilityDetails.averageBondScore).toBeGreaterThanOrEqual(60);
  });

  it('applyGroomBonusesToTraitCandidates with eligible groom — covers canApplyBonus=true branches (lines 153-158)', async () => {
    const candidates = [{ name: 'TestEligibleTrait', baseProbability: 0.3 }];
    const result = await applyGroomBonusesToTraitCandidates(eligibleHorse.id, candidates, eligibleGroom.id);
    expect(result).toHaveLength(1);
    expect(result[0].bonusApplied).toBe(true);
    expect(result[0].bonusAmount).toBe(0.15);
    expect(result[0].finalProbability).toBeCloseTo(0.45);
  });
});

// ── selectTraitsWithGroomBonuses — remaining branch coverage (Equoria-jkht) ──

describe('selectTraitsWithGroomBonuses() — default params and false-selected branch (Equoria-jkht)', () => {
  it('uses null groomId and maxTraits=1 defaults when called with only 2 args (covers lines 195-196)', async () => {
    const candidates = [{ name: 'Brave', baseProbability: 0.5 }];
    const result = await selectTraitsWithGroomBonuses(horse.id, candidates);
    expect(result.horseId).toBe(horse.id);
    expect(result.groomId).toBeNull();
    expect(result.totalCandidates).toBe(1);
    expect(typeof result.traitsSelected).toBe('number');
  });

  it('selected=false when baseProbability=0.0 — covers if-selected false branch (line 232)', async () => {
    // Math.random() returns [0, 1), so randomValue < 0.0 is always false → selected=false always
    const candidates = [{ name: 'Brave', baseProbability: 0.0 }];
    const result = await selectTraitsWithGroomBonuses(horse.id, candidates, null, 1);
    expect(result.selectedTraits).toHaveLength(0);
    expect(result.selectionDetails).toHaveLength(1);
    expect(result.selectionDetails[0].selected).toBe(false);
  });
});
