/**
 * traitInteractionMatrix service unit tests (Equoria-rr7 coverage sprint).
 *
 * All 8 exported async functions tested with real DB fixtures.
 * Horse with no flags exercises the zero-data code paths.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import {
  analyzeTraitInteractions,
  calculateTraitSynergies,
  identifyTraitConflicts,
  evaluateTraitDominance,
  processComplexInteractions,
  assessInteractionStability,
  modelTemporalInteractions,
  generateInteractionMatrix,
} from '../../../services/traitInteractionMatrix.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';

let user;
let horse;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `traitmatrix-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `traitmatrix${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
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

// ── traitInteractionMatrix — with-flags branch coverage (Equoria-jkht) ───────
// Two fixture horses exercise the non-empty-traits code paths:
//   tiSynergyHorse: ['brave','confident','fearful'] + stressLevel=2, bondScore=50
//     → brave+confident synergy (confidence_cluster), fearful+brave/confident conflicts
//   tiConflictHorse: ['fearful','brave','reactive','calm','social','antisocial'] + stressLevel=8
//     → 3 conflicts (> 2), high stress (> 7), has 'reactive' trait

describe('traitInteractionMatrix — with-flags branch coverage (Equoria-jkht)', () => {
  let tiUser;
  let tiSynergyHorse;
  let tiConflictHorse;

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    tiUser = await prisma.user.create({
      data: {
        email: `tim-${ts}-${rand()}@test.com`,
        username: `tim${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'TIM',
        lastName: 'Tester',
        money: 1000,
      },
    });

    tiSynergyHorse = await prisma.horse.create({
      data: {
        name: `TestFixture-TIM-Synergy-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: tiUser.id,
        stressLevel: 2,
        bondScore: 50,
        epigeneticFlags: ['brave', 'confident', 'fearful'],
      },
    });

    tiConflictHorse = await prisma.horse.create({
      data: {
        name: `TestFixture-TIM-Conflict-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: tiUser.id,
        stressLevel: 8,
        bondScore: 10,
        epigeneticFlags: ['fearful', 'brave', 'reactive', 'calm', 'social', 'antisocial'],
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-TIM-' } } }).catch(() => {});
    await prisma.user.delete({ where: { id: tiUser.id } }).catch(() => {});
  }, 30000);

  it('analyzeTraitInteractions returns non-empty synergies+conflicts for horse with mixed flags (non-zero traits branch)', async () => {
    const result = await analyzeTraitInteractions(tiSynergyHorse.id);
    expect(result.traits).toHaveLength(3);
    expect(result.synergies.length).toBeGreaterThan(0);
    expect(result.conflicts.length).toBeGreaterThan(0);
    expect(result.interactionStrength).toBeGreaterThan(0);
    expect(typeof result.overallHarmony).toBe('number');
  });

  it('calculateTraitSynergies populates amplificationEffects for synergy-forming flags', async () => {
    const result = await calculateTraitSynergies(tiSynergyHorse.id);
    expect(result.synergyPairs.length).toBeGreaterThan(0);
    expect(Object.keys(result.amplificationEffects).length).toBeGreaterThan(0);
    expect(result.totalSynergyStrength).toBeGreaterThan(0);
    // Verify second-trait path: brave should appear in amplificationEffects
    expect(result.amplificationEffects['brave']).toBeDefined();
    expect(result.amplificationEffects['confident']).toBeDefined();
  });

  it('identifyTraitConflicts populates suppressionEffects for conflict-forming flags', async () => {
    const result = await identifyTraitConflicts(tiSynergyHorse.id);
    expect(result.conflictPairs.length).toBeGreaterThan(0);
    expect(Object.keys(result.suppressionEffects).length).toBeGreaterThan(0);
    expect(result.totalConflictStrength).toBeGreaterThan(0);
    expect(result.suppressionEffects['fearful']).toBeDefined();
    expect(result.suppressionEffects['brave']).toBeDefined();
  });

  it('assessInteractionStability adds trait_synergies/low_stress/strong_bonding stabilityFactors', async () => {
    const result = await assessInteractionStability(tiSynergyHorse.id);
    expect(result.stabilityFactors).toContain('trait_synergies');
    expect(result.stabilityFactors).toContain('low_stress');
    expect(result.stabilityFactors).toContain('strong_bonding');
    expect(typeof result.overallStability).toBe('number');
  });

  it('assessInteractionStability adds multiple_trait_conflicts/high_stress/reactive_temperament volatilityRisks', async () => {
    const result = await assessInteractionStability(tiConflictHorse.id);
    expect(result.volatilityRisks).toContain('multiple_trait_conflicts');
    expect(result.volatilityRisks).toContain('high_stress_environment');
    expect(result.volatilityRisks).toContain('reactive_temperament');
  });

  it('evaluateTraitDominance returns sorted dominanceHierarchy with primaryTrait for non-empty flags', async () => {
    const result = await evaluateTraitDominance(tiSynergyHorse.id);
    expect(result.dominanceHierarchy.length).toBe(3);
    expect(result.primaryTrait).not.toBeNull();
    expect(result.dominanceHierarchy[0].dominanceScore).toBeGreaterThanOrEqual(
      result.dominanceHierarchy[result.dominanceHierarchy.length - 1].dominanceScore,
    );
  });
});
