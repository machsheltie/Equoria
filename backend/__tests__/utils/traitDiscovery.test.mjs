/**
 * traitDiscovery — pure-function branch-coverage tests (Equoria-jkht)
 *
 * Targets checkEnrichmentDiscoveries — the only exported pure sync function.
 * No DB calls. No mocks.
 *
 * Branch map for checkEnrichmentDiscoveries:
 *   forEach activityCounts || 0  → first-occurrence (falsy left) / repeat (truthy left)
 *   reduce  activityCounts || 0  → activity done (truthy) / not done (falsy)
 *   if (completedCount >= minCount) → threshold met / not met (×4 ENRICHMENT entries)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  checkEnrichmentDiscoveries,
  checkDiscoveryConditions,
  ENRICHMENT_DISCOVERIES,
  DISCOVERY_CONDITIONS,
  revealTraits,
  batchRevealTraits,
  getDiscoveryProgress,
} from '../../utils/traitDiscovery.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

// ENRICHMENT_DISCOVERIES entries and their thresholds:
//   SOCIALIZATION_COMPLETE:       activities=[social_interaction, group_play],         minCount=3
//   MENTAL_STIMULATION_COMPLETE:  activities=[puzzle_feeding, obstacle_course],        minCount=2
//   PHYSICAL_DEVELOPMENT_COMPLETE: activities=[free_exercise, controlled_movement],    minCount=4
//   ALL_ENRICHMENT_COMPLETE:      activities=[all 6],                                  minCount=6

function act(type) {
  return { activityType: type };
}

describe('checkEnrichmentDiscoveries()', () => {
  // ── Empty activities ──────────────────────────────────────────────────────

  it('returns empty array when activities is empty', () => {
    const result = checkEnrichmentDiscoveries([]);
    expect(result).toEqual([]);
  });

  // ── No thresholds met ────────────────────────────────────────────────────

  it('returns empty array when activity counts are below all thresholds', () => {
    const activities = [
      act('social_interaction'), // 1 (SOCIALIZATION needs 3)
      act('puzzle_feeding'), // 1 (MENTAL needs 2)
    ];
    const result = checkEnrichmentDiscoveries(activities);
    expect(result).toEqual([]);
  });

  // ── activityCounts || 0: repeated type (truthy left branch) ──────────────

  it('counts repeated activity types correctly (covers truthy-left || branch)', () => {
    // social_interaction × 3 meets SOCIALIZATION_COMPLETE (minCount=3)
    const activities = [act('social_interaction'), act('social_interaction'), act('social_interaction')];
    const result = checkEnrichmentDiscoveries(activities);
    const found = result.find(c => c.name === 'SOCIALIZATION_COMPLETE');
    expect(found).toBeDefined();
    expect(found.completedCount).toBe(3);
  });

  // ── MENTAL_STIMULATION_COMPLETE met ──────────────────────────────────────

  it('returns MENTAL_STIMULATION_COMPLETE when puzzle_feeding + obstacle_course total >= 2', () => {
    const activities = [act('puzzle_feeding'), act('obstacle_course')];
    const result = checkEnrichmentDiscoveries(activities);
    const found = result.find(c => c.name === 'MENTAL_STIMULATION_COMPLETE');
    expect(found).toBeDefined();
    expect(found.priority).toBe('high');
    expect(found.type).toBe('enrichment');
    expect(found.requiredCount).toBe(2);
  });

  // ── Reduce: activity in discovery list but count 0 (falsy || 0 branch) ──

  it('returns 0 completedCount for discovery activities not present (falsy-left || branch)', () => {
    // Only social_interaction present; MENTAL activities absent → completedCount=0 for MENTAL
    const activities = [
      act('social_interaction'),
      act('group_play'),
      act('social_interaction'),
      act('group_play'),
      act('group_play'), // total social+group = 5 → SOCIALIZATION met (>=3)
    ];
    const result = checkEnrichmentDiscoveries(activities);
    // MENTAL_STIMULATION should NOT be met (puzzle/obstacle not present)
    expect(result.find(c => c.name === 'MENTAL_STIMULATION_COMPLETE')).toBeUndefined();
    // SOCIALIZATION should be met
    expect(result.find(c => c.name === 'SOCIALIZATION_COMPLETE')).toBeDefined();
  });

  // ── PHYSICAL_DEVELOPMENT_COMPLETE met ────────────────────────────────────

  it('returns PHYSICAL_DEVELOPMENT_COMPLETE when total free+controlled >= 4', () => {
    const activities = [
      act('free_exercise'),
      act('free_exercise'),
      act('controlled_movement'),
      act('controlled_movement'),
    ];
    const result = checkEnrichmentDiscoveries(activities);
    const found = result.find(c => c.name === 'PHYSICAL_DEVELOPMENT_COMPLETE');
    expect(found).toBeDefined();
    expect(found.completedCount).toBe(4);
    expect(found.requiredCount).toBe(4);
  });

  // ── ALL_ENRICHMENT_COMPLETE met ───────────────────────────────────────────

  it('returns ALL_ENRICHMENT_COMPLETE when all 6 activity types provided (total >= 6)', () => {
    const activities = [
      act('social_interaction'),
      act('group_play'),
      act('puzzle_feeding'),
      act('obstacle_course'),
      act('free_exercise'),
      act('controlled_movement'),
    ];
    const result = checkEnrichmentDiscoveries(activities);
    const found = result.find(c => c.name === 'ALL_ENRICHMENT_COMPLETE');
    expect(found).toBeDefined();
    expect(found.priority).toBe('legendary');
    expect(found.completedCount).toBe(6);
  });

  // ── Multiple conditions met ───────────────────────────────────────────────

  it('returns multiple metConditions when several discoveries are satisfied', () => {
    const activities = [
      // social_interaction × 3 → SOCIALIZATION_COMPLETE
      act('social_interaction'),
      act('social_interaction'),
      act('social_interaction'),
      // puzzle_feeding × 2 → MENTAL_STIMULATION_COMPLETE
      act('puzzle_feeding'),
      act('obstacle_course'),
    ];
    const result = checkEnrichmentDiscoveries(activities);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.find(c => c.name === 'SOCIALIZATION_COMPLETE')).toBeDefined();
    expect(result.find(c => c.name === 'MENTAL_STIMULATION_COMPLETE')).toBeDefined();
  });

  // ── Return shape ─────────────────────────────────────────────────────────

  it('returned conditions have name, description, priority, type, completedCount, requiredCount', () => {
    const activities = [act('puzzle_feeding'), act('obstacle_course')];
    const result = checkEnrichmentDiscoveries(activities);
    expect(result.length).toBeGreaterThan(0);
    const cond = result[0];
    expect(cond).toHaveProperty('name');
    expect(cond).toHaveProperty('description');
    expect(cond).toHaveProperty('priority');
    expect(cond.type).toBe('enrichment');
    expect(typeof cond.completedCount).toBe('number');
    expect(typeof cond.requiredCount).toBe('number');
  });

  // ── Constants are exported and well-formed ────────────────────────────────

  it('ENRICHMENT_DISCOVERIES has 4 entries each with activities array and minCount', () => {
    const entries = Object.entries(ENRICHMENT_DISCOVERIES);
    expect(entries.length).toBe(4);
    for (const [, discovery] of entries) {
      expect(Array.isArray(discovery.activities)).toBe(true);
      expect(typeof discovery.minCount).toBe('number');
      expect(discovery.minCount).toBeGreaterThan(0);
    }
  });
});

// ── DISCOVERY_CONDITIONS — condition closures (synchronous) ──────────────────

describe('DISCOVERY_CONDITIONS — structure and synchronous condition branches', () => {
  it('has expected keys', () => {
    const keys = Object.keys(DISCOVERY_CONDITIONS);
    expect(keys).toContain('HIGH_BOND');
    expect(keys).toContain('EXCELLENT_BOND');
    expect(keys).toContain('LOW_STRESS');
    expect(keys).toContain('MINIMAL_STRESS');
    expect(keys).toContain('PERFECT_CARE');
    expect(keys).toContain('MATURE_BOND');
    expect(keys).toContain('CONSISTENT_TRAINING');
  });

  it('each synchronous entry has name, condition fn, description, priority', () => {
    for (const [, cond] of Object.entries(DISCOVERY_CONDITIONS)) {
      expect(typeof cond.name).toBe('string');
      expect(typeof cond.condition).toBe('function');
      expect(typeof cond.description).toBe('string');
      expect(typeof cond.priority).toBe('string');
    }
  });

  // HIGH_BOND: (bondScore || 0) >= 80
  it('HIGH_BOND returns false when bondScore < 80', () => {
    expect(DISCOVERY_CONDITIONS.HIGH_BOND.condition({ bondScore: 50 })).toBe(false);
  });
  it('HIGH_BOND returns true when bondScore >= 80', () => {
    expect(DISCOVERY_CONDITIONS.HIGH_BOND.condition({ bondScore: 80 })).toBe(true);
  });
  it('HIGH_BOND uses default 0 when bondScore missing', () => {
    expect(DISCOVERY_CONDITIONS.HIGH_BOND.condition({})).toBe(false);
  });

  // EXCELLENT_BOND: (bondScore || 0) >= 95
  it('EXCELLENT_BOND returns false for bondScore 80', () => {
    expect(DISCOVERY_CONDITIONS.EXCELLENT_BOND.condition({ bondScore: 80 })).toBe(false);
  });
  it('EXCELLENT_BOND returns true for bondScore 95', () => {
    expect(DISCOVERY_CONDITIONS.EXCELLENT_BOND.condition({ bondScore: 95 })).toBe(true);
  });

  // LOW_STRESS: (stressLevel || 100) <= 20  — note: 0 falls back to 100
  it('LOW_STRESS uses default 100 when stressLevel missing (100 > 20 → false)', () => {
    expect(DISCOVERY_CONDITIONS.LOW_STRESS.condition({})).toBe(false);
  });
  it('LOW_STRESS uses default 100 when stressLevel is 0 (0 || 100 = 100 → false)', () => {
    expect(DISCOVERY_CONDITIONS.LOW_STRESS.condition({ stressLevel: 0 })).toBe(false);
  });
  it('LOW_STRESS returns true when stressLevel <= 20', () => {
    expect(DISCOVERY_CONDITIONS.LOW_STRESS.condition({ stressLevel: 15 })).toBe(true);
  });
  it('LOW_STRESS returns false when stressLevel > 20', () => {
    expect(DISCOVERY_CONDITIONS.LOW_STRESS.condition({ stressLevel: 21 })).toBe(false);
  });

  // MINIMAL_STRESS: (stressLevel || 100) <= 5
  it('MINIMAL_STRESS returns true when stressLevel is 3', () => {
    expect(DISCOVERY_CONDITIONS.MINIMAL_STRESS.condition({ stressLevel: 3 })).toBe(true);
  });
  it('MINIMAL_STRESS returns false when stressLevel is 10', () => {
    expect(DISCOVERY_CONDITIONS.MINIMAL_STRESS.condition({ stressLevel: 10 })).toBe(false);
  });

  // PERFECT_CARE: bondScore >= 80 AND stressLevel <= 20
  it('PERFECT_CARE returns true when both criteria met', () => {
    expect(DISCOVERY_CONDITIONS.PERFECT_CARE.condition({ bondScore: 85, stressLevel: 10 })).toBe(true);
  });
  it('PERFECT_CARE returns false when only bond criterion met', () => {
    expect(DISCOVERY_CONDITIONS.PERFECT_CARE.condition({ bondScore: 85, stressLevel: 50 })).toBe(false);
  });
  it('PERFECT_CARE returns false when only stress criterion met', () => {
    expect(DISCOVERY_CONDITIONS.PERFECT_CARE.condition({ bondScore: 50, stressLevel: 10 })).toBe(false);
  });

  // MATURE_BOND: age >= 3 AND (bondScore || 0) >= 70
  it('MATURE_BOND returns true for adult horse with sufficient bond', () => {
    expect(DISCOVERY_CONDITIONS.MATURE_BOND.condition({ age: 4, bondScore: 75 })).toBe(true);
  });
  it('MATURE_BOND returns false for young horse', () => {
    expect(DISCOVERY_CONDITIONS.MATURE_BOND.condition({ age: 2, bondScore: 90 })).toBe(false);
  });
  it('MATURE_BOND returns false for adult with low bond', () => {
    expect(DISCOVERY_CONDITIONS.MATURE_BOND.condition({ age: 4, bondScore: 50 })).toBe(false);
  });

  // CONSISTENT_TRAINING is async
  it('CONSISTENT_TRAINING has async:true flag', () => {
    expect(DISCOVERY_CONDITIONS.CONSISTENT_TRAINING.async).toBe(true);
  });
});

// ── checkDiscoveryConditions — async, uses real DB (horse.id=-1 → 0 logs) ────

describe('checkDiscoveryConditions()', () => {
  it('returns empty array when no conditions are met (bond=0, stress=100, age=0)', async () => {
    const horse = { id: -1, bondScore: 0, stressLevel: 100, age: 0 };
    const result = await checkDiscoveryConditions(horse);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
  }, 10000);

  it('returns HIGH_BOND when bondScore >= 80', async () => {
    const horse = { id: -1, bondScore: 85, stressLevel: 100, age: 1 };
    const result = await checkDiscoveryConditions(horse);
    const names = result.map(c => c.name);
    expect(names).toContain('HIGH_BOND');
  }, 10000);

  it('returns HIGH_BOND and EXCELLENT_BOND when bondScore >= 95', async () => {
    const horse = { id: -1, bondScore: 97, stressLevel: 100, age: 1 };
    const result = await checkDiscoveryConditions(horse);
    const names = result.map(c => c.name);
    expect(names).toContain('HIGH_BOND');
    expect(names).toContain('EXCELLENT_BOND');
  }, 10000);

  it('returns LOW_STRESS when stressLevel <= 20', async () => {
    const horse = { id: -1, bondScore: 10, stressLevel: 15, age: 1 };
    const result = await checkDiscoveryConditions(horse);
    const names = result.map(c => c.name);
    expect(names).toContain('LOW_STRESS');
  }, 10000);

  it('returns MINIMAL_STRESS and LOW_STRESS when stressLevel <= 5', async () => {
    const horse = { id: -1, bondScore: 10, stressLevel: 3, age: 1 };
    const result = await checkDiscoveryConditions(horse);
    const names = result.map(c => c.name);
    expect(names).toContain('LOW_STRESS');
    expect(names).toContain('MINIMAL_STRESS');
  }, 10000);

  it('returns MATURE_BOND when age >= 3 and bondScore >= 70', async () => {
    const horse = { id: -1, bondScore: 75, stressLevel: 100, age: 5 };
    const result = await checkDiscoveryConditions(horse);
    const names = result.map(c => c.name);
    expect(names).toContain('MATURE_BOND');
  }, 10000);

  it('returns PERFECT_CARE + HIGH_BOND + LOW_STRESS when both criteria met', async () => {
    const horse = { id: -1, bondScore: 90, stressLevel: 10, age: 1 };
    const result = await checkDiscoveryConditions(horse);
    const names = result.map(c => c.name);
    expect(names).toContain('PERFECT_CARE');
    expect(names).toContain('HIGH_BOND');
    expect(names).toContain('LOW_STRESS');
  }, 10000);

  it('returned conditions have name, description, priority, category, type', async () => {
    const horse = { id: -1, bondScore: 85, stressLevel: 100, age: 1 };
    const result = await checkDiscoveryConditions(horse);
    expect(result.length).toBeGreaterThan(0);
    const cond = result[0];
    expect(typeof cond.name).toBe('string');
    expect(typeof cond.description).toBe('string');
    expect(typeof cond.priority).toBe('string');
    expect(typeof cond.category).toBe('string');
    expect(cond.type).toBe('condition');
  }, 10000);
});

// ── revealTraits — invalid ID and not-found error paths ──────────────────────

describe('revealTraits() — error paths', () => {
  it('throws for non-numeric string horseId', async () => {
    await expect(revealTraits('not-a-number')).rejects.toThrow(/invalid horse id/i);
  });

  it('throws when horse does not exist in DB (id=-1)', async () => {
    await expect(revealTraits(-1)).rejects.toThrow(/not found/i);
  });
});

// ── batchRevealTraits — error path collected ─────────────────────────────────

describe('batchRevealTraits() — non-existent horses', () => {
  it('returns empty array for empty input', async () => {
    const results = await batchRevealTraits([]);
    expect(results).toEqual([]);
  });

  it('returns success=false for each non-existent horse ID', async () => {
    const results = await batchRevealTraits([-1, -2]);
    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(false);
    expect(results[1].success).toBe(false);
    expect(typeof results[0].error).toBe('string');
  }, 15000);
});

// ── getDiscoveryProgress — invalid/not-found error paths ─────────────────────

describe('getDiscoveryProgress() — error paths', () => {
  it('throws for non-numeric string horseId', async () => {
    await expect(getDiscoveryProgress('bad-id')).rejects.toThrow(/invalid horse id/i);
  });

  it('throws when horse does not exist in DB (id=-1)', async () => {
    await expect(getDiscoveryProgress(-1)).rejects.toThrow(/not found/i);
  });
});

// ── checkDiscoveryConditions — catch path (line 340) ─────────────────────────
// When a condition evaluator (synchronous) throws, the per-condition catch fires,
// logs a warning, and the function continues to the next condition.

describe('checkDiscoveryConditions() — condition-throws catch path (Equoria-jkht)', () => {
  it('silently skips conditions whose synchronous evaluator throws (catch path line 340)', async () => {
    // bondScore getter throws → HIGH_BOND, EXCELLENT_BOND, PERFECT_CARE all throw
    // checkDiscoveryConditions catches each and continues — returns remaining met conditions
    const evil = {
      get bondScore() {
        throw new Error('bond bomb');
      },
      id: -1,
      stressLevel: 100,
      age: 0,
    };
    const result = await checkDiscoveryConditions(evil);
    // Should not throw; should return an array (empty since no conditions met)
    expect(Array.isArray(result)).toBe(true);
  }, 10000);
});

// ── revealTraits — DB-fixture paths (lines 190-253) ──────────────────────────
// Covers:
//   no-hidden-traits early return (lines 190-206) — horse with empty hidden array
//   no-conditions-met early return (lines 237-253) — horse with hidden trait, bond=0, stress=100
//   getDiscoveryProgress happy path — horse exists, returns progress object

describe('revealTraits() + getDiscoveryProgress() — DB-fixture paths (Equoria-jkht)', () => {
  let tdUser;
  let noHiddenHorse;
  let noConditionsHorse;

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    tdUser = await prisma.user.create({
      data: {
        email: `td-fixture-${ts}-${rand()}@test.com`,
        username: `tdfix${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'TD',
        lastName: 'Fixture',
        money: 1000,
      },
    });

    // Horse with no hidden traits → revealTraits returns early at line 190
    noHiddenHorse = await prisma.horse.create({
      data: {
        name: `TestFixture-TD-NoHidden-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        bondScore: 50,
        stressLevel: 30,
        userId: tdUser.id,
        epigeneticModifiers: { positive: [], negative: [], hidden: [] },
      },
    });

    // Horse with one hidden trait but bond=0, stress=100 → no conditions met at line 237
    noConditionsHorse = await prisma.horse.create({
      data: {
        name: `TestFixture-TD-NoConditions-${ts}`,
        sex: 'Colt',
        dateOfBirth: new Date(),
        age: 1,
        bondScore: 0,
        stressLevel: 100,
        userId: tdUser.id,
        epigeneticModifiers: { positive: [], negative: [], hidden: ['ConfidentInCrowd'] },
      },
    });
  }, 30000);

  afterAll(async () => {
    // Cascade delete via user (horses owned by tdUser are removed by FK cascade)
    await prisma.user.delete({ where: { id: tdUser.id } }).catch(() => {});
  }, 30000);

  it('returns success:true with empty traitsRevealed when horse has no hidden traits (lines 190-206)', async () => {
    const result = await revealTraits(noHiddenHorse.id);
    expect(result.success).toBe(true);
    expect(result.traitsRevealed).toEqual([]);
    expect(result.totalHiddenBefore).toBe(0);
    expect(result.message).toMatch(/no hidden traits/i);
  }, 15000);

  it('returns success:true with empty traitsRevealed when no discovery conditions met (lines 237-253)', async () => {
    const result = await revealTraits(noConditionsHorse.id);
    expect(result.success).toBe(true);
    expect(result.traitsRevealed).toEqual([]);
    expect(result.totalHiddenBefore).toBe(1);
    expect(result.message).toMatch(/no discovery conditions/i);
  }, 15000);

  it('getDiscoveryProgress returns progress object for existing horse (happy path)', async () => {
    const result = await getDiscoveryProgress(noHiddenHorse.id);
    expect(result.horseId).toBe(noHiddenHorse.id);
    expect(result.horseName).toBe(noHiddenHorse.name);
    expect(typeof result.discoveredTraits).toBe('number');
    expect(typeof result.totalPossibleTraits).toBe('number');
    expect(typeof result.progressPercentage).toBe('number');
    expect(Array.isArray(result.traits)).toBe(true);
    expect(typeof result.hiddenTraitsCount).toBe('number');
    expect(Array.isArray(result.conditions)).toBe(true);
  }, 15000);
});
