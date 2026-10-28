/**
 * traitDiscovery — branch-coverage tests (Equoria-jkht)
 *
 * Covers DISCOVERY_CONDITIONS and checkDiscoveryConditions (the read side used
 * by GET /traits/discovery-status).
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
 *
 * Equoria-tpofm. OLD CONTRACT: getDiscoveryProgress returned a horse's
 * discovery progress. NEW: its routes were retired under Equoria-a7f1p (owner
 * ruling 2026-10-27) and nothing called it, so it was deleted.
 */

import { describe, it, expect } from '@jest/globals';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as traitDiscovery from '../../../utils/traitDiscovery.mjs';
import { checkDiscoveryConditions, DISCOVERY_CONDITIONS } from '../../../utils/traitDiscovery.mjs';

// ── Retired exports (Equoria-ecp0i, Equoria-0w96q, Equoria-tpofm) ───────────────────────────

describe('retired trait discovery exports', () => {
  it.each([
    'ENRICHMENT_DISCOVERIES',
    'checkEnrichmentDiscoveries',
    'revealTraits',
    'batchRevealTraits',
    'getDiscoveryProgress',
  ])('traitDiscovery no longer exports %s', name => {
    expect(traitDiscovery).not.toHaveProperty(name);
  });

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

  // PERFECT_CARE: bondScore >= 80
  it('PERFECT_CARE returns true when the bond criterion is met', () => {
    expect(DISCOVERY_CONDITIONS.PERFECT_CARE.condition({ bondScore: 85 })).toBe(true);
  });
  it('PERFECT_CARE returns true for a fully bonded horse', () => {
    expect(DISCOVERY_CONDITIONS.PERFECT_CARE.condition({ bondScore: 100 })).toBe(true);
  });
  it('PERFECT_CARE returns false below 80 bond', () => {
    expect(DISCOVERY_CONDITIONS.PERFECT_CARE.condition({ bondScore: 79 })).toBe(false);
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
  it('returns empty array when no conditions are met (bond=0, age=0)', async () => {
    const horse = { id: -1, bondScore: 0, age: 0 };
    const result = await checkDiscoveryConditions(horse);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
  }, 10000);

  it('returns HIGH_BOND when bondScore >= 80', async () => {
    const horse = { id: -1, bondScore: 85, age: 1 };
    const result = await checkDiscoveryConditions(horse);
    const names = result.map(c => c.name);
    expect(names).toContain('HIGH_BOND');
  }, 10000);

  it('returns HIGH_BOND and EXCELLENT_BOND when bondScore >= 95', async () => {
    const horse = { id: -1, bondScore: 97, age: 1 };
    const result = await checkDiscoveryConditions(horse);
    const names = result.map(c => c.name);
    expect(names).toContain('HIGH_BOND');
    expect(names).toContain('EXCELLENT_BOND');
  }, 10000);

  it('returns MATURE_BOND when age >= 3 and bondScore >= 70', async () => {
    const horse = { id: -1, bondScore: 75, age: 5 };
    const result = await checkDiscoveryConditions(horse);
    const names = result.map(c => c.name);
    expect(names).toContain('MATURE_BOND');
  }, 10000);

  it('returns PERFECT_CARE + HIGH_BOND when the bond criterion is met', async () => {
    const horse = { id: -1, bondScore: 90, age: 1 };
    const result = await checkDiscoveryConditions(horse);
    const names = result.map(c => c.name);
    expect(names).toContain('PERFECT_CARE');
    expect(names).toContain('HIGH_BOND');
  }, 10000);

  it('returned conditions have name, description, priority, category, type', async () => {
    const horse = { id: -1, bondScore: 85, age: 1 };
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
      age: 0,
    };
    const result = await checkDiscoveryConditions(evil);
    // Should not throw; should return an array (empty since no conditions met)
    expect(Array.isArray(result)).toBe(true);
  }, 10000);
});
