/**
 * personalityEvolutionSystem service unit tests (Equoria-rr7 coverage sprint).
 *
 * The exported async functions tested with real DB fixtures (evolveGroomPersonality
 * was removed under Equoria-jy3f7: groom personalities never evolve).
 * Newborn foal (age 0 < minimumAge 1) exercises the not-eligible /
 * zero-interaction code paths.
 *
 * Equoria-j5qui. OLD CONTRACT: calculatePersonalityEvolutionTriggers,
 * analyzePersonalityStability, predictPersonalityEvolution and
 * getPersonalityEvolutionHistory took (entityId, entityType) and analysed a
 * groom's personality evolution for 'groom'. NEW RULING (owner, 2026-10-22):
 * groom personalities never evolve. They take a horse id only; the groom
 * cases are gone and the groom-only timeframe cases run against the horse.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import {
  evolveHorseTemperament,
  calculatePersonalityEvolutionTriggers,
  analyzePersonalityStability,
  predictPersonalityEvolution,
  getPersonalityEvolutionHistory,
  applyPersonalityEvolutionEffects,
} from '../services/personalityEvolutionSystem.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
// Equoria-odjt: spread a CI-proven valid colorGenotype+phenotype so fixture
// horses can never leak as NULL-phenotype rows that trip horseColorNullSentinel.
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
// Equoria-1ohys: fail-loud scoped cleanup. A swallowed cleanup .catch hides a
// leaked fixture in the canonical DB (CLAUDE.md §2); the tracker re-throws so
// the suite goes red at the source. Deletes stay scoped and ordered
// children-before-parents (GroomInteraction onDelete: Cascade; Horse.userId /
// Groom.userId onDelete: Restrict — users last).
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';

let user;
let horse;
let groom;
const moduleCleanup = createCleanupTracker();

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `persevol-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
      username: `persevol${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'PersEvol',
      lastName: 'Tester',
      money: 1000,
    },
  });

  horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
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
      speciality: 'foalCare',
      personality: 'gentle',
      userId: user.id,
    },
  });
  moduleCleanup.add(() => prisma.groom.deleteMany({ where: { id: groom.id } }), 'groom');
  moduleCleanup.add(() => prisma.horse.deleteMany({ where: { id: horse.id } }), 'horse');
  moduleCleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'user');
}, 30000);

afterAll(() => moduleCleanup.run(), 30000);

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
  it('throws for non-existent horse', async () => {
    await expect(calculatePersonalityEvolutionTriggers(999999999)).rejects.toThrow();
  });

  it('returns trigger analysis for valid horse, with no groom specialization factor', async () => {
    const result = await calculatePersonalityEvolutionTriggers(horse.id);
    expect(result.success).toBe(true);
    expect(typeof result.triggers).toBe('object');
    expect(result.triggers).not.toHaveProperty('specialization');
    expect(typeof result.evolutionReadiness).toBe('number');
    expect(Array.isArray(result.recommendedActions)).toBe(true);
  });
});

// ── analyzePersonalityStability ───────────────────────────────────────────────

describe('analyzePersonalityStability', () => {
  it('returns stability analysis for horse', async () => {
    const result = await analyzePersonalityStability(horse.id);
    expect(result.success).toBe(true);
    expect(typeof result.stabilityScore).toBe('number');
    expect(typeof result.stabilityFactors).toBe('object');
    expect(typeof result.evolutionRisk).toBe('number');
    expect(Array.isArray(result.recommendedActions)).toBe(true);
  });
});

// ── predictPersonalityEvolution ───────────────────────────────────────────────

describe('predictPersonalityEvolution', () => {
  it('returns predictions for horse over 30 days', async () => {
    const result = await predictPersonalityEvolution(horse.id, 30);
    expect(result.success).toBe(true);
    expect(Array.isArray(result.predictions)).toBe(true);
    expect(Array.isArray(result.recommendedActions)).toBe(true);
  });
});

// ── getPersonalityEvolutionHistory ────────────────────────────────────────────

describe('getPersonalityEvolutionHistory', () => {
  it('returns history shape for horse (empty — no log table yet)', async () => {
    const result = await getPersonalityEvolutionHistory(horse.id);
    expect(result.success).toBe(true);
    expect(Array.isArray(result.evolutionEvents)).toBe(true);
    expect(typeof result.totalEvolutions).toBe('number');
    expect(result.totalEvolutions).toBe(0);
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

// ── applyPersonalityEvolutionEffects — uncovered if-branches (Equoria-jkht) ────

describe('applyPersonalityEvolutionEffects — uncovered branches (Equoria-jkht)', () => {
  it('effectsApplied includes personality-change string when newPersonality !== oldPersonality', async () => {
    const result = await applyPersonalityEvolutionEffects({
      entityId: 1,
      entityType: 'groom',
      evolutionType: 'personality_shift',
      newTraits: [],
      oldPersonality: 'gentle',
      newPersonality: 'calm',
      stabilityPeriod: 14,
      effectStrength: 0.5,
    });
    expect(result.success).toBe(true);
    const hasChange = result.effectsApplied.some(e => e.includes('Personality changed'));
    expect(hasChange).toBe(true);
  });

  it('effectsApplied has no trait-added entry when newTraits is empty (false branch)', async () => {
    const result = await applyPersonalityEvolutionEffects({
      entityId: 1,
      entityType: 'groom',
      evolutionType: 'personality_shift',
      newTraits: [],
      oldPersonality: 'calm',
      newPersonality: 'calm',
      stabilityPeriod: 14,
      effectStrength: 0.5,
    });
    expect(result.success).toBe(true);
    const hasTraits = result.effectsApplied.some(e => e.includes('Added traits'));
    expect(hasTraits).toBe(false);
  });
});

// ── predictPersonalityEvolution — timeframeDays filter (Equoria-jkht) ─────────

describe('predictPersonalityEvolution — timeframeDays filter (Equoria-jkht)', () => {
  it('returns 1 prediction when timeframeDays=7 (filter keeps only [7])', async () => {
    const result = await predictPersonalityEvolution(horse.id, 7);
    expect(result.success).toBe(true);
    expect(result.predictions).toHaveLength(1);
    expect(result.predictions[0].timeframe).toBe(7);
  });

  it('returns 5 predictions when timeframeDays=90 (all timeframes [7,14,30,60,90] included)', async () => {
    const result = await predictPersonalityEvolution(horse.id, 90);
    expect(result.success).toBe(true);
    expect(result.predictions).toHaveLength(5);
  });
});

// ── evolve path — shouldEvolve=true, insufficient-interaction, determineNewTemperament (Equoria-jkht) ──

describe('personalityEvolutionSystem — evolve path branch coverage (Equoria-jkht)', () => {
  let evUser;
  let evGroom;
  let evHorseNervous;
  let evHorseDeveloping;
  let evGroomForHorses;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    evUser = await prisma.user.create({
      data: {
        email: `pes-ev-${ts}-${rand()}@test.com`,
        username: `pesev${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'PES',
        lastName: 'Evolve',
        money: 1000,
      },
    });

    evGroom = await prisma.groom.create({
      data: {
        name: `TestFixture-PES-GroomEvolves-${ts}`,
        speciality: 'foalCare',
        personality: 'calm',
        userId: evUser.id,
        experience: 100,
      },
    });

    evGroomForHorses = await prisma.groom.create({
      data: {
        name: `TestFixture-PES-GroomForHorses-${ts}`,
        speciality: 'foalCare',
        personality: 'gentle',
        userId: evUser.id,
      },
    });

    evHorseNervous = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-PES-HorseNervous-${ts}`,
        sex: 'Filly',
        dateOfBirth: gameCalendarDate(new Date(ts), -Math.round(2 * 365.25)),
        age: 2,
        userId: evUser.id,
        temperament: 'nervous',
      },
    });

    evHorseDeveloping = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-PES-HorseDeveloping-${ts}`,
        sex: 'Filly',
        dateOfBirth: gameCalendarDate(new Date(ts), -Math.round(2 * 365.25)),
        age: 2,
        userId: evUser.id,
        temperament: 'developing',
      },
    });

    // 15 excellent groomInteractions for evGroom (groom side — groomId=evGroom, foalId=evHorseNervous)
    for (let i = 0; i < 15; i++) {
      await prisma.groomInteraction.create({
        data: {
          foalId: evHorseNervous.id,
          groomId: evGroom.id,
          interactionType: 'daily_care',
          duration: 30,
          bondingChange: 2,
          stressChange: 0,
          quality: 'excellent',
          taskType: 'grooming',
          createdAt: new Date(ts - (15 - i) * 60000),
          timestamp: new Date(ts - (15 - i) * 60000),
        },
      });
    }

    // 10 excellent groomInteractions for evHorseNervous (horse side — foalId=evHorseNervous)
    for (let i = 0; i < 10; i++) {
      await prisma.groomInteraction.create({
        data: {
          foalId: evHorseNervous.id,
          groomId: evGroomForHorses.id,
          interactionType: 'daily_care',
          duration: 30,
          bondingChange: 2,
          stressChange: 0,
          quality: 'excellent',
          taskType: 'grooming',
          createdAt: new Date(ts - (10 - i) * 60000 - 1000000),
          timestamp: new Date(ts - (10 - i) * 60000 - 1000000),
        },
      });
    }

    // 10 excellent groomInteractions for evHorseDeveloping (horse side)
    for (let i = 0; i < 10; i++) {
      await prisma.groomInteraction.create({
        data: {
          foalId: evHorseDeveloping.id,
          groomId: evGroomForHorses.id,
          interactionType: 'daily_care',
          duration: 30,
          bondingChange: 2,
          stressChange: 0,
          quality: 'excellent',
          taskType: 'grooming',
          createdAt: new Date(ts - (10 - i) * 60000 - 2000000),
          timestamp: new Date(ts - (10 - i) * 60000 - 2000000),
        },
      });
    }

    cleanup.add(
      () => prisma.groomInteraction.deleteMany({ where: { groomId: { in: [evGroom.id, evGroomForHorses.id] } } }),
      'ev-interactions',
    );
    cleanup.add(() => prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-PES-' } } }), 'ev-horses');
    cleanup.add(() => prisma.groom.deleteMany({ where: { name: { startsWith: 'TestFixture-PES-' } } }), 'ev-grooms');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: evUser.id } }), 'evUser');
  }, 60000);

  afterAll(() => cleanup.run(), 30000);

  it('evolveHorseTemperament with nervous+age>=1+10 excellent interactions → temperamentEvolved=true, newTemperament=developing (determineNewTemperament branch)', async () => {
    const result = await evolveHorseTemperament(evHorseNervous.id);
    expect(result.success).toBe(true);
    expect(result.temperamentEvolved).toBe(true);
    expect(result.oldTemperament).toBe('nervous');
    expect(result.newTemperament).toBe('developing');
  });

  it('evolveHorseTemperament with developing+age>=1+10 excellent interactions → temperamentEvolved=true, newTemperament=confident', async () => {
    const result = await evolveHorseTemperament(evHorseDeveloping.id);
    expect(result.success).toBe(true);
    expect(result.temperamentEvolved).toBe(true);
    expect(result.oldTemperament).toBe('developing');
    expect(result.newTemperament).toBe('confident');
  });

  it('analyzePersonalityStability for horse with 20 interactions → calculateGroomInfluence >10 branch returns 0.6', async () => {
    const result = await analyzePersonalityStability(evHorseNervous.id);
    expect(result.success).toBe(true);
    expect(result.stabilityFactors.groomInfluence).toBe(0.6);
  });
});

// ── personalityEvolutionSystem — line 136 + line 559 branch coverage ────────────

describe('personalityEvolutionSystem — evolution_criteria_not_met + determineNewTemperament fallback (Equoria-rr7)', () => {
  let rr7User;
  let rr7GroomMixed;
  let rr7HorseSpirited;
  let rr7HorseDummy;
  let rr7GroomForHorses;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    const ts = Date.now();
    const rand = () => Math.random().toString(36).slice(2, 8);

    rr7User = await prisma.user.create({
      data: {
        email: `pes-rr7-${ts}-${rand()}@test.com`,
        username: `pesrr7${ts}${rand()}`,
        password: 'irrelevant-hash',
        firstName: 'PES',
        lastName: 'RR7',
        money: 1000,
      },
    });

    // Groom with experience=100 but 15 alternating poor/good interactions → consistency < 0.7
    // → shouldEvolve=false → hits line 136 (evolution_criteria_not_met)
    rr7GroomMixed = await prisma.groom.create({
      data: {
        name: `TestFixture-PES-RR7-GroomMixed-${ts}`,
        speciality: 'foalCare',
        personality: 'calm',
        userId: rr7User.id,
        experience: 100,
      },
    });

    rr7GroomForHorses = await prisma.groom.create({
      data: {
        name: `TestFixture-PES-RR7-GroomForHorses-${ts}`,
        speciality: 'foalCare',
        personality: 'gentle',
        userId: rr7User.id,
      },
    });

    // Dummy horse used ONLY as the foalId target for rr7GroomMixed's 15 mixed interactions
    rr7HorseDummy = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-PES-RR7-HorseDummy-${ts}`,
        sex: 'Filly',
        dateOfBirth: gameCalendarDate(new Date(ts), -Math.round(365.25)),
        age: 1,
        userId: rr7User.id,
      },
    });

    // Horse with temperament='spirited' (not 'nervous'/'developing') + age=2 + ONLY 10 excellent interactions
    // → shouldEvolve=true (consistency=1.0 ≥ 0.6), determineNewTemperament returns currentTemperament (line 559)
    rr7HorseSpirited = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `TestFixture-PES-RR7-HorseSpirited-${ts}`,
        sex: 'Filly',
        dateOfBirth: gameCalendarDate(new Date(ts), -Math.round(2 * 365.25)),
        age: 2,
        userId: rr7User.id,
        temperament: 'spirited',
      },
    });

    // 15 alternating poor/good interactions for rr7GroomMixed attached to rr7HorseDummy
    // makes consistency ≈ 0.48 < 0.7 → shouldEvolve=false → hits line 136
    for (let i = 0; i < 15; i++) {
      await prisma.groomInteraction.create({
        data: {
          foalId: rr7HorseDummy.id,
          groomId: rr7GroomMixed.id,
          interactionType: 'daily_care',
          duration: 30,
          bondingChange: 1,
          stressChange: 0,
          quality: i % 2 === 0 ? 'poor' : 'good',
          taskType: 'grooming',
          createdAt: new Date(ts - (15 - i) * 60000),
          timestamp: new Date(ts - (15 - i) * 60000),
        },
      });
    }

    // 10 excellent interactions for rr7HorseSpirited only — no mixed interactions on this horse
    for (let i = 0; i < 10; i++) {
      await prisma.groomInteraction.create({
        data: {
          foalId: rr7HorseSpirited.id,
          groomId: rr7GroomForHorses.id,
          interactionType: 'daily_care',
          duration: 30,
          bondingChange: 2,
          stressChange: 0,
          quality: 'excellent',
          taskType: 'grooming',
          createdAt: new Date(ts - (10 - i) * 60000),
          timestamp: new Date(ts - (10 - i) * 60000),
        },
      });
    }

    cleanup.add(
      () =>
        prisma.groomInteraction.deleteMany({ where: { groomId: { in: [rr7GroomMixed.id, rr7GroomForHorses.id] } } }),
      'rr7-interactions',
    );
    cleanup.add(
      () => prisma.horse.deleteMany({ where: { name: { startsWith: 'TestFixture-PES-RR7-' } } }),
      'rr7-horses',
    );
    cleanup.add(
      () => prisma.groom.deleteMany({ where: { name: { startsWith: 'TestFixture-PES-RR7-' } } }),
      'rr7-grooms',
    );
    cleanup.add(() => prisma.user.deleteMany({ where: { id: rr7User?.id } }), 'rr7User');
  }, 60000);

  afterAll(() => cleanup.run(), 30000);

  it('evolveHorseTemperament with spirited temperament + 10 excellent interactions → determineNewTemperament returns currentTemperament (line 559)', async () => {
    const result = await evolveHorseTemperament(rr7HorseSpirited.id);
    expect(result.success).toBe(true);
    // determineNewTemperament('spirited', ...) hits the fallback return (line 559)
    expect(result.newTemperament).toBe('spirited');
  });
});
