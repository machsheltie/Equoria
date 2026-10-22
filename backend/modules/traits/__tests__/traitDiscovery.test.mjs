/**
 * traitDiscovery — branch-coverage tests (Equoria-jkht)
 *
 * Covers DISCOVERY_CONDITIONS, checkDiscoveryConditions and getDiscoveryProgress
 * (the read side used by GET /traits/discovery-status and /trait-discovery/*).
 * No mocks.
 *
 * Equoria-ecp0i. OLD CONTRACT: the module also exported ENRICHMENT_DISCOVERIES
 * (six enrichment activity names: social_interaction, group_play,
 * puzzle_feeding, obstacle_course, free_exercise, controlled_movement) and
 * checkEnrichmentDiscoveries, and revealTraits took a checkEnrichment flag.
 * NEW RULING (owner, 2026-10-16, fr2kg F14): nothing produces those
 * activities since the player-run enrichment was removed (Equoria-fr2kg), so
 * they go; groom-driven trait discovery stays.
 *
 * Equoria-0w96q. OLD CONTRACT: revealTraits / batchRevealTraits moved hidden
 * trait names into positive/negative and wrote the whole epigeneticModifiers
 * object back, outside a transaction. NEW RULING: it had no production caller
 * once the player discovery routes went (Equoria-gu8jk; owner ruling
 * 2026-10-20: players never reveal traits), and hidden traits stay inert until
 * revealed (owner ruling 2026-10-19). The dead writer and its only importer,
 * the never-mounted traitDiscoveryMiddleware, were deleted.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as traitDiscovery from '../../../utils/traitDiscovery.mjs';
import {
  checkDiscoveryConditions,
  DISCOVERY_CONDITIONS,
  getDiscoveryProgress,
} from '../../../utils/traitDiscovery.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
// Equoria-1ohys: fail-loud scoped cleanup. A silent no-op catch arm on the
// afterAll deletes leaks fixture rows into the canonical DB (CLAUDE.md §2) and
// keeps the suite green while a leak trips downstream sentinels. The tracker
// runs every registered scoped delete in FK order and throws loudly if any fail.
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

// ── Retired exports (Equoria-ecp0i, Equoria-0w96q) ───────────────────────────

describe('retired trait discovery exports', () => {
  it.each(['ENRICHMENT_DISCOVERIES', 'checkEnrichmentDiscoveries', 'revealTraits', 'batchRevealTraits'])(
    'traitDiscovery no longer exports %s',
    name => {
      expect(traitDiscovery).not.toHaveProperty(name);
    },
  );

  it('the unmounted traitDiscoveryMiddleware module is gone', () => {
    const middlewarePath = fileURLToPath(new URL('../../../middleware/traitDiscoveryMiddleware.mjs', import.meta.url));
    expect(existsSync(middlewarePath)).toBe(false);
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

  // LOW_STRESS: stressLevel <= 20. Horse.stressLevel is NOT NULL (Equoria-507mt)
  // with default 0 = calm; a 0 is the calmest legitimate state and MUST satisfy
  // the condition. The previous `|| 100` guard inverted a calm horse into
  // max-stress (Equoria-4maxb). A missing field (partial select) compares as
  // `undefined <= 20` → false, which is the conservative outcome.
  it('LOW_STRESS returns false when stressLevel is missing (undefined never satisfies <= 20)', () => {
    expect(DISCOVERY_CONDITIONS.LOW_STRESS.condition({})).toBe(false);
  });
  it('LOW_STRESS returns true when stressLevel is 0 (calm horse is not read as max-stress) — Equoria-4maxb', () => {
    expect(DISCOVERY_CONDITIONS.LOW_STRESS.condition({ stressLevel: 0 })).toBe(true);
  });
  it('LOW_STRESS returns true when stressLevel <= 20', () => {
    expect(DISCOVERY_CONDITIONS.LOW_STRESS.condition({ stressLevel: 15 })).toBe(true);
  });
  it('LOW_STRESS returns false when stressLevel > 20', () => {
    expect(DISCOVERY_CONDITIONS.LOW_STRESS.condition({ stressLevel: 21 })).toBe(false);
  });

  // MINIMAL_STRESS: stressLevel <= 5
  it('MINIMAL_STRESS returns true when stressLevel is 3', () => {
    expect(DISCOVERY_CONDITIONS.MINIMAL_STRESS.condition({ stressLevel: 3 })).toBe(true);
  });
  it('MINIMAL_STRESS returns true when stressLevel is 0 — Equoria-4maxb', () => {
    expect(DISCOVERY_CONDITIONS.MINIMAL_STRESS.condition({ stressLevel: 0 })).toBe(true);
  });
  it('MINIMAL_STRESS returns false when stressLevel is 10', () => {
    expect(DISCOVERY_CONDITIONS.MINIMAL_STRESS.condition({ stressLevel: 10 })).toBe(false);
  });

  // PERFECT_CARE: bondScore >= 80 AND stressLevel <= 20
  it('PERFECT_CARE returns true when both criteria met', () => {
    expect(DISCOVERY_CONDITIONS.PERFECT_CARE.condition({ bondScore: 85, stressLevel: 10 })).toBe(true);
  });
  it('PERFECT_CARE returns true for a fully bonded, perfectly calm (stressLevel 0) horse — Equoria-4maxb', () => {
    expect(DISCOVERY_CONDITIONS.PERFECT_CARE.condition({ bondScore: 85, stressLevel: 0 })).toBe(true);
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

// ── getDiscoveryProgress — DB-fixture happy path ─────────────────────────────

describe('getDiscoveryProgress() — DB-fixture path (Equoria-jkht)', () => {
  let tdUser;
  let noHiddenHorse;
  const cleanup = createCleanupTracker();

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

    noHiddenHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
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

    // Equoria-g9sa: explicit SCOPED horse cleanup FIRST. Fixtures use raw
    // prisma.horse.create() but now spread ...fixtureColor(), so they carry a
    // valid phenotype and do NOT trip horseColorNullSentinel even transiently.
    // Cleanup is scoped by THIS suite's own userId (unique per run) — explicit,
    // not cascade-only — so a leaked row (Equoria-lfj5 class) cannot recur, and
    // we won't delete a sibling suite's in-flight TestFixture-TD-* rows that
    // share the prefix. FK order: horses before user (Horse.userId onDelete: Restrict).
    cleanup.add(() => prisma.horse.deleteMany({ where: { userId: tdUser.id } }), 'horses');
    cleanup.add(() => prisma.user.delete({ where: { id: tdUser.id } }), 'user');
  }, 30000);

  afterAll(() => cleanup.run(), 30000);

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
