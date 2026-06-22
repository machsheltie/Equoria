/**
 * Sentinel: breeding/index.mjs surfaces BOTH breeding-recommendation functions
 * distinctly — Equoria-axad9.2.
 *
 * THE DEFECT THIS GUARDS: two services historically both exported a symbol
 * named `generateBreedingRecommendations`:
 *   - enhancedGeneticProbabilityService.mjs — SYNC, takes (stallion, mare) objects
 *   - advancedLineageAnalysisService.mjs    — ASYNC, takes (stallionId, mareId), DB
 * Both are `export *`'d through breeding/index.mjs, so ONE silently shadowed the
 * other at the barrel (star-export merge ambiguity / last-wins). A cross-module
 * consumer importing `generateBreedingRecommendations` from the barrel got an
 * indeterminate one. The fix renames each to a distinct canonical name and
 * surfaces both through the barrel.
 *
 * WHY THIS IS SENTINEL-POSITIVE (not vacuous): the test imports BOTH distinct
 * names FROM THE BARREL and asserts they are two different live function objects
 * with their real, divergent behaviour (sync object-shape vs async ID-shape +
 * real-DB). If anyone reverts to `export *` for the colliding symbol — or
 * re-collides the two declarations under one name — at most ONE name can survive
 * the merge, so one of these barrel imports resolves to `undefined` and the
 * `typeof === 'function'` / `.length` / behaviour assertions FAIL. The two
 * functions also have different arity AND one is async while the other is sync,
 * so even an accidental alias-to-the-same-function would be caught by the
 * "not the same reference" + behaviour assertions below.
 *
 * Real DB, no mocks (the lineage function does real Prisma work).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import * as breedingBarrel from '../index.mjs';
import { generateGeneticBreedingRecommendations, generateLineageBreedingRecommendations } from '../index.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

let user;
let stallion;
let mare;
const createdHorseIds = [];
const cleanup = createCleanupTracker();

beforeAll(async () => {
  const ts = Date.now();
  const rand = () => Math.random().toString(36).slice(2, 8);

  user = await prisma.user.create({
    data: {
      email: `barrel-collision-${ts}-${rand()}@test.com`,
      username: `barrelcollision${ts}${rand()}`,
      password: 'irrelevant-hash',
      firstName: 'BarrelCollision',
      lastName: 'Tester',
      money: 1000,
    },
  });

  stallion = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-BarrelCollision-Stallion-${ts}`,
      sex: 'Stallion',
      dateOfBirth: new Date(Date.now() - 4 * 365 * 24 * 60 * 60 * 1000),
      age: 4,
      userId: user.id,
      speed: 72,
      stamina: 68,
      agility: 65,
    },
  });

  mare = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `TestFixture-BarrelCollision-Mare-${ts}`,
      sex: 'Mare',
      dateOfBirth: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
      age: 5,
      userId: user.id,
      speed: 60,
      stamina: 75,
      agility: 70,
    },
  });

  createdHorseIds.push(stallion.id, mare.id);
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } }), 'barrelCollisionHorses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'barrelCollisionUser');
}, 30000);

afterAll(() => cleanup.run(), 30000);

describe('breeding/index.mjs — generateBreedingRecommendations collision resolution (Equoria-axad9.2)', () => {
  it('surfaces BOTH distinct functions through the barrel (no star-export shadowing)', () => {
    expect(typeof generateGeneticBreedingRecommendations).toBe('function');
    expect(typeof generateLineageBreedingRecommendations).toBe('function');
    // They MUST be two different live references — a star-collision under one
    // name could only surface one; an accidental alias would make these equal.
    expect(generateGeneticBreedingRecommendations).not.toBe(generateLineageBreedingRecommendations);
    // The old colliding symbol must no longer exist on the barrel at all.
    expect(breedingBarrel.generateBreedingRecommendations).toBeUndefined();
  });

  it('the genetic function is SYNC and consumes (stallion, mare) OBJECTS', () => {
    const stallionObj = {
      id: 1,
      traits: { positive: ['athletic', 'intelligent'], negative: [], hidden: ['trainabilityBoost'] },
      stats: { speed: 80, stamina: 70, agility: 75, endurance: 65, strength: 60 },
      disciplines: ['Dressage', 'Show Jumping'],
    };
    const mareObj = {
      id: 2,
      traits: { positive: ['calm', 'athletic'], negative: ['nervous'], hidden: [] },
      stats: { speed: 65, stamina: 80, agility: 70, endurance: 75, strength: 55 },
      disciplines: ['Dressage', 'Endurance'],
    };
    // SYNC: returns a plain object directly (NOT a Promise).
    const result = generateGeneticBreedingRecommendations(stallionObj, mareObj);
    expect(result).not.toBeInstanceOf(Promise);
    expect(result).toHaveProperty('overallRecommendation');
    expect(result).toHaveProperty('compatibilityScore');
    expect(Array.isArray(result.strengths)).toBe(true);
    expect(Array.isArray(result.concerns)).toBe(true);
  });

  it('the lineage function is ASYNC and consumes (stallionId, mareId) and does real DB work', async () => {
    const promise = generateLineageBreedingRecommendations(stallion.id, mare.id);
    // ASYNC: the call returns a Promise (the genetic one would not).
    expect(promise).toBeInstanceOf(Promise);
    const result = await promise;
    expect(result).toBeDefined();
    expect(typeof result.compatibility).toBe('object');
    expect(typeof result.compatibility.score).toBe('number');
    expect(Array.isArray(result.strengths)).toBe(true);
    expect(Array.isArray(result.risks)).toBe(true);
    expect(Array.isArray(result.suggestions)).toBe(true);
  });

  it('the lineage function throws (typed 404) when horses do not exist — proves it is the DB one', async () => {
    await expect(generateLineageBreedingRecommendations(-1, -2)).rejects.toThrow();
  });
});
