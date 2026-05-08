/**
 * personalityEvolutionSystem service unit tests (Equoria-rr7 coverage sprint).
 *
 * All 7 exported async functions tested with real DB fixtures.
 * Newborn foal (age 0 < minimumAge 1) and fresh groom (0 experience)
 * exercise the not-eligible / zero-interaction code paths.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  evolveGroomPersonality,
  evolveHorseTemperament,
  calculatePersonalityEvolutionTriggers,
  analyzePersonalityStability,
  predictPersonalityEvolution,
  getPersonalityEvolutionHistory,
  applyPersonalityEvolutionEffects,
} from '../../services/personalityEvolutionSystem.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

let user;
let horse;
let groom;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `persevol-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `persevol${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'PersEvol',
      lastName: 'Tester',
      money: 1000,
    },
  });

  horse = await prisma.horse.create({
    data: {
      name: `TestFixture-PersEvolHorse-${Date.now()}`,
      sex: 'Filly',
      dateOfBirth: new Date(),
      age: 0,
      userId: user.id,
    },
  });

  groom = await prisma.groom.create({
    data: {
      name: `TestFixture-PersEvolGroom-${Date.now()}`,
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

// ── evolveGroomPersonality ────────────────────────────────────────────────────

describe('evolveGroomPersonality', () => {
  it('throws for non-existent groom', async () => {
    await expect(evolveGroomPersonality(999999999)).rejects.toThrow();
  });

  it('returns not-evolved for fresh groom with no experience', async () => {
    const result = await evolveGroomPersonality(groom.id);
    expect(result.success).toBe(true);
    expect(result.personalityEvolved).toBe(false);
    expect(typeof result.reason).toBe('string');
  });
});

// ── evolveHorseTemperament ────────────────────────────────────────────────────

describe('evolveHorseTemperament', () => {
  it('throws for non-existent horse', async () => {
    await expect(evolveHorseTemperament(999999999)).rejects.toThrow();
  });

  it('returns not-evolved for newborn foal (age 0 < minimum 1)', async () => {
    const result = await evolveHorseTemperament(horse.id);
    expect(result.success).toBe(true);
    expect(result.temperamentEvolved).toBe(false);
    expect(typeof result.reason).toBe('string');
  });
});

// ── calculatePersonalityEvolutionTriggers ─────────────────────────────────────

describe('calculatePersonalityEvolutionTriggers', () => {
  it('throws for non-existent groom', async () => {
    await expect(calculatePersonalityEvolutionTriggers(999999999, 'groom')).rejects.toThrow();
  });

  it('returns trigger analysis for valid groom', async () => {
    const result = await calculatePersonalityEvolutionTriggers(groom.id, 'groom');
    expect(result.success).toBe(true);
    expect(typeof result.triggers).toBe('object');
    expect(typeof result.evolutionReadiness).toBe('number');
    expect(Array.isArray(result.recommendedActions)).toBe(true);
  });

  it('returns trigger analysis for valid horse', async () => {
    const result = await calculatePersonalityEvolutionTriggers(horse.id, 'horse');
    expect(result.success).toBe(true);
    expect(typeof result.triggers).toBe('object');
    expect(typeof result.evolutionReadiness).toBe('number');
  });
});

// ── analyzePersonalityStability ───────────────────────────────────────────────

describe('analyzePersonalityStability', () => {
  it('returns stability analysis for groom', async () => {
    const result = await analyzePersonalityStability(groom.id, 'groom');
    expect(result.success).toBe(true);
    expect(typeof result.stabilityScore).toBe('number');
    expect(typeof result.stabilityFactors).toBe('object');
    expect(typeof result.evolutionRisk).toBe('number');
    expect(Array.isArray(result.recommendedActions)).toBe(true);
  });

  it('returns stability analysis for horse', async () => {
    const result = await analyzePersonalityStability(horse.id, 'horse');
    expect(result.success).toBe(true);
    expect(typeof result.stabilityScore).toBe('number');
  });
});

// ── predictPersonalityEvolution ───────────────────────────────────────────────

describe('predictPersonalityEvolution', () => {
  it('returns predictions for groom over 30 days', async () => {
    const result = await predictPersonalityEvolution(groom.id, 'groom', 30);
    expect(result.success).toBe(true);
    expect(Array.isArray(result.predictions)).toBe(true);
    expect(Array.isArray(result.recommendedActions)).toBe(true);
  });

  it('returns predictions for horse over 30 days', async () => {
    const result = await predictPersonalityEvolution(horse.id, 'horse', 30);
    expect(result.success).toBe(true);
    expect(Array.isArray(result.predictions)).toBe(true);
  });
});

// ── getPersonalityEvolutionHistory ────────────────────────────────────────────

describe('getPersonalityEvolutionHistory', () => {
  it('returns history shape for groom (empty — no log table yet)', async () => {
    const result = await getPersonalityEvolutionHistory(groom.id, 'groom');
    expect(result.success).toBe(true);
    expect(Array.isArray(result.evolutionEvents)).toBe(true);
    expect(typeof result.totalEvolutions).toBe('number');
    expect(result.totalEvolutions).toBe(0);
  });

  it('returns history shape for horse', async () => {
    const result = await getPersonalityEvolutionHistory(horse.id, 'horse');
    expect(result.success).toBe(true);
    expect(Array.isArray(result.evolutionEvents)).toBe(true);
  });
});

// ── applyPersonalityEvolutionEffects ──────────────────────────────────────────

describe('applyPersonalityEvolutionEffects', () => {
  it('returns effects result for valid evolution data', async () => {
    const evolutionData = {
      entityId: groom.id,
      entityType: 'groom',
      evolutionType: 'trait_strengthening',
      newTraits: ['enhanced_patience'],
      oldPersonality: 'gentle',
      newPersonality: 'gentle',
      stabilityPeriod: 14,
      effectStrength: 0.5,
    };
    const result = await applyPersonalityEvolutionEffects(evolutionData);
    expect(result.success).toBe(true);
    expect(Array.isArray(result.effectsApplied)).toBe(true);
    expect(result.effectsApplied.length).toBeGreaterThan(0);
    expect(result.personalityUpdated).toBe(true);
    expect(result.evolutionLogged).toBe(true);
  });
});
