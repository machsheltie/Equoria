/**
 * traitInteractionMatrix service unit tests (Equoria-rr7 coverage sprint).
 *
 * All 8 exported async functions tested with real DB fixtures.
 * Horse with no flags exercises the zero-data code paths.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import {
  analyzeTraitInteractions,
  calculateTraitSynergies,
  identifyTraitConflicts,
  evaluateTraitDominance,
  processComplexInteractions,
  assessInteractionStability,
  modelTemporalInteractions,
  generateInteractionMatrix,
} from '../../services/traitInteractionMatrix.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';

let user;
let horse;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `traitmatrix-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`,
      username: `traitmatrix${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      password: 'irrelevant-hash',
      firstName: 'TraitMatrix',
      lastName: 'Tester',
      money: 1000,
    },
  });

  horse = await prisma.horse.create({
    data: {
      name: `TestFixture-TraitMatrixHorse-${Date.now()}`,
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

// ── analyzeTraitInteractions ──────────────────────────────────────────────────

describe('analyzeTraitInteractions', () => {
  it('throws for non-existent horse', async () => {
    await expect(analyzeTraitInteractions(999999999)).rejects.toThrow();
  });

  it('returns zero-flag analysis for horse with no flags', async () => {
    const result = await analyzeTraitInteractions(horse.id);
    expect(result.horseId).toBe(horse.id);
    expect(result.traits).toHaveLength(0);
    expect(Array.isArray(result.synergies)).toBe(true);
    expect(Array.isArray(result.conflicts)).toBe(true);
    expect(typeof result.overallHarmony).toBe('number');
  });
});

// ── calculateTraitSynergies ───────────────────────────────────────────────────

describe('calculateTraitSynergies', () => {
  it('returns result for horse with no flags', async () => {
    const result = await calculateTraitSynergies(horse.id);
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });
});

// ── identifyTraitConflicts ────────────────────────────────────────────────────

describe('identifyTraitConflicts', () => {
  it('returns result for horse with no flags', async () => {
    const result = await identifyTraitConflicts(horse.id);
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });
});

// ── evaluateTraitDominance ────────────────────────────────────────────────────

describe('evaluateTraitDominance', () => {
  it('returns result for horse with no flags', async () => {
    const result = await evaluateTraitDominance(horse.id);
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });
});

// ── processComplexInteractions ────────────────────────────────────────────────

describe('processComplexInteractions', () => {
  it('returns result for horse with no flags', async () => {
    const result = await processComplexInteractions(horse.id);
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });
});

// ── assessInteractionStability ────────────────────────────────────────────────

describe('assessInteractionStability', () => {
  it('returns result for horse with no flags', async () => {
    const result = await assessInteractionStability(horse.id);
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });
});

// ── modelTemporalInteractions ─────────────────────────────────────────────────

describe('modelTemporalInteractions', () => {
  it('returns result for horse with 30-day window', async () => {
    const result = await modelTemporalInteractions(horse.id, 30);
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });
});

// ── generateInteractionMatrix ─────────────────────────────────────────────────

describe('generateInteractionMatrix', () => {
  it('returns matrix object for horse with no flags', async () => {
    const result = await generateInteractionMatrix(horse.id);
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });
});
