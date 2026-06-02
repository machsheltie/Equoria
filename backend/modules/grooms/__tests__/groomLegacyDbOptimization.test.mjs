/**
 * groomLegacyService + databaseOptimizationService unit tests
 * (Equoria-rr7 coverage sprint).
 *
 * groomLegacyService: DB fixture (user + groom).
 * databaseOptimizationService: mostly no DB needed (default benchmark path).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import {
  LEGACY_PERKS,
  getLegacyPerks,
  checkLegacyEligibility,
  getUserLegacyHistory,
} from '../services/groomLegacyService.mjs';
import {
  analyzeQueryPerformance,
  benchmarkDatabaseOperations,
} from '../../../services/databaseOptimizationService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

let user;
let groom;
const cleanup = createCleanupTracker();

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `groomlegacy-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `groomlegacy${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'GroomLegacy',
      lastName: 'Tester',
      money: 1000,
    },
  });

  groom = await prisma.groom.create({
    data: {
      name: `TestFixture-GroomLegacyGroom-${Date.now()}`,
      speciality: 'foal_care',
      personality: 'gentle',
      userId: user.id,
    },
  });

  // Scoped, fail-loud cleanup (Equoria-1ohys): swallowed catch arms are
  // replaced by the tracker so a failed delete fails the suite. FK order —
  // groom before user (Groom.userId is Restrict).
  cleanup.add(() => prisma.groom.delete({ where: { id: groom.id } }), 'groom');
  cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => cleanup.run(), 30000);

// ── groomLegacyService ────────────────────────────────────────────────────────

describe('LEGACY_PERKS', () => {
  it('contains personality categories', () => {
    expect(typeof LEGACY_PERKS).toBe('object');
    expect(Array.isArray(LEGACY_PERKS.calm)).toBe(true);
    expect(LEGACY_PERKS.calm.length).toBeGreaterThan(0);
  });
});

describe('getLegacyPerks', () => {
  it('returns array of perks for calm personality', () => {
    const result = getLegacyPerks('calm');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(typeof result[0].id).toBe('string');
    expect(typeof result[0].effect).toBe('object');
  });

  it('returns empty array for unknown personality', () => {
    const result = getLegacyPerks('unknown_personality');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });
});

describe('checkLegacyEligibility', () => {
  it('returns not_found for non-existent groom', async () => {
    const result = await checkLegacyEligibility(999999999);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('groom_not_found');
  });

  it('returns not_retired for fresh active groom', async () => {
    const result = await checkLegacyEligibility(groom.id);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('not_retired');
  });
});

describe('getUserLegacyHistory', () => {
  it('returns empty array for user with no legacy history', async () => {
    const result = await getUserLegacyHistory(user.id);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });
});

// ── databaseOptimizationService ───────────────────────────────────────────────

describe('analyzeQueryPerformance', () => {
  it('throws for unknown query type', async () => {
    await expect(analyzeQueryPerformance({ queryType: 'totally_unknown_type' })).rejects.toThrow();
  });

  it('returns performance shape for epigenetic_trait_search', async () => {
    const result = await analyzeQueryPerformance({ queryType: 'epigenetic_trait_search' });
    expect(result.queryType).toBe('epigenetic_trait_search');
    expect(typeof result.executionTime).toBe('number');
    expect(Array.isArray(result.recommendations)).toBe(true);
  });
});

describe('benchmarkDatabaseOperations', () => {
  it('returns default benchmark shape with no options', async () => {
    const result = await benchmarkDatabaseOperations();
    expect(typeof result.averageQueryTime).toBe('number');
    expect(typeof result.p95QueryTime).toBe('number');
    expect(typeof result.throughput).toBe('number');
    expect(result.errorRate).toBe(0);
  });
});
