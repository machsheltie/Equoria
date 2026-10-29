/**
 * The foal's lineage is read in one query per generation (Equoria-cmw85.13).
 *
 * gatherLineage walked the ancestry with one findUnique per ancestor (about 14
 * queries for three generations) on every foal birth inside the foaling job.
 * It now reads the pedigree through the shared batched walker.
 *
 * Real database, real function: the exact lineage the per-ancestor walk
 * produced for this pedigree (order: sire then dam, then each generation in
 * breadth-first order, each ancestor once, with its best discipline), and no
 * per-ancestor query.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { gatherLineage } from '../services/foalLineage.mjs';
import { testHorseData } from '../../../__tests__/helpers/createTestHorse.mjs';

const SCOPE = 'TestFixture-FoalLineage';
const RUN = randomBytes(6).toString('hex');

let user;
const createdHorseIds = [];
const cleanup = createCleanupTracker();
const h = {};

async function makeHorse(key, sex, extra = {}) {
  const horse = await prisma.horse.create({
    data: await testHorseData(prisma, {
      ...fixtureColor(),
      name: `${SCOPE}-${key}-${RUN}`,
      sex,
      dateOfBirth: new Date('2018-01-01'),
      age: 5,
      userId: user.id,
      ...extra,
    }),
  });
  createdHorseIds.push(horse.id);
  h[key] = horse;
  return horse;
}

beforeAll(async () => {
  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } }), 'lineageHorses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'foalLineageUser');

  user = await prisma.user.create({
    data: {
      emailVerified: true,
      email: `foallin-${RUN}@test.com`,
      username: `foallin${RUN}`,
      password: 'irrelevant-hash',
      firstName: 'Foal',
      lastName: 'Lineage',
      money: 0,
    },
  });

  // Sire S: sire A, dam B.  Dam M: sire A, dam C.  A: sire X, dam D.
  // X has a sire of its own, beyond the three generations walked.
  const far = await makeHorse('FAR', 'Stallion');
  const x = await makeHorse('X', 'Stallion', {
    sireId: far.id,
    disciplineScores: { Dressage: 12, Racing: 30, Show: 'n/a' },
    trait: 'bold',
    temperament: 'Driven',
  });
  const d = await makeHorse('D', 'Mare', { disciplineScores: { Dressage: 0 } });
  const a = await makeHorse('A', 'Stallion', { sireId: x.id, damId: d.id });
  const b = await makeHorse('B', 'Mare', { disciplineScores: { Jumping: 7 } });
  const c = await makeHorse('C', 'Mare');
  await makeHorse('S', 'Stallion', { sireId: a.id, damId: b.id });
  await makeHorse('M', 'Mare', { sireId: a.id, damId: c.id });
}, 60_000);

afterAll(() => cleanup.run(), 60_000);

describe('gatherLineage (Equoria-cmw85.13)', () => {
  it('returns the same lineage in at most one findMany per generation', async () => {
    const ops = { findUnique: 0, findMany: 0 };
    const realFindUnique = prisma.horse.findUnique.bind(prisma.horse);
    const realFindMany = prisma.horse.findMany.bind(prisma.horse);
    prisma.horse.findUnique = (...args) => {
      ops.findUnique += 1;
      return realFindUnique(...args);
    };
    prisma.horse.findMany = (...args) => {
      ops.findMany += 1;
      return realFindMany(...args);
    };

    let lineage;
    try {
      lineage = await gatherLineage(h.S.id, h.M.id, 3);
    } finally {
      prisma.horse.findUnique = realFindUnique;
      prisma.horse.findMany = realFindMany;
    }

    expect(ops.findUnique).toBe(0);
    expect(ops.findMany).toBeLessThanOrEqual(3);

    // Sire then dam, then A (once, though both parents have it), B, C, then A's
    // parents X and D. X's own sire is the fourth generation: cut off.
    expect(lineage.map(l => [l.id, l.generation])).toEqual([
      [h.S.id, 0],
      [h.M.id, 0],
      [h.A.id, 1],
      [h.B.id, 1],
      [h.C.id, 1],
      [h.X.id, 2],
      [h.D.id, 2],
    ]);
    const byKey = key => lineage.find(l => l.id === h[key].id);
    expect(byKey('X')).toEqual({
      id: h.X.id,
      name: h.X.name,
      discipline: 'Racing',
      disciplineScores: { Dressage: 12, Racing: 30, Show: 'n/a' },
      generation: 2,
      trait: 'bold',
      temperament: 'Driven',
    });
    expect(byKey('B').discipline).toBe('Jumping');
    expect(byKey('D').discipline).toBeNull(); // a best score of 0 is no discipline
    expect(byKey('C').discipline).toBeNull(); // no scores at all
  }, 60_000);

  it('stops at the generations asked for', async () => {
    const lineage = await gatherLineage(h.S.id, h.M.id, 1);
    expect(lineage.map(l => l.id)).toEqual([h.S.id, h.M.id]);
  }, 60_000);
});
