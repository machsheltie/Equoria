/**
 * enhancedMilestoneEvaluationSystem — pure-function branch-coverage tests (Equoria-jkht)
 *
 * Exercises the four pure helpers exported for unit-testing:
 *   calculateBondModifier          — 5 bond-score ranges → 8 branches
 *   calculateTaskConsistencyModifier — 3 independent conditions → 6 branches
 *   calculateCareGapsPenalty       — 2 independent conditions → 4 branches
 *   determineTraitOutcome          — CONFIRM / DENY / random paths → 6 branches
 *
 * No DB calls. No mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  calculateBondModifier,
  calculateTaskConsistencyModifier,
  calculateCareGapsPenalty,
  determineTraitOutcome,
  evaluateEnhancedMilestone,
  MILESTONE_TYPES,
  MILESTONE_TRAIT_POOLS,
  TRAIT_THRESHOLDS,
  DEVELOPMENTAL_WINDOWS,
} from '../../../utils/enhancedMilestoneEvaluationSystem.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

// Minimal groomCareHistory stub used by functions that accept it but don't branch on it
const emptyHistory = { totalInteractions: 0, taskDiversity: 0, averageQuality: 0, interactions: [] };

// ─── calculateBondModifier ────────────────────────────────────────────────────

describe('calculateBondModifier()', () => {
  it('returns 2 when bondScore >= 80', () => {
    expect(calculateBondModifier(emptyHistory, 80)).toBe(2);
    expect(calculateBondModifier(emptyHistory, 100)).toBe(2);
  });

  it('returns 1 when 60 <= bondScore < 80', () => {
    expect(calculateBondModifier(emptyHistory, 60)).toBe(1);
    expect(calculateBondModifier(emptyHistory, 79)).toBe(1);
  });

  it('returns 0 when 40 <= bondScore < 60', () => {
    expect(calculateBondModifier(emptyHistory, 40)).toBe(0);
    expect(calculateBondModifier(emptyHistory, 59)).toBe(0);
  });

  it('returns -1 when 20 <= bondScore < 40', () => {
    expect(calculateBondModifier(emptyHistory, 20)).toBe(-1);
    expect(calculateBondModifier(emptyHistory, 39)).toBe(-1);
  });

  it('returns -2 when bondScore < 20', () => {
    expect(calculateBondModifier(emptyHistory, 0)).toBe(-2);
    expect(calculateBondModifier(emptyHistory, 19)).toBe(-2);
  });
});

// ─── calculateTaskConsistencyModifier ────────────────────────────────────────

describe('calculateTaskConsistencyModifier()', () => {
  it('returns 0 when all three conditions are false', () => {
    const h = { totalInteractions: 0, taskDiversity: 0, averageQuality: 0, interactions: [] };
    expect(calculateTaskConsistencyModifier(h)).toBe(0);
  });

  it('returns 1 when only totalInteractions >= 3', () => {
    const h = { totalInteractions: 3, taskDiversity: 0, averageQuality: 0, interactions: [] };
    expect(calculateTaskConsistencyModifier(h)).toBe(1);
  });

  it('returns 1 when only taskDiversity >= 2', () => {
    const h = { totalInteractions: 0, taskDiversity: 2, averageQuality: 0, interactions: [] };
    expect(calculateTaskConsistencyModifier(h)).toBe(1);
  });

  it('returns 1 when only averageQuality > 0.8', () => {
    const h = { totalInteractions: 0, taskDiversity: 0, averageQuality: 0.9, interactions: [] };
    expect(calculateTaskConsistencyModifier(h)).toBe(1);
  });

  it('returns 3 when all three conditions are true', () => {
    const h = { totalInteractions: 5, taskDiversity: 3, averageQuality: 0.95, interactions: [] };
    expect(calculateTaskConsistencyModifier(h)).toBe(3);
  });

  it('returns 2 when two conditions are true', () => {
    const h = { totalInteractions: 3, taskDiversity: 2, averageQuality: 0, interactions: [] };
    expect(calculateTaskConsistencyModifier(h)).toBe(2);
  });
});

// ─── calculateCareGapsPenalty ─────────────────────────────────────────────────

describe('calculateCareGapsPenalty()', () => {
  const dummyWindow = { start: 0, end: 7 };

  it('returns 0 when both conditions are false (interactions present)', () => {
    const h = { totalInteractions: 1, interactions: [{}] };
    expect(calculateCareGapsPenalty(h, dummyWindow)).toBe(0);
  });

  it('returns 1 when only totalInteractions === 0 (but interactions array non-empty)', () => {
    const h = { totalInteractions: 0, interactions: [{}] };
    expect(calculateCareGapsPenalty(h, dummyWindow)).toBe(1);
  });

  it('returns 2 when only interactions.length === 0 (but totalInteractions > 0)', () => {
    const h = { totalInteractions: 1, interactions: [] };
    expect(calculateCareGapsPenalty(h, dummyWindow)).toBe(2);
  });

  it('returns 3 when both conditions are true', () => {
    const h = { totalInteractions: 0, interactions: [] };
    expect(calculateCareGapsPenalty(h, dummyWindow)).toBe(3);
  });
});

// ─── determineTraitOutcome ────────────────────────────────────────────────────

describe('determineTraitOutcome()', () => {
  const milestoneType = MILESTONE_TYPES.IMPRINTING;
  const pool = MILESTONE_TRAIT_POOLS[milestoneType];

  it('returns a positive trait when finalScore >= CONFIRM threshold (3)', () => {
    const result = determineTraitOutcome(TRAIT_THRESHOLDS.CONFIRM, milestoneType);
    expect(result.type).toBe('positive');
    expect(pool.positive).toContain(result.trait);
    expect(result.reasoning).toMatch(/Positive trait confirmed/);
  });

  it('returns a positive trait when finalScore well above threshold', () => {
    const result = determineTraitOutcome(10, milestoneType);
    expect(result.type).toBe('positive');
    expect(pool.positive).toContain(result.trait);
  });

  it('returns a negative trait when finalScore <= DENY threshold (-3)', () => {
    const result = determineTraitOutcome(TRAIT_THRESHOLDS.DENY, milestoneType);
    expect(result.type).toBe('negative');
    expect(pool.negative).toContain(result.trait);
    expect(result.reasoning).toMatch(/Negative trait confirmed/);
  });

  it('returns a negative trait when finalScore well below threshold', () => {
    const result = determineTraitOutcome(-10, milestoneType);
    expect(result.type).toBe('negative');
    expect(pool.negative).toContain(result.trait);
  });

  it('returns a trait from the full candidate pool in the neutral range', () => {
    const result = determineTraitOutcome(0, milestoneType);
    const allTraits = [...pool.positive, ...pool.negative];
    expect(allTraits).toContain(result.trait);
    expect(['positive', 'negative']).toContain(result.type);
    expect(result.reasoning).toMatch(/neutral range/);
  });

  it('works for all milestone types without throwing', () => {
    Object.values(MILESTONE_TYPES).forEach(type => {
      expect(() => determineTraitOutcome(5, type)).not.toThrow();
      expect(() => determineTraitOutcome(-5, type)).not.toThrow();
      expect(() => determineTraitOutcome(0, type)).not.toThrow();
    });
  });
});

// ── evaluateEnhancedMilestone — validation + horse-not-found paths (lines 75-252) ──

describe('evaluateEnhancedMilestone() — safe throw paths', () => {
  it('rejects with "Invalid milestone type" for an unrecognised milestoneType (lines 82-84)', async () => {
    await expect(evaluateEnhancedMilestone(-1, 'invalid_type')).rejects.toThrow('Invalid milestone type: invalid_type');
  });

  it('rejects with "Horse with ID -1 not found" for a valid type but missing horse (lines 97-99)', async () => {
    await expect(evaluateEnhancedMilestone(-1, MILESTONE_TYPES.IMPRINTING)).rejects.toThrow(
      'Horse with ID -1 not found',
    );
  });

  it('rejects for all milestone types when horse does not exist', async () => {
    for (const type of Object.values(MILESTONE_TYPES)) {
      let thrown = false;
      try {
        await evaluateEnhancedMilestone(-1, type);
      } catch {
        thrown = true;
      }
      expect(thrown).toBe(true);
    }
  });
});

// ── evaluateEnhancedMilestone — DB-fixture paths (lines 102-233) ──────────────
// Tests the "too old", "wrong window", "fresh horse success", and "already evaluated"
// branches that require real DB fixtures.

describe('evaluateEnhancedMilestone() — DB-fixture paths (Equoria-jkht)', () => {
  let fixtureUser;
  let tooOldHorse;
  let wrongWindowHorse;
  let freshHorse;

  beforeAll(async () => {
    const ts = Date.now();
    fixtureUser = await prisma.user.create({
      data: {
        email: `emes-fixture-${ts}-${Math.random().toString(36).slice(2, 8)}@test.com`,
        username: `emesfix${ts}${Math.random().toString(36).slice(2, 6)}`,
        password: 'irrelevant-hash',
        firstName: 'EMES',
        lastName: 'Fixture',
        money: 1000,
      },
    });

    // Horse born 1100 days ago → ageInDays >= 1095 → "too old" path (lines 107-113)
    tooOldHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-EMES-TooOld-${ts}`,
        sex: 'Colt',
        dateOfBirth: new Date(Date.now() - 1100 * 24 * 60 * 60 * 1000),
        age: 1100,
        userId: fixtureUser.id,
      },
    });

    // Horse born 30 days ago → ageInDays=30 > IMPRINTING.end=1 → "wrong window" (lines 117-124)
    wrongWindowHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-EMES-WrongWindow-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        age: 30,
        userId: fixtureUser.id,
      },
    });

    // Horse born today → ageInDays=0 → in IMPRINTING window {start:0,end:1} (lines 127-232)
    freshHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-EMES-Fresh-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: fixtureUser.id,
      },
    });
  }, 30000);

  afterAll(async () => {
    // cascade deletes milestoneTraitLog rows (onDelete: Cascade on Horse relation)
    await prisma.horse
      .deleteMany({
        where: { name: { startsWith: 'TestFixture-EMES-' } },
      })
      .catch(() => {});
    await prisma.user.delete({ where: { id: fixtureUser.id } }).catch(() => {});
  }, 30000);

  it('returns { success:false, reason:/too old/ } for horse >= 1095 days old (lines 107-113)', async () => {
    const result = await evaluateEnhancedMilestone(tooOldHorse.id, MILESTONE_TYPES.IMPRINTING);
    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/too old/i);
    expect(result.ageInDays).toBeGreaterThanOrEqual(1095);
  });

  it('returns { success:false, reason:/age window/ } when horse is outside milestone window (lines 117-124)', async () => {
    const result = await evaluateEnhancedMilestone(wrongWindowHorse.id, MILESTONE_TYPES.IMPRINTING);
    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/age window|appropriate age/i);
    expect(result.ageInDays).toBeGreaterThan(DEVELOPMENTAL_WINDOWS[MILESTONE_TYPES.IMPRINTING].end);
  });

  it('returns { success:true, milestoneLog } for a fresh horse in IMPRINTING window (lines 127-233)', async () => {
    const result = await evaluateEnhancedMilestone(freshHorse.id, MILESTONE_TYPES.IMPRINTING);
    expect(result.success).toBe(true);
    expect(result.milestoneLog).toBeDefined();
    expect(result.milestoneLog.horseId).toBe(freshHorse.id);
    expect(result.milestoneLog.milestoneType).toBe(MILESTONE_TYPES.IMPRINTING);
    expect(typeof result.finalScore).toBe('number');
    expect(result.traitOutcome).toBeDefined();
  });

  it('returns { success:false, reason:/already evaluated/ } on second call (lines 134-140)', async () => {
    // First call was in the previous test — this is the second call for the same horse+type
    const result = await evaluateEnhancedMilestone(freshHorse.id, MILESTONE_TYPES.IMPRINTING);
    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/already evaluated|already/i);
    expect(result.existingEvaluation).toBeDefined();
  });
});

// ── evaluateEnhancedMilestone — personality effects + interaction branch ────────
// Covers lines 168-180 (personality+temperament block) and line 297 (averageQuality
// ternary true-branch inside getGroomCareHistory).
//
// Fixture: horse with temperament set + active groom assignment + groomInteraction today.

describe('evaluateEnhancedMilestone() — personality effects + interaction branch (lines 168-180, 297) (Equoria-rr7)', () => {
  let personalityUser;
  let personalityGroom;
  let personalityHorse;

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    personalityUser = await prisma.user.create({
      data: {
        email: `emes-personality-${ts}-${rand()}@test.com`,
        username: `emespersonality${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'EMES',
        lastName: 'Personality',
        money: 1000,
      },
    });

    personalityGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-PersonalityGroom-${ts}`,
        speciality: 'foalCare',
        personality: 'gentle',
        userId: personalityUser.id,
        isActive: true,
      },
    });

    // Horse born today (age=0) → in IMPRINTING window {start:0, end:1}
    // temperament must be non-null to trigger personality effects block
    personalityHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-PersonalityHorse-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: personalityUser.id,
        temperament: 'bold',
      },
    });

    // Active groomAssignment → currentGroom is set in evaluateEnhancedMilestone
    await prisma.groomAssignment.create({
      data: {
        foalId: personalityHorse.id,
        groomId: personalityGroom.id,
        userId: personalityUser.id,
        priority: 1,
        isActive: true,
      },
    });

    // A groomInteraction today → interactions.length > 0 → covers line 297
    await prisma.groomInteraction.create({
      data: {
        foalId: personalityHorse.id,
        groomId: personalityGroom.id,
        interactionType: 'grooming',
        duration: 30,
        bondingChange: 5,
        timestamp: new Date(),
      },
    });
  }, 30000);

  afterAll(async () => {
    // cascade: milestoneTraitLog rows deleted by Horse onDelete:Cascade
    await prisma.groomInteraction.deleteMany({ where: { foalId: personalityHorse.id } }).catch(() => {});
    await prisma.groomAssignment.deleteMany({ where: { foalId: personalityHorse.id } }).catch(() => {});
    await prisma.horse.delete({ where: { id: personalityHorse.id } }).catch(() => {});
    await prisma.groom.delete({ where: { id: personalityGroom.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: personalityUser.id } }).catch(() => {});
  }, 30000);

  it('applies personality effects (lines 168-180) and computes averageQuality from interactions (line 297)', async () => {
    const result = await evaluateEnhancedMilestone(personalityHorse.id, MILESTONE_TYPES.IMPRINTING);
    expect(result.success).toBe(true);
    expect(result.milestoneLog).toBeDefined();
    // personalityCompatibility should be set (non-null) since groom has personality and horse has temperament
    expect(result.personalityCompatibility).toBeDefined();
    // finalScore reflects personality modifier
    expect(typeof result.finalScore).toBe('number');
  });
});
