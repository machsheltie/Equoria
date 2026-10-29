/**
 * One-time backfill of hidden traits on traitless horses (Equoria-q4uem.17).
 *
 * Owner ruling 2026-10-29 (q306): horses that carry no trait get hidden traits rolled
 * "the same way it would from the store", so 1-5 hidden traits each. The store roll
 * is generateStoreHorseTraitRoster (rulings 10-27 q117 roster, 10-28 q241/q246 odds),
 * and a store horse stores every trait in epigeneticModifiers.hidden.
 *
 * Drives the real script's exported core against the real database, scoped to the
 * horses this file plants (horseIds), so no other horse row is read or written.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../packages/database/prismaClient.mjs';
import { traitRosterIds, checkTraitConflict } from '../utils/epigeneticTraits.mjs';
import { generateStoreHorseTraitRoster } from '../modules/traits/index.mjs';
import {
  classifyTraitModifiers,
  runTraitlessHorseBackfill,
} from '../scripts/backfill-traitless-horse-hidden-traits.mjs';
import { createTestHorse } from './helpers/createTestHorse.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';
import { seededRng } from './helpers/seededRng.mjs';

const tag = `TestFixture-q4uem17-${randomBytes(4).toString('hex')}`;
const cleanup = createCleanupTracker();
const horseIds = [];
const ids = {};
let owner;

cleanup.add(async () => {
  if (horseIds.length) {
    await prisma.horse.deleteMany({ where: { id: { in: horseIds } } });
  }
}, 'planted horses');
cleanup.add(async () => {
  if (owner) {
    await prisma.user.delete({ where: { id: owner.id } });
  }
}, 'planted owner');

async function plant(label, data = {}) {
  const horse = await createTestHorse(prisma, { name: `${tag}-${label}`, sex: 'Mare', ...data }, horseIds);
  return horse.id;
}

async function readModifiers(id) {
  const [row] = await prisma.$queryRaw`SELECT "epigeneticModifiers" FROM horses WHERE id = ${id}`;
  return row.epigeneticModifiers;
}

async function snapshot() {
  const out = {};
  for (const id of horseIds) {
    out[id] = await readModifiers(id);
  }
  return out;
}

beforeAll(async () => {
  const suffix = randomBytes(4).toString('hex');
  owner = await prisma.user.create({
    data: {
      emailVerified: true,
      username: `q4uem17Owner${suffix}`,
      email: `q4uem17owner${suffix}@test.com`,
      password: 'testPassword123',
      firstName: 'Trait',
      lastName: 'Owner',
    },
  });
  ids.ownedEmpty = await plant('ownedEmpty', {
    age: 4,
    userId: owner.id,
    epigeneticModifiers: { positive: [], negative: [], hidden: [] },
  });
  ids.emptyAdult = await plant('emptyAdult', {
    age: 5,
    epigeneticModifiers: { positive: [], negative: [], hidden: [] },
  });
  ids.nullAdult = await plant('nullAdult', { age: 8 });
  await prisma.$executeRaw`UPDATE horses SET "epigeneticModifiers" = NULL WHERE id = ${ids.nullAdult}`;
  ids.emptyFoalKeepsKeys = await plant('emptyFoal', {
    age: 1,
    epigeneticModifiers: { positive: [], negative: [], hidden: [], dormant: [], revealEvaluatedThroughDay: 4 },
  });
  ids.hasHidden = await plant('hasHidden', {
    age: 4,
    epigeneticModifiers: { positive: [], negative: [], hidden: ['resilient'] },
  });
  ids.hasPositive = await plant('hasPositive', {
    age: 6,
    epigeneticModifiers: { positive: ['calm'], negative: [], hidden: [] },
  });
  ids.hasDormant = await plant('hasDormant', {
    age: 7,
    epigeneticModifiers: { positive: [], negative: [], hidden: [], dormant: ['bold'] },
  });
  ids.legacyArray = await plant('legacyArray', { age: 9, epigeneticModifiers: ['calm'] });
});

afterAll(async () => {
  await cleanup.run();
}, 30000);

describe('classifyTraitModifiers', () => {
  it('treats NULL and all-empty lists as traitless, any carried trait as having traits', () => {
    expect(classifyTraitModifiers(null)).toBe('traitless');
    expect(classifyTraitModifiers({})).toBe('traitless');
    expect(classifyTraitModifiers({ positive: [], negative: [], hidden: [], dormant: [] })).toBe('traitless');
    expect(classifyTraitModifiers({ hidden: ['bold'] })).toBe('hasTraits');
    expect(classifyTraitModifiers({ negative: ['fragile'] })).toBe('hasTraits');
    expect(classifyTraitModifiers({ dormant: ['bold'] })).toBe('hasTraits');
    expect(classifyTraitModifiers(['calm'])).toBe('unrecognised');
    expect(classifyTraitModifiers('calm')).toBe('unrecognised');
  });
});

describe('runTraitlessHorseBackfill against the real database', () => {
  it("--user-id narrows the run to that owner's horses", async () => {
    const before = await snapshot();
    const result = await runTraitlessHorseBackfill({ horseIds, userId: owner.id, rng: seededRng(5) });
    expect(result.horsesScanned).toBe(1);
    expect(result.filled.map(f => f.id)).toEqual([ids.ownedEmpty]);
    const none = await runTraitlessHorseBackfill({ horseIds, userId: `${owner.id}-nobody` });
    expect(none.horsesScanned).toBe(0);
    expect(await snapshot()).toEqual(before);
  });

  it('a dry run reports the store roll for each traitless horse and writes nothing', async () => {
    const before = await snapshot();
    const result = await runTraitlessHorseBackfill({ horseIds, rng: seededRng(306) });
    expect(result.rolledBack).toBe(true);
    expect(result.horsesScanned).toBe(horseIds.length);
    expect(result.alreadyHaveTraits).toBe(3);
    expect(result.unrecognised).toEqual([{ id: ids.legacyArray, name: `${tag}-legacyArray` }]);
    expect(result.filled.map(f => f.id).sort((a, b) => a - b)).toEqual(
      [ids.ownedEmpty, ids.emptyAdult, ids.nullAdult, ids.emptyFoalKeepsKeys].sort((a, b) => a - b),
    );
    expect(await snapshot()).toEqual(before);
  });

  it('rolls with the store generator itself: same seed, same traits as a store horse', async () => {
    const result = await runTraitlessHorseBackfill({ horseIds: [ids.emptyAdult], rng: seededRng(42) });
    expect(result.filled).toHaveLength(1);
    expect(result.filled[0].hidden).toEqual(generateStoreHorseTraitRoster(seededRng(42)).hidden);
    expect(await readModifiers(ids.emptyAdult)).toEqual({ positive: [], negative: [], hidden: [] });
  });

  it('apply stores 1-5 hidden roster traits like a store horse; horses with traits untouched', async () => {
    const before = await snapshot();
    const result = await runTraitlessHorseBackfill({ dryRun: false, horseIds, rng: seededRng(7) });
    expect(result.rolledBack).toBe(false);
    expect(result.filled).toHaveLength(4);

    for (const id of [ids.ownedEmpty, ids.emptyAdult, ids.nullAdult, ids.emptyFoalKeepsKeys]) {
      const stored = await readModifiers(id);
      const filled = result.filled.find(f => f.id === id);
      expect(stored.positive).toEqual([]);
      expect(stored.negative).toEqual([]);
      expect(stored.hidden).toEqual(filled.hidden);
      expect(stored.hidden.length).toBeGreaterThanOrEqual(1);
      expect(stored.hidden.length).toBeLessThanOrEqual(5);
      expect(new Set(stored.hidden).size).toBe(stored.hidden.length);
      for (const trait of stored.hidden) {
        expect(traitRosterIds).toContain(trait);
        for (const other of stored.hidden) {
          expect(checkTraitConflict(trait, other)).toBe(false);
        }
      }
    }
    // Other keys on the stored object survive; a store horse's three lists are added over them.
    const foal = await readModifiers(ids.emptyFoalKeepsKeys);
    expect(foal.dormant).toEqual([]);
    expect(foal.revealEvaluatedThroughDay).toBe(4);
    expect(Object.keys(await readModifiers(ids.emptyAdult)).sort()).toEqual(['hidden', 'negative', 'positive']);

    for (const id of [ids.hasHidden, ids.hasPositive, ids.hasDormant, ids.legacyArray]) {
      expect(await readModifiers(id)).toEqual(before[id]);
    }
  });

  it('a second apply does nothing', async () => {
    const before = await snapshot();
    const result = await runTraitlessHorseBackfill({ dryRun: false, horseIds, rng: seededRng(8) });
    expect(result.filled).toEqual([]);
    expect(result.alreadyHaveTraits).toBe(7);
    expect(await snapshot()).toEqual(before);
  });
});
