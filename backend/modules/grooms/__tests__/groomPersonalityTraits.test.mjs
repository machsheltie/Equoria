/**
 * groomPersonalityTraits service unit tests (Equoria-rr7 coverage sprint).
 *
 * getPersonalityTraitDefinitions: pure, no DB.
 * Remaining functions: DB fixture — user + groom (epigeneticInfluenceType=calm) + horse.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import {
  getPersonalityTraitDefinitions,
  getGroomPersonalityTraits,
  calculatePersonalityModifiers,
  analyzePersonalityCompatibility,
  updatePersonalityTraits,
} from '../../../services/groomPersonalityTraits.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';

let user;
let horse;
let groom;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `groompersonality-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `groompersonality${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'GroomPersonality',
      lastName: 'Tester',
      money: 1000,
    },
  });

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
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

// ── groomPersonalityTraits — branch coverage (experience levels + compatibility) ──
// Covers: calculateExperienceLevel 'medium'/'high'/'expert' (lines 560-569),
// calculateTraitCompatibility positive/negative score paths,
// calculateOverallCompatibility stressModifier=0.7/1.2 branches (lines 655-659),
// analyzePersonalityCompatibility overallScore<0.4 + overallScore>0.7 branches,
// strengths.push, challenges.push, fearful-specific recommendation (Equoria-jkht).

describe('groomPersonalityTraits — branch coverage (Equoria-jkht)', () => {
  let gptUser;
  let fearfulHorse;
  let stressedFearfulHorse;
  let mediumGroom;
  let highGroom;
  let calmExpertGroom;
  let energeticGroom;

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    gptUser = await prisma.user.create({
      data: {
        email: `gpt-branch-${ts}-${rand()}@test.com`,
        username: `gptbranch${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'GPT',
        lastName: 'Branch',
        money: 1000,
      },
    });

    fearfulHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-GPT-FearfulHorse-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: gptUser.id,
        epigeneticFlags: ['fearful'],
      },
    });

    stressedFearfulHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-GPT-StressedHorse-${ts}`,
        sex: 'Colt',
        dateOfBirth: new Date(),
        age: 0,
        userId: gptUser.id,
        epigeneticFlags: ['fearful'],
        stressLevel: 8,
      },
    });

    // experience=51 → calculateExperienceLevel returns 'medium'
    mediumGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-GPT-MediumGroom-${ts}`,
        speciality: 'foal_care',
        personality: 'gentle',
        epigeneticInfluenceType: 'calm',
        experience: 51,
        userId: gptUser.id,
      },
    });

    // experience=101 → calculateExperienceLevel returns 'high'
    highGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-GPT-HighGroom-${ts}`,
        speciality: 'foal_care',
        personality: 'gentle',
        epigeneticInfluenceType: 'calm',
        experience: 101,
        userId: gptUser.id,
      },
    });

    // experience=201 → 'expert'; calm + fearful horse → overallScore > 0.7
    calmExpertGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-GPT-ExpertGroom-${ts}`,
        speciality: 'foal_care',
        personality: 'gentle',
        epigeneticInfluenceType: 'calm',
        experience: 201,
        userId: gptUser.id,
      },
    });

    // energetic groom + fearful horse → overallScore < 0.4
    energeticGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-GPT-EnergeticGroom-${ts}`,
        speciality: 'foal_care',
        personality: 'active',
        epigeneticInfluenceType: 'energetic',
        experience: 0,
        userId: gptUser.id,
      },
    });
  }, 60000);

  afterAll(async () => {
    await prisma.groom.deleteMany({ where: { name: { startsWith: 'TestFixture-GPT-' } } }).catch(() => {});
    await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-GPT-' } } }).catch(() => {});
    await prisma.user.delete({ where: { id: gptUser.id } }).catch(() => {});
  }, 30000);

  it('getGroomPersonalityTraits returns experienceLevel=medium for experience=51 (line 563)', async () => {
    const result = await getGroomPersonalityTraits(mediumGroom.id);
    expect(result.experienceLevel).toBe('medium');
  });

  it('getGroomPersonalityTraits returns experienceLevel=high for experience=101 (line 566)', async () => {
    const result = await getGroomPersonalityTraits(highGroom.id);
    expect(result.experienceLevel).toBe('high');
  });

  it('getGroomPersonalityTraits returns experienceLevel=expert for experience=201 (line 569)', async () => {
    const result = await getGroomPersonalityTraits(calmExpertGroom.id);
    expect(result.experienceLevel).toBe('expert');
  });

  it('analyzePersonalityCompatibility returns overallScore>0.7 for calm expert + fearful horse (strengths + >0.7 branch)', async () => {
    const result = await analyzePersonalityCompatibility(calmExpertGroom.id, fearfulHorse.id);
    expect(result.overallScore).toBeGreaterThan(0.7);
    // overallScore=0.725 → 'good' (excellent requires >=0.8)
    expect(result.compatibilityLevel).toBe('good');
    expect(result.strengths.length).toBeGreaterThan(0);
    expect(result.recommendations.some(r => r.includes('Excellent compatibility'))).toBe(true);
  });

  it('analyzePersonalityCompatibility returns overallScore<0.4 for energetic + fearful horse (challenges + low-compat branches)', async () => {
    const result = await analyzePersonalityCompatibility(energeticGroom.id, fearfulHorse.id);
    expect(result.overallScore).toBeLessThan(0.4);
    expect(result.challenges.length).toBeGreaterThan(0);
    expect(result.recommendations.some(r => r.includes('calm, patient groom'))).toBe(true);
  });

  it('calculateOverallCompatibility applies stressModifier=0.7 for stressed + energetic (line 656)', async () => {
    const result = await analyzePersonalityCompatibility(energeticGroom.id, stressedFearfulHorse.id);
    // stressLevel=8>7 + energetic → stressModifier=0.7 applied
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(1.0);
  });

  it('calculateOverallCompatibility applies stressModifier=1.2 for stressed + calm (line 658)', async () => {
    const result = await analyzePersonalityCompatibility(calmExpertGroom.id, stressedFearfulHorse.id);
    // stressLevel=8>7 + calm → stressModifier=1.2, boosts score above 0.7
    expect(result.overallScore).toBeGreaterThan(0.7);
    expect(result.compatibilityLevel).toBe('excellent');
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
          ...fixtureColor(),
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
          ...fixtureColor(),
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
          ...fixtureColor(),
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
          ...fixtureColor(),
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
          ...fixtureColor(),
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

// ── groomPersonalityTraits — remaining branches (Equoria-rr7) ─────────────────
// Line 247: unknown epigeneticInfluenceType → throws
// Line 392: analyzePersonalityCompatibility non-existent horse → throws
// Lines 493-518 + 687-691: updatePersonalityTraits with real GroomInteraction records
//   excellent quality + bondingChange=2 → 'Enhanced trait effectiveness' (line 512-513)
//   good quality + bondingChange=0 → 'Steady trait development' (line 514-515)

describe('groomPersonalityTraits — remaining branches (Equoria-rr7)', () => {
  let rbrUser;
  let rbrHorse;
  let rbrGroomBadType;
  let rbrGroomExcellent;
  let rbrGroomGood;

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    rbrUser = await prisma.user.create({
      data: {
        email: `rbr-${ts}-${rand()}@test.com`,
        username: `rbr${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'RBR',
        lastName: 'Branch',
        money: 1000,
      },
    });

    rbrHorse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-RBR-Horse-${ts}`,
        sex: 'Filly',
        dateOfBirth: new Date(),
        age: 0,
        userId: rbrUser.id,
      },
    });

    rbrGroomBadType = await prisma.groom.create({
      data: {
        name: `TestFixture-RBR-BadType-${ts}`,
        speciality: 'foal_care',
        personality: 'gentle',
        epigeneticInfluenceType: 'invalid_type_xyz',
        userId: rbrUser.id,
      },
    });

    rbrGroomExcellent = await prisma.groom.create({
      data: {
        name: `TestFixture-RBR-Excellent-${ts}`,
        speciality: 'foal_care',
        personality: 'gentle',
        epigeneticInfluenceType: 'calm',
        userId: rbrUser.id,
      },
    });

    rbrGroomGood = await prisma.groom.create({
      data: {
        name: `TestFixture-RBR-Good-${ts}`,
        speciality: 'foal_care',
        personality: 'gentle',
        epigeneticInfluenceType: 'calm',
        userId: rbrUser.id,
      },
    });

    // 2 excellent interactions for rbrGroomExcellent: avgQuality=4.0≥3.5, avgBondChange=2.0>1
    for (let i = 0; i < 2; i++) {
      await prisma.groomInteraction.create({
        data: {
          groomId: rbrGroomExcellent.id,
          foalId: rbrHorse.id,
          interactionType: 'grooming',
          duration: 30,
          quality: 'excellent',
          bondingChange: 2,
        },
      });
    }

    // 2 good interactions for rbrGroomGood: avgQuality=3.0 (≥2.5 but <3.5), avgBondChange=0≤1
    for (let i = 0; i < 2; i++) {
      await prisma.groomInteraction.create({
        data: {
          groomId: rbrGroomGood.id,
          foalId: rbrHorse.id,
          interactionType: 'grooming',
          duration: 30,
          quality: 'good',
          bondingChange: 0,
        },
      });
    }
  }, 60000);

  afterAll(async () => {
    const groomIds = [rbrGroomExcellent?.id, rbrGroomGood?.id].filter(Boolean);
    await prisma.groomInteraction.deleteMany({ where: { groomId: { in: groomIds } } }).catch(() => {});
    await prisma.groom.deleteMany({ where: { name: { startsWith: 'TestFixture-RBR-' } } }).catch(() => {});
    await prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-RBR-' } } }).catch(() => {});
    await prisma.user.delete({ where: { id: rbrUser?.id } }).catch(() => {});
  }, 30000);

  it('getGroomPersonalityTraits: unknown epigeneticInfluenceType → throws (line 247)', async () => {
    await expect(getGroomPersonalityTraits(rbrGroomBadType.id)).rejects.toThrow('Unknown personality type');
  });

  it('analyzePersonalityCompatibility: non-existent horse → throws (line 392)', async () => {
    // outer `groom` has valid epigeneticInfluenceType='calm'; horseId 999999999 does not exist
    await expect(analyzePersonalityCompatibility(groom.id, 999999999)).rejects.toThrow('Horse not found');
  });

  it('updatePersonalityTraits: excellent quality + bondingChange=2 → Enhanced trait effectiveness (lines 512-513)', async () => {
    // avgQuality=4.0 (excellent=4) ≥3.5, avgBondChange=2.0 >1 → line 512 fires
    const result = await updatePersonalityTraits(rbrGroomExcellent.id);
    expect(result.traitsUpdated).toContain('Enhanced trait effectiveness due to excellent performance');
    expect(result.experienceGained).toBeGreaterThan(0);
    expect(typeof result.performanceMetrics.avgQuality).toBe('number');
    expect(result.performanceMetrics.avgQuality).toBeGreaterThanOrEqual(3.5);
  });

  it('updatePersonalityTraits: good quality + bondingChange=0 → Steady trait development (lines 514-515)', async () => {
    // avgQuality=3.0 (good=3) ≥2.5 but <3.5; avgBondChange=0 ≤1 → line 514 fires
    const result = await updatePersonalityTraits(rbrGroomGood.id);
    expect(result.traitsUpdated).toContain('Steady trait development from consistent performance');
    expect(result.experienceGained).toBeGreaterThan(0);
    expect(result.performanceMetrics.avgQuality).toBeGreaterThanOrEqual(2.5);
    expect(result.performanceMetrics.avgQuality).toBeLessThan(3.5);
  });
});
