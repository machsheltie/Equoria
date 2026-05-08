/**
 * groomPersonalityTraits service unit tests (Equoria-rr7 coverage sprint).
 *
 * getPersonalityTraitDefinitions: pure, no DB.
 * Remaining functions: DB fixture — user + groom (epigeneticInfluenceType=calm) + horse.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  getPersonalityTraitDefinitions,
  getGroomPersonalityTraits,
  calculatePersonalityModifiers,
  analyzePersonalityCompatibility,
  updatePersonalityTraits,
} from '../../services/groomPersonalityTraits.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

let user;
let horse;
let groom;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `groompersonality-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `groompersonality${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'GroomPersonality',
      lastName: 'Tester',
      money: 1000,
    },
  });

  horse = await prisma.horse.create({
    data: {
      name: `TestFixture-GroomPersonHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    },
  });

  groom = await prisma.groom.create({
    data: {
      name: `TestFixture-GroomPersonGroom-${Date.now()}`,
      speciality: 'foal_care',
      personality: 'gentle',
      epigeneticInfluenceType: 'calm',
      userId: user.id,
    },
  });
}, 30000);

afterAll(async () => {
  await prisma.groom.delete({ where: { id: groom.id } }).catch(() => {});
  await prisma.horse.delete({ where: { id: horse.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}, 30000);

// ── getPersonalityTraitDefinitions ────────────────────────────────────────────

describe('getPersonalityTraitDefinitions', () => {
  it('returns personalities object', async () => {
    const result = await getPersonalityTraitDefinitions();
    expect(result).toBeDefined();
    expect(typeof result.personalities).toBe('object');
    expect(result.personalities).toHaveProperty('calm');
    expect(result.personalities).toHaveProperty('balanced');
  });

  it('returns compatibilityMatrix', async () => {
    const result = await getPersonalityTraitDefinitions();
    expect(result.compatibilityMatrix).toBeDefined();
  });

  it('returns experienceLevels with expected tiers', async () => {
    const result = await getPersonalityTraitDefinitions();
    expect(result.experienceLevels).toBeDefined();
    expect(result.experienceLevels.low).toBeDefined();
    expect(result.experienceLevels.expert).toBeDefined();
  });
});

// ── getGroomPersonalityTraits ─────────────────────────────────────────────────

describe('getGroomPersonalityTraits', () => {
  it('throws for non-existent groom', async () => {
    await expect(getGroomPersonalityTraits(999999999)).rejects.toThrow();
  });

  it('returns trait shape for known groom with calm personality', async () => {
    const result = await getGroomPersonalityTraits(groom.id);

    expect(result).toBeDefined();
    expect(result.groomId).toBe(groom.id);
    expect(result.primaryPersonality).toBe('calm');
    expect(typeof result.experienceLevel).toBe('string');
    expect(typeof result.traitStrength).toBe('number');
    expect(Array.isArray(result.traits)).toBe(true);
    expect(typeof result.personalityDescription).toBe('string');
  });
});

// ── calculatePersonalityModifiers ─────────────────────────────────────────────

describe('calculatePersonalityModifiers', () => {
  it('throws for non-existent groom', async () => {
    await expect(calculatePersonalityModifiers(999999999, horse.id, 'grooming')).rejects.toThrow();
  });

  it('throws for non-existent horse', async () => {
    await expect(calculatePersonalityModifiers(groom.id, 999999999, 'grooming')).rejects.toThrow();
  });

  it('returns modifier shape for valid groom+horse pair', async () => {
    const result = await calculatePersonalityModifiers(groom.id, horse.id, 'grooming');

    expect(result).toBeDefined();
    expect(typeof result.bondingModifier).toBe('number');
    expect(typeof result.stressModifier).toBe('number');
    expect(typeof result.qualityModifier).toBe('number');
    expect(typeof result.taskEffectiveness).toBe('number');
  });
});

// ── analyzePersonalityCompatibility ──────────────────────────────────────────

describe('analyzePersonalityCompatibility', () => {
  it('returns compatibility result for known groom+horse', async () => {
    const result = await analyzePersonalityCompatibility(groom.id, horse.id);

    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('throws for non-existent groom', async () => {
    await expect(analyzePersonalityCompatibility(999999999, horse.id)).rejects.toThrow();
  });
});

// ── updatePersonalityTraits ───────────────────────────────────────────────────

describe('updatePersonalityTraits', () => {
  it('returns updated traits for known groom', async () => {
    const result = await updatePersonalityTraits(groom.id);

    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('throws for non-existent groom', async () => {
    await expect(updatePersonalityTraits(999999999)).rejects.toThrow();
  });
});
