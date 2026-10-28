/**
 * groomLegacyService unit tests (Equoria-rr7 coverage sprint).
 *
 * groomLegacyService: DB fixture (user + groom). (The databaseOptimizationService
 * half went with that dead file, deleted 2026-10-21.)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import {
  LEGACY_PERKS,
  getLegacyPerks,
  checkLegacyEligibility,
  getUserLegacyHistory,
} from '../services/groomLegacyService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

let user;
let groom;
const cleanup = createCleanupTracker();

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      emailVerified: true,
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
      speciality: 'foalCare',
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
    const result = getLegacyPerks('unknownPersonality');
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
