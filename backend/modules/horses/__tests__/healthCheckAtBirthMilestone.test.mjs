/**
 * healthCheck + enhancedMilestoneEvaluationSystem constants
 * + emailVerificationService (pure fns) unit tests (Equoria-rr7 coverage sprint).
 *
 * All tested functions are pure sync or self-contained with real-DB connectivity.
 * No horse fixture is needed — the pure-sync functions drive coverage.
 *
 * NOTE (Equoria-313oc): the former `atBirthTraits` (Impl B) describe blocks were
 * removed when `utils/atBirthTraits.mjs` was deleted. At-birth trait assignment
 * now lives solely in `utils/applyEpigeneticTraitsAtBirth.mjs` (Impl A), exercised
 * by the foaling-service test suites.
 */

import { describe, it, expect } from '@jest/globals';
import { HealthCheck } from '../../../utils/healthCheck.mjs';
import {
  MILESTONE_TYPES,
  DEVELOPMENTAL_WINDOWS,
  TRAIT_THRESHOLDS,
  MILESTONE_TRAIT_POOLS,
} from '../../../utils/enhancedMilestoneEvaluationSystem.mjs';
import { generateVerificationToken, hashVerificationToken } from '../../../utils/emailVerificationService.mjs';

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
