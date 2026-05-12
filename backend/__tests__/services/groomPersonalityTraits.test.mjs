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

// ── groomPersonalityTraits — branch coverage (Equoria-jkht) ──────────────────────
// Covers: analyzePersonalityCompatibility low/excellent/moderate + fearful/reactive
//         sub-branches; calculatePersonalityModifiers negative/neutral/task-type
//         paths; calculateExperienceLevel medium/high/expert; getCompatibilityLevel
//         all 5 thresholds; calculateOverallCompatibility stress modifier branches.

describe('groomPersonalityTraits — branch coverage (Equoria-jkht)', () => {
  let gpUser;
  let gpEnergeticGroom;
  let gpCalmGroomExpert;
  let gpCalmGroomMedium;
  let gpCalmGroomHigh;
  let gpHorseFearfulReactive;
  let gpHorseCompatible;
  let gpHorseNeutral;
  let gpHorseHighStress;
  let gpHorseBrave;

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    gpUser = await prisma.user.create({
      data: {
        email: `gp-branch-${ts}-${rand()}@test.com`,
        username: `gpbranch${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'GP',
        lastName: 'Branch',
        money: 1000,
      },
    });

    [gpEnergeticGroom, gpCalmGroomExpert, gpCalmGroomMedium, gpCalmGroomHigh] = await Promise.all([
      prisma.groom.create({
        data: {
          name: `TestFixture-GP-EnergeticGroom-${ts}`,
          speciality: 'foal_care',
          personality: 'energetic',
          epigeneticInfluenceType: 'energetic',
          userId: gpUser.id,
        },
      }),
      prisma.groom.create({
        data: {
          name: `TestFixture-GP-CalmExpert-${ts}`,
          speciality: 'foal_care',
          personality: 'calm',
          epigeneticInfluenceType: 'calm',
          experience: 250,
          userId: gpUser.id,
        },
      }),
      prisma.groom.create({
        data: {
          name: `TestFixture-GP-CalmMedium-${ts}`,
          speciality: 'foal_care',
          personality: 'calm',
          epigeneticInfluenceType: 'calm',
          experience: 75,
          userId: gpUser.id,
        },
      }),
      prisma.groom.create({
        data: {
          name: `TestFixture-GP-CalmHigh-${ts}`,
          speciality: 'foal_care',
          personality: 'calm',
          epigeneticInfluenceType: 'calm',
          experience: 150,
          userId: gpUser.id,
        },
      }),
    ]);

    [gpHorseFearfulReactive, gpHorseCompatible, gpHorseNeutral, gpHorseHighStress, gpHorseBrave] = await Promise.all([
      prisma.horse.create({
        data: {
          name: `TestFixture-GP-HorseFearfulReactive-${ts}`,
          sex: 'Filly',
          dateOfBirth: new Date(),
          age: 0,
          userId: gpUser.id,
          epigeneticFlags: ['fearful', 'reactive'],
        },
      }),
      prisma.horse.create({
        data: {
          name: `TestFixture-GP-HorseCompatible-${ts}`,
          sex: 'Colt',
          dateOfBirth: new Date(),
          age: 0,
          userId: gpUser.id,
          epigeneticFlags: ['fearful', 'insecure', 'reactive', 'fragile'],
        },
      }),
      prisma.horse.create({
        data: {
          name: `TestFixture-GP-HorseNeutral-${ts}`,
          sex: 'Filly',
          dateOfBirth: new Date(),
          age: 0,
          userId: gpUser.id,
          epigeneticFlags: ['reactive'],
        },
      }),
      prisma.horse.create({
        data: {
          name: `TestFixture-GP-HorseHighStress-${ts}`,
          sex: 'Colt',
          dateOfBirth: new Date(),
          age: 0,
          userId: gpUser.id,
          epigeneticFlags: ['fearful', 'insecure'],
          stressLevel: 8,
        },
      }),
      prisma.horse.create({
        data: {
          name: `TestFixture-GP-HorseBrave-${ts}`,
          sex: 'Filly',
          dateOfBirth: new Date(),
          age: 0,
          userId: gpUser.id,
          epigeneticFlags: ['brave', 'confident'],
        },
      }),
    ]);
  }, 60000);

  afterAll(async () => {
    await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-GP-' } } }).catch(() => {});
    await prisma.groom.deleteMany({ where: { name: { startsWith: 'TestFixture-GP-' } } }).catch(() => {});
    await prisma.user.delete({ where: { id: gpUser.id } }).catch(() => {});
  }, 30000);

  // ── analyzePersonalityCompatibility — overallScore < 0.4 ──────────────────────
  it('overallScore < 0.4: low recommendations + fearful and reactive sub-branches', async () => {
    const result = await analyzePersonalityCompatibility(gpEnergeticGroom.id, gpHorseFearfulReactive.id);
    expect(result.overallScore).toBeLessThan(0.4);
    expect(result.recommendations.some(r => r.includes('different groom personality'))).toBe(true);
    expect(result.recommendations.some(r => r.includes('calm, patient groom'))).toBe(true);
    expect(result.recommendations.some(r => r.includes('Avoid energetic'))).toBe(true);
  });

  // ── analyzePersonalityCompatibility — overallScore > 0.7 ──────────────────────
  it('overallScore > 0.7: excellent compatibility recommendations', async () => {
    const result = await analyzePersonalityCompatibility(gpCalmGroomExpert.id, gpHorseCompatible.id);
    expect(result.overallScore).toBeGreaterThan(0.7);
    expect(result.recommendations.some(r => r.includes('Excellent compatibility'))).toBe(true);
  });

  // ── analyzePersonalityCompatibility — moderate (else) branch ──────────────────
  it('overallScore 0.4–0.7: moderate compatibility recommendations', async () => {
    // energetic groom + horse with 'reactive' only → all trait compatibilities = 0 → overallScore ≈ 0.5
    const result = await analyzePersonalityCompatibility(gpEnergeticGroom.id, gpHorseNeutral.id);
    expect(result.overallScore).toBeGreaterThanOrEqual(0.4);
    expect(result.overallScore).toBeLessThanOrEqual(0.7);
    expect(result.recommendations.some(r => r.includes('Moderate compatibility'))).toBe(true);
  });

  // ── calculatePersonalityModifiers — negative compatibility ────────────────────
  it('negative compatibility path: incompatible traits reduce bondingModifier below 1', async () => {
    // energetic groom + fearful horse: enthusiastic+stimulating are incompatibleWith fearful → bondingModifier *= 0.8 twice
    const result = await calculatePersonalityModifiers(gpEnergeticGroom.id, gpHorseFearfulReactive.id, 'grooming');
    expect(result.bondingModifier).toBeLessThan(1.0);
    expect(result.stressModifier).toBeGreaterThan(1.0);
  });

  // ── calculatePersonalityModifiers — neutral compatibility ─────────────────────
  it('neutral compatibility path: all-zero compatibility applies taskEffectiveness *= 1.05 per trait', async () => {
    // energetic groom + horse with 'reactive' only: no matches in any compatible/incompatible list → all neutral
    const result = await calculatePersonalityModifiers(gpEnergeticGroom.id, gpHorseNeutral.id, 'grooming');
    expect(result.taskEffectiveness).toBeGreaterThan(1.0);
  });

  // ── calculatePersonalityModifiers — trust_building task branch ────────────────
  it('trust_building task: gentle trait trustBuilding effect applied when compatible', async () => {
    // outer calm groom + fearful horse → gentle trait has trustBuilding:1.4 and is compatibleWith fearful
    const result = await calculatePersonalityModifiers(groom.id, gpHorseFearfulReactive.id, 'trust_building');
    expect(result.taskEffectiveness).toBeGreaterThan(1.0);
  });

  // ── calculatePersonalityModifiers — desensitization task branch ───────────────
  it('desensitization task: enthusiastic stimulationBonus applied when compatible with brave horse', async () => {
    // energetic groom + brave horse → enthusiastic is compatibleWith brave and has stimulationBonus
    const result = await calculatePersonalityModifiers(gpEnergeticGroom.id, gpHorseBrave.id, 'desensitization');
    expect(result.taskEffectiveness).toBeGreaterThan(1.0);
  });

  // ── calculateExperienceLevel — medium / high / expert branches ────────────────
  it('experience=75 → experienceLevel is medium', async () => {
    const traits = await getGroomPersonalityTraits(gpCalmGroomMedium.id);
    expect(traits.experienceLevel).toBe('medium');
  });

  it('experience=150 → experienceLevel is high', async () => {
    const traits = await getGroomPersonalityTraits(gpCalmGroomHigh.id);
    expect(traits.experienceLevel).toBe('high');
  });

  it('experience=250 → experienceLevel is expert', async () => {
    const traits = await getGroomPersonalityTraits(gpCalmGroomExpert.id);
    expect(traits.experienceLevel).toBe('expert');
  });

  // ── getCompatibilityLevel — 5 threshold branches ──────────────────────────────
  it("compatibilityLevel is 'poor' for energetic groom + fearful+reactive horse (score ≈ 0.3)", async () => {
    const result = await analyzePersonalityCompatibility(gpEnergeticGroom.id, gpHorseFearfulReactive.id);
    expect(result.compatibilityLevel).toBe('poor');
  });

  it("compatibilityLevel is 'excellent' for calm expert groom + fully compatible horse (score ≈ 1.0)", async () => {
    const result = await analyzePersonalityCompatibility(gpCalmGroomExpert.id, gpHorseCompatible.id);
    expect(result.compatibilityLevel).toBe('excellent');
  });

  it("compatibilityLevel is 'very_poor' and energetic stress penalty applied for high-stress fearful horse", async () => {
    // energetic + stressLevel=8 fearful+insecure horse: stressModifier=0.7 penalty pushes score below 0.2
    const result = await analyzePersonalityCompatibility(gpEnergeticGroom.id, gpHorseHighStress.id);
    expect(result.overallScore).toBeLessThan(0.2);
    expect(result.compatibilityLevel).toBe('very_poor');
  });

  it('calm groom stress bonus applied: calm + high-stress horse scores higher than without bonus', async () => {
    // calm expert + stressLevel=8 fearful+insecure horse: stressModifier=1.2 bonus
    const result = await analyzePersonalityCompatibility(gpCalmGroomExpert.id, gpHorseHighStress.id);
    expect(result.overallScore).toBeGreaterThan(0.7);
    expect(result.compatibilityLevel).toBe('excellent');
  });
});
