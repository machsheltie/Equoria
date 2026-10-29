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
} from '../services/groomPersonalityTraits.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
// Equoria-w5n8c: serialise arrange-step create burst (jpmza sibling).
import { createSequentially } from '../../../tests/helpers/createSequentially.mjs';
// Equoria-1ohys: fail-loud scoped cleanup. Previously each afterAll swallowed
// its prisma deletes with a silent no-op catch arm, so a delete failure left
// fixtures leaked into the canonical DB while the suite stayed green. The
// tracker runs every scoped delete in FK order and throws loudly if any fail.
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

let user;
let horse;
let groom;
const topCleanup = createCleanupTracker();

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      emailVerified: true,
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
      speciality: 'foalCare',
      personality: 'gentle',
      epigeneticInfluenceType: 'calm',
      userId: user.id,
    },
  });
}, 30000);

// FK order: groom (Groom.userId Restrict) + horse (Horse.userId Restrict) → user.
afterAll(() => {
  topCleanup.add(() => prisma.groom.delete({ where: { id: groom.id } }), 'groom');
  topCleanup.add(() => prisma.horse.delete({ where: { id: horse.id } }), 'horse');
  topCleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
  return topCleanup.run();
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

// ── groomPersonalityTraits — branch coverage (experience levels + compatibility) ──
// Covers: calculateExperienceLevel 'medium'/'high'/'expert' (lines 560-569),
// calculateTraitCompatibility positive/negative score paths,
// analyzePersonalityCompatibility overallScore<0.4 + overallScore>0.7 branches,
// strengths.push, challenges.push, fearful-specific recommendation (Equoria-jkht).

describe('groomPersonalityTraits — branch coverage (Equoria-jkht)', () => {
  let gptUser;
  let fearfulHorse;
  let mediumGroom;
  let highGroom;
  let calmExpertGroom;
  let energeticGroom;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    gptUser = await prisma.user.create({
      data: {
        emailVerified: true,
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
      },
    });

    // experience=51 → calculateExperienceLevel returns 'medium'
    mediumGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-GPT-MediumGroom-${ts}`,
        speciality: 'foalCare',
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
        speciality: 'foalCare',
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
        speciality: 'foalCare',
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
        speciality: 'foalCare',
        personality: 'active',
        epigeneticInfluenceType: 'energetic',
        experience: 0,
        userId: gptUser.id,
      },
    });
  }, 60000);

  // FK order: grooms (Restrict on user) → user. No groom-child
  // rows (synergy/assignment/interaction) are created in this block.
  afterAll(() => {
    cleanup.add(() => prisma.groom.deleteMany({ where: { name: { startsWith: 'TestFixture-GPT-' } } }), 'gptGrooms');
    cleanup.add(() => prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-GPT-' } } }), 'gptHorses');
    cleanup.add(() => prisma.user.delete({ where: { id: gptUser.id } }), 'gptUser');
    return cleanup.run();
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

  // CONTRACT CHANGED BY THE OWNER, 2026-10-29 (q300, Equoria-efs4j): the old
  // epigeneticFlags store is dropped with every reader. Old contract: this horse
  // was fearful, so the calm expert scored > 0.7 (strengths, "Excellent") and the
  // energetic groom < 0.4 (challenges, "calm, patient groom"). New contract: no
  // horse has flags, so both get the no-flag result a flagless horse always got.
  it.each([
    ['calm expert', () => calmExpertGroom],
    ['energetic', () => energeticGroom],
  ])('analyzePersonalityCompatibility gives the %s groom the moderate no-flag match', async (_label, getGroom) => {
    const result = await analyzePersonalityCompatibility(getGroom().id, fearfulHorse.id);
    expect(result.overallScore).toBe(0.6);
    expect(result.compatibilityLevel).toBe('good');
    expect(result.strengths).toEqual([]);
    expect(result.challenges).toEqual([]);
    expect(result.recommendations.some(r => r.includes('Moderate compatibility'))).toBe(true);
    expect(result).not.toHaveProperty('horseFlags');
  });
});

// ── groomPersonalityTraits — branch coverage (Equoria-jkht) ──────────────────────
// Covers: analyzePersonalityCompatibility moderate branch; calculatePersonalityModifiers
//         task-type paths; calculateExperienceLevel medium/high/expert.
// The low/excellent compatibility, fearful/reactive advice, negative/neutral
// modifier paths and the poor/excellent levels were reachable only through horse
// flags and went with the epigeneticFlags store (owner ruling 2026-10-29, q300,
// Equoria-efs4j).

describe('groomPersonalityTraits — branch coverage (Equoria-jkht)', () => {
  let gpUser;
  let gpEnergeticGroom;
  let gpCalmGroomExpert;
  let gpCalmGroomMedium;
  let gpCalmGroomHigh;
  let gpHorseFearfulReactive;
  // The second horse (once fully compatible) has no case left since the flag store went (Equoria-efs4j).
  let gpHorseNeutral;
  let gpHorseBrave;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    gpUser = await prisma.user.create({
      data: {
        emailVerified: true,
        email: `gp-branch-${ts}-${rand()}@test.com`,
        username: `gpbranch${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'GP',
        lastName: 'Branch',
        money: 1000,
      },
    });

    [gpEnergeticGroom, gpCalmGroomExpert, gpCalmGroomMedium, gpCalmGroomHigh] = await createSequentially([
      () =>
        prisma.groom.create({
          data: {
            name: `TestFixture-GP-EnergeticGroom-${ts}`,
            speciality: 'foalCare',
            personality: 'energetic',
            epigeneticInfluenceType: 'energetic',
            userId: gpUser.id,
          },
        }),
      () =>
        prisma.groom.create({
          data: {
            name: `TestFixture-GP-CalmExpert-${ts}`,
            speciality: 'foalCare',
            personality: 'calm',
            epigeneticInfluenceType: 'calm',
            experience: 250,
            userId: gpUser.id,
          },
        }),
      () =>
        prisma.groom.create({
          data: {
            name: `TestFixture-GP-CalmMedium-${ts}`,
            speciality: 'foalCare',
            personality: 'calm',
            epigeneticInfluenceType: 'calm',
            experience: 75,
            userId: gpUser.id,
          },
        }),
      () =>
        prisma.groom.create({
          data: {
            name: `TestFixture-GP-CalmHigh-${ts}`,
            speciality: 'foalCare',
            personality: 'calm',
            epigeneticInfluenceType: 'calm',
            experience: 150,
            userId: gpUser.id,
          },
        }),
    ]);

    [gpHorseFearfulReactive, , gpHorseNeutral, gpHorseBrave] = await createSequentially([
      () =>
        prisma.horse.create({
          data: {
            ...fixtureColor(),
            name: `TestFixture-GP-HorseFearfulReactive-${ts}`,
            sex: 'Filly',
            dateOfBirth: new Date(),
            age: 0,
            userId: gpUser.id,
          },
        }),
      () =>
        prisma.horse.create({
          data: {
            ...fixtureColor(),
            name: `TestFixture-GP-HorseCompatible-${ts}`,
            sex: 'Colt',
            dateOfBirth: new Date(),
            age: 0,
            userId: gpUser.id,
          },
        }),
      () =>
        prisma.horse.create({
          data: {
            ...fixtureColor(),
            name: `TestFixture-GP-HorseNeutral-${ts}`,
            sex: 'Filly',
            dateOfBirth: new Date(),
            age: 0,
            userId: gpUser.id,
          },
        }),
      () =>
        prisma.horse.create({
          data: {
            ...fixtureColor(),
            name: `TestFixture-GP-HorseBrave-${ts}`,
            sex: 'Filly',
            dateOfBirth: new Date(),
            age: 0,
            userId: gpUser.id,
          },
        }),
    ]);
  }, 60000);

  // FK order: horses + grooms (both Restrict on user) → user. No groom-child
  // rows (synergy/assignment/interaction) are created in this block.
  afterAll(() => {
    cleanup.add(() => prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-GP-' } } }), 'gpHorses');
    cleanup.add(() => prisma.groom.deleteMany({ where: { name: { startsWith: 'TestFixture-GP-' } } }), 'gpGrooms');
    cleanup.add(() => prisma.user.delete({ where: { id: gpUser.id } }), 'gpUser');
    return cleanup.run();
  }, 30000);

  // ── analyzePersonalityCompatibility — moderate (else) branch ──────────────────
  it('overallScore 0.4–0.7: moderate compatibility recommendations', async () => {
    // Every pair is 0.6 since the flag store went (Equoria-efs4j): the moderate branch.
    const result = await analyzePersonalityCompatibility(gpEnergeticGroom.id, gpHorseNeutral.id);
    expect(result.overallScore).toBeGreaterThanOrEqual(0.4);
    expect(result.overallScore).toBeLessThanOrEqual(0.7);
    expect(result.recommendations.some(r => r.includes('Moderate compatibility'))).toBe(true);
  });

  // ── calculatePersonalityModifiers — trustBuilding task branch ────────────────
  it('trustBuilding task: gentle trait trustBuilding effect applied', async () => {
    // outer calm groom → gentle trait has trustBuilding:1.4 (neutral compatibility, Equoria-efs4j)
    const result = await calculatePersonalityModifiers(groom.id, gpHorseFearfulReactive.id, 'trustBuilding');
    expect(result.taskEffectiveness).toBeGreaterThan(1.0);
  });

  // ── calculatePersonalityModifiers — desensitization task branch ───────────────
  it('desensitization task: enthusiastic stimulationBonus applied', async () => {
    // energetic groom → enthusiastic has stimulationBonus (neutral compatibility, Equoria-efs4j)
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
});

// ── groomPersonalityTraits — remaining branches (Equoria-rr7) ─────────────────
// Line 247: unknown epigeneticInfluenceType → throws
// Line 392: analyzePersonalityCompatibility non-existent horse → throws

describe('groomPersonalityTraits — remaining branches (Equoria-rr7)', () => {
  let rbrUser;
  let rbrGroomBadType;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    rbrUser = await prisma.user.create({
      data: {
        emailVerified: true,
        email: `rbr-${ts}-${rand()}@test.com`,
        username: `rbr${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'RBR',
        lastName: 'Branch',
        money: 1000,
      },
    });

    rbrGroomBadType = await prisma.groom.create({
      data: {
        name: `TestFixture-RBR-BadType-${ts}`,
        speciality: 'foalCare',
        personality: 'gentle',
        epigeneticInfluenceType: 'invalidTypeXyz',
        userId: rbrUser.id,
      },
    });
  }, 60000);

  // FK order: grooms (Restrict on user) → user. The `?.` guard
  // tolerates a fixture that failed to create (id undefined) without a
  // TypeError, while still deleting what exists.
  afterAll(() => {
    cleanup.add(() => prisma.groom.deleteMany({ where: { name: { startsWith: 'TestFixture-RBR-' } } }), 'rbrGrooms');
    cleanup.add(() => prisma.user.delete({ where: { id: rbrUser?.id } }), 'rbrUser');
    return cleanup.run();
  }, 30000);

  it('getGroomPersonalityTraits: unknown epigeneticInfluenceType → throws (line 247)', async () => {
    await expect(getGroomPersonalityTraits(rbrGroomBadType.id)).rejects.toThrow('Unknown personality type');
  });

  it('analyzePersonalityCompatibility: non-existent horse → throws (line 392)', async () => {
    // outer `groom` has valid epigeneticInfluenceType='calm'; horseId 999999999 does not exist
    await expect(analyzePersonalityCompatibility(groom.id, 999999999)).rejects.toThrow('Horse not found');
  });
});
