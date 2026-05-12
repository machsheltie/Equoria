/**
 * ultraRareTriggerEngine + traitDiscovery unit tests (Equoria-rr7 coverage sprint).
 *
 * DB fixture: user + Filly foal (no traits, no bond history).
 * Tests exercise the "horse found but no conditions met / no hidden traits" paths.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { evaluateUltraRareTriggers, evaluateExoticUnlocks } from '../../utils/ultraRareTriggerEngine.mjs';
import { revealTraits, batchRevealTraits, getDiscoveryProgress } from '../../utils/traitDiscovery.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

let user;
let horse;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `ultratrait-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `ultratrait${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'UltraTrait',
      lastName: 'Tester',
      money: 1000,
    },
  });

  horse = await prisma.horse.create({
    data: {
      name: `TestFixture-UltraTraitHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ── ultraRareTriggerEngine ────────────────────────────────────────────────────

describe('evaluateUltraRareTriggers', () => {
  it('throws for non-existent horse', async () => {
    await expect(evaluateUltraRareTriggers(999999999)).rejects.toThrow();
  });

  it('returns array (empty) for horse with no qualifying conditions', async () => {
    const result = await evaluateUltraRareTriggers(horse.id);
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('evaluateExoticUnlocks', () => {
  it('throws for non-existent horse', async () => {
    await expect(evaluateExoticUnlocks(999999999)).rejects.toThrow();
  });

  it('returns array (empty) for horse with no qualifying conditions', async () => {
    const result = await evaluateExoticUnlocks(horse.id);
    expect(Array.isArray(result)).toBe(true);
  });
});

// ── traitDiscovery ────────────────────────────────────────────────────────────

describe('revealTraits', () => {
  it('throws for non-existent horse', async () => {
    await expect(revealTraits(999999999)).rejects.toThrow();
  });

  it('returns success:true with empty revealed array for horse with no hidden traits', async () => {
    const result = await revealTraits(horse.id);
    expect(result.success).toBe(true);
    expect(result.horseId).toBe(horse.id);
    expect(Array.isArray(result.revealed)).toBe(true);
    expect(typeof result.message).toBe('string');
  });
});

describe('batchRevealTraits', () => {
  it('returns array of results for a batch containing one horse', async () => {
    const results = await batchRevealTraits([horse.id]);
    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
  });

  it('returns empty array for empty input', async () => {
    const results = await batchRevealTraits([]);
    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(0);
  });
});

describe('getDiscoveryProgress', () => {
  it('throws for non-existent horse', async () => {
    await expect(getDiscoveryProgress(999999999)).rejects.toThrow();
  });

  it('returns progress shape for horse with no traits', async () => {
    const result = await getDiscoveryProgress(horse.id);
    expect(result.horseId).toBe(horse.id);
    expect(typeof result.progressPercentage).toBe('number');
    expect(typeof result.hiddenTraitsCount).toBe('number');
    expect(typeof result.visibleTraitsCount).toBe('number');
    expect(Array.isArray(result.conditions)).toBe(true);
  });
});

// ── evaluateUltraRareTriggers — Phoenix-Born triggered via high stressLevel ───
//
// evaluatePhoenixBornConditions: `(stressEvents >= 1 || hasHighStress) && recoveries >= 0`
// recoveries >= 0 is always true; hasHighStress = stressLevel > 50.
// A horse with stressLevel: 51 triggers Phoenix-Born, covering lines 34-37
// (logger.info + triggeredTraits.push branch) in evaluateUltraRareTriggers.

let highStressUser;
let highStressHorse;

beforeAll(async () => {
  highStressUser = await prisma.user.create({
    data: {
      email: `ultratrait-hs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `ultratraiths${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'HighStress',
      lastName: 'Tester',
      money: 1000,
    },
  });
  highStressHorse = await prisma.horse.create({
    data: {
      name: `TestFixture-HighStressHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: highStressUser.id,
      stressLevel: 51,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.horse.delete({ where: { id: highStressHorse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: highStressUser.id } }).catch(() => {});
}, 30000);

describe('evaluateUltraRareTriggers — high-stress horse triggers Phoenix-Born (lines 34-37)', () => {
  it('returns at least one triggered ultra-rare trait for stressLevel:51 horse', async () => {
    const result = await evaluateUltraRareTriggers(highStressHorse.id);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].tier).toBe('ultra-rare');
    expect(result[0].name).toBe('Phoenix-Born');
  });
});
