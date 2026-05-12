/**
 * traitAssignmentLogic util unit tests (Equoria-rr7 coverage sprint).
 *
 * Tests 4 exported async functions with real DB fixtures.
 * groomId=null paths are pure (no groom DB calls needed for those branches).
 * groomId-based paths require a real groom fixture.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  calculateTraitProbabilityWithBonus,
  applyGroomBonusesToTraitCandidates,
  selectTraitsWithGroomBonuses,
  getTraitAssignmentSummary,
} from '../../utils/traitAssignmentLogic.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

let user;
let horse;
let groom;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `traitassignlogic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `traitassignlogic${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'TraitAssign',
      lastName: 'Tester',
      money: 1000,
    },
  });

  horse = await prisma.horse.create({
    data: {
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
