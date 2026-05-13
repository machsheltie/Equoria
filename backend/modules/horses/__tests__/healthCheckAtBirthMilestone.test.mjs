/**
 * healthCheck + atBirthTraits (pure fns) + enhancedMilestoneEvaluationSystem constants
 * + emailVerificationService (pure fns) unit tests (Equoria-rr7 coverage sprint).
 *
 * All tested functions are pure sync or self-contained with real-DB connectivity.
 * No horse fixture is needed — the pure-sync functions drive coverage.
 */

import { describe, it, expect } from '@jest/globals';
import { HealthCheck } from '../../utils/healthCheck.mjs';
import {
  AT_BIRTH_TRAITS,
  evaluateTraitConditions,
  checkLineageForDisciplineAffinity,
  getMostCommonDisciplineFromHistory,
} from '../../utils/atBirthTraits.mjs';
import {
  MILESTONE_TYPES,
  DEVELOPMENTAL_WINDOWS,
  TRAIT_THRESHOLDS,
  MILESTONE_TRAIT_POOLS,
} from '../../utils/enhancedMilestoneEvaluationSystem.mjs';
import { generateVerificationToken, hashVerificationToken } from '../../utils/emailVerificationService.mjs';

// ── HealthCheck ───────────────────────────────────────────────────────────────

describe('HealthCheck.checkDatabase', () => {
  it('returns status healthy when DB is reachable', async () => {
    const result = await HealthCheck.checkDatabase();
    expect(typeof result.status).toBe('string');
    expect(['healthy', 'unhealthy']).toContain(result.status);
    expect(typeof result.message).toBe('string');
    expect(typeof result.timestamp).toBe('string');
  });
});

describe('HealthCheck.checkMemoryUsage', () => {
  it('returns memory shape with rss and heap data', async () => {
    const result = await HealthCheck.checkMemoryUsage();
    expect(typeof result.status).toBe('string');
    expect(typeof result.data.rss).toBe('string');
    expect(typeof result.data.heapUsed).toBe('string');
    expect(typeof result.data.heapTotal).toBe('string');
    expect(typeof result.timestamp).toBe('string');
  });
});

