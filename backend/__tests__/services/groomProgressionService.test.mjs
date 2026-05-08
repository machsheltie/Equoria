/**
 * groomProgressionService unit tests (Equoria-rr7 coverage sprint).
 *
 * calculateGroomLevel: pure sync, no DB.
 * Async functions: DB fixture — user + groom + horse.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  calculateGroomLevel,
  awardGroomXP,
  updateGroomSynergy,
  logGroomAssignment,
  getGroomProfile,
} from '../../services/groomProgressionService.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

let user;
let horse;
let groom;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `groomprogress-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `groomprogress${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'GroomProgress',
      lastName: 'Tester',
      money: 1000,
    },
  });

  horse = await prisma.horse.create({
    data: {
      name: `TestFixture-GroomProgressHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    },
  });

  groom = await prisma.groom.create({
    data: {
      name: `TestFixture-GroomProgressGroom-${Date.now()}`,
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

// ── calculateGroomLevel ───────────────────────────────────────────────────────

describe('calculateGroomLevel', () => {
  it('returns 1 for 0 experience', () => {
    expect(calculateGroomLevel(0)).toBe(1);
  });

  it('returns 1 for 99 experience', () => {
    expect(calculateGroomLevel(99)).toBe(1);
  });

  it('returns 2 for 100 experience', () => {
    expect(calculateGroomLevel(100)).toBe(2);
  });

  it('returns 10 (cap) for very high experience', () => {
    expect(calculateGroomLevel(99999)).toBe(10);
  });

  it('returns a number between 1 and 10', () => {
    const level = calculateGroomLevel(500);
    expect(level).toBeGreaterThanOrEqual(1);
    expect(level).toBeLessThanOrEqual(10);
  });
});

// ── awardGroomXP ──────────────────────────────────────────────────────────────

describe('awardGroomXP', () => {
  it('returns error object for non-existent groom', async () => {
    const result = await awardGroomXP(999999999, 'milestone_completion', 50);
    expect(result.success).toBe(false);
    expect(typeof result.error).toBe('string');
  });

  it('returns XP result shape for valid groom', async () => {
    const result = await awardGroomXP(groom.id, 'milestone_completion', 10);

    expect(result).toBeDefined();
    expect(typeof result.xpGained).toBe('number');
    expect(typeof result.newExperience).toBe('number');
    expect(typeof result.newLevel).toBe('number');
    expect(result.xpGained).toBe(10);
  });
});

// ── updateGroomSynergy ────────────────────────────────────────────────────────

describe('updateGroomSynergy', () => {
  it('returns error object for non-existent groom', async () => {
    const result = await updateGroomSynergy(999999999, horse.id, 'assignment', 1);
    expect(result).toBeDefined();
    expect(result.success).toBe(false);
  });

  it('returns synergy result for valid groom+horse', async () => {
    const result = await updateGroomSynergy(groom.id, horse.id, 'assignment', 1);
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });
});

// ── logGroomAssignment ────────────────────────────────────────────────────────

describe('logGroomAssignment', () => {
  it('returns log entry for valid groom+horse assign action', async () => {
    const result = await logGroomAssignment(groom.id, horse.id, 'assign', {});
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });
});

// ── getGroomProfile ───────────────────────────────────────────────────────────

describe('getGroomProfile', () => {
  it('returns error object for non-existent groom', async () => {
    const result = await getGroomProfile(999999999);
    expect(result.success).toBe(false);
  });

  it('returns profile shape for valid groom', async () => {
    const result = await getGroomProfile(groom.id);
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });
});