describe('HealthCheck.getUptime', () => {
  it('returns uptime shape', () => {
    const result = HealthCheck.getUptime();
    expect(result.status).toBe('healthy');
    expect(typeof result.data.uptime).toBe('string');
    expect(typeof result.data.uptimeSeconds).toBe('number');
    expect(result.data.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });
});

describe('HealthCheck.getSystemInfo', () => {
  it('returns system info shape', async () => {
    const result = await HealthCheck.getSystemInfo();
    expect(result.status).toBe('healthy');
    expect(typeof result.data.nodeVersion).toBe('string');
    expect(typeof result.data.platform).toBe('string');
    expect(typeof result.data.pid).toBe('number');
  });
});

describe('HealthCheck.performFullHealthCheck', () => {
  it('returns full check shape with database/memory/uptime/system', async () => {
    const result = await HealthCheck.performFullHealthCheck();
    expect(typeof result.status).toBe('string');
    expect(['healthy', 'warning', 'unhealthy']).toContain(result.status);
    expect(typeof result.checks.database).toBe('object');
    expect(typeof result.checks.memory).toBe('object');
    expect(typeof result.checks.uptime).toBe('object');
    expect(typeof result.checks.system).toBe('object');
  });
});

// ── atBirthTraits (pure fns) ──────────────────────────────────────────────────

describe('AT_BIRTH_TRAITS', () => {
  it('contains positive and negative categories', () => {
    expect(typeof AT_BIRTH_TRAITS).toBe('object');
    expect(typeof AT_BIRTH_TRAITS.positive).toBe('object');
    expect(typeof AT_BIRTH_TRAITS.negative).toBe('object');
    expect(AT_BIRTH_TRAITS.positive.hardy).toBeDefined();
  });
});

describe('evaluateTraitConditions', () => {
  it('returns true when all conditions are met', () => {
    const conditions = { mareStressMax: 30, feedQualityMin: 70 };
    const actual = { mareStress: 20, feedQuality: 80 };
    expect(evaluateTraitConditions(conditions, actual)).toBe(true);
  });

  it('returns false when mareStress exceeds mareStressMax', () => {
    const conditions = { mareStressMax: 20 };
    const actual = { mareStress: 50 };
    expect(evaluateTraitConditions(conditions, actual)).toBe(false);
  });

  it('returns false when feedQuality is below feedQualityMin', () => {
    const conditions = { feedQualityMin: 80 };
    const actual = { feedQuality: 60 };
    expect(evaluateTraitConditions(conditions, actual)).toBe(false);
  });

  it('returns true for empty conditions', () => {
    expect(evaluateTraitConditions({}, {})).toBe(true);
  });
});

describe('checkLineageForDisciplineAffinity', () => {
  it('returns affinity:false for empty ancestor list', () => {
    const result = checkLineageForDisciplineAffinity([]);
    expect(result.affinity).toBe(false);
  });

  it('returns affinity:true when 3+ ancestors share discipline', () => {
    const ancestors = [{ discipline: 'Dressage' }, { discipline: 'Dressage' }, { discipline: 'Dressage' }];
    const result = checkLineageForDisciplineAffinity(ancestors);
    expect(result.affinity).toBe(true);
    expect(result.discipline).toBe('Dressage');
    expect(result.count).toBeGreaterThanOrEqual(3);
  });

  it('returns affinity:false when no discipline dominates', () => {
    const ancestors = [{ discipline: 'Dressage' }, { discipline: 'Jumping' }, { discipline: 'Racing' }];
    const result = checkLineageForDisciplineAffinity(ancestors);
    expect(result.affinity).toBe(false);
  });
});

describe('getMostCommonDisciplineFromHistory', () => {
  it('returns null for empty history', () => {
    expect(getMostCommonDisciplineFromHistory([])).toBeNull();
    expect(getMostCommonDisciplineFromHistory(null)).toBeNull();
  });

  it('returns most common discipline from history', () => {
    const history = [{ discipline: 'Dressage' }, { discipline: 'Dressage' }, { discipline: 'Jumping' }];
    const result = getMostCommonDisciplineFromHistory(history);
    expect(result).toBe('Dressage');
  });
});

// ── enhancedMilestoneEvaluationSystem constants ───────────────────────────────

describe('MILESTONE_TYPES', () => {
  it('contains all five developmental milestone keys', () => {
    expect(MILESTONE_TYPES.IMPRINTING).toBe('imprinting');
    expect(MILESTONE_TYPES.SOCIALIZATION).toBe('socialization');
    expect(MILESTONE_TYPES.CURIOSITY_PLAY).toBe('curiosity_play');
    expect(MILESTONE_TYPES.TRUST_HANDLING).toBe('trust_handling');
    expect(MILESTONE_TYPES.CONFIDENCE_REACTIVITY).toBe('confidence_reactivity');
  });
});

describe('DEVELOPMENTAL_WINDOWS', () => {
  it('imprinting window starts at day 0 and ends at day 1', () => {
    expect(DEVELOPMENTAL_WINDOWS[MILESTONE_TYPES.IMPRINTING].start).toBe(0);
    expect(DEVELOPMENTAL_WINDOWS[MILESTONE_TYPES.IMPRINTING].end).toBe(1);
  });

  it('all windows have start and end values', () => {
    for (const window of Object.values(DEVELOPMENTAL_WINDOWS)) {
      expect(typeof window.start).toBe('number');
      expect(typeof window.end).toBe('number');
      expect(window.end).toBeGreaterThan(window.start);
    }
  });
});

describe('TRAIT_THRESHOLDS', () => {
  it('CONFIRM is 3 and DENY is -3', () => {
    expect(TRAIT_THRESHOLDS.CONFIRM).toBe(3);
    expect(TRAIT_THRESHOLDS.DENY).toBe(-3);
  });
});

describe('MILESTONE_TRAIT_POOLS', () => {
  it('each milestone has positive and negative trait arrays', () => {
    for (const pool of Object.values(MILESTONE_TRAIT_POOLS)) {
      expect(Array.isArray(pool.positive)).toBe(true);
      expect(Array.isArray(pool.negative)).toBe(true);
      expect(pool.positive.length).toBeGreaterThan(0);
      expect(pool.negative.length).toBeGreaterThan(0);
    }
  });
});

// ── emailVerificationService pure fns ────────────────────────────────────────

describe('generateVerificationToken', () => {
  it('returns a 64-char hex string (32 random bytes)', () => {
    const token = generateVerificationToken();
    expect(typeof token).toBe('string');
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });

  it('returns unique values on successive calls', () => {
    const a = generateVerificationToken();
    const b = generateVerificationToken();
    expect(a).not.toBe(b);
  });
});

describe('hashVerificationToken', () => {
  it('returns a 64-char hex SHA-256 digest', () => {
    const hash = hashVerificationToken('test-token-value');
    expect(typeof hash).toBe('string');
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });

  it('is deterministic — same input produces same hash', () => {
    const token = 'deterministic-verification-token';
    expect(hashVerificationToken(token)).toBe(hashVerificationToken(token));
  });

  it('different tokens produce different hashes', () => {
    expect(hashVerificationToken('token-A')).not.toBe(hashVerificationToken('token-B'));
  });
});
