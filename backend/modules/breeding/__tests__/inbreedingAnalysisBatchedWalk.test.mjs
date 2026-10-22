/**
 * inbreedingAnalysis pedigree walk — batched, not per-ancestor (Equoria-cmw85.3).
 *
 * calculateDetailedInbreedingCoefficient() walks each parent's pedigree five
 * generations deep. The walk used one prisma.horse.findUnique PER ANCESTOR
 * (up to ~62 sequential round-trips per pair). The shared batched walker
 * issues ONE findMany per generation instead.
 *
 * Two assertions, both against the real database and real service:
 *   1. query count: zero findUnique, at most one findMany per generation per
 *      side (the counting wrapper delegates to the real client);
 *   2. identical results: the exact coefficient, common ancestors and paths
 *      the per-ancestor walk produced for this pedigree (hand-derived from
 *      Wright's (1/2)^(n1+n2+1) rule and the first-visit BFS path rule).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { calculateDetailedInbreedingCoefficient } from '../services/genetics/inbreedingAnalysis.mjs';

const SCOPE = 'TestFixture-InbreedWalk';
const RUN = randomBytes(6).toString('hex');

let user;
const createdHorseIds = [];
const cleanup = createCleanupTracker();
const horses = {};

async function makeHorse(key, sex, sireId = null, damId = null) {
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${SCOPE}-${key}-${RUN}`,
      sex,
      dateOfBirth: new Date('2018-01-01'),
      age: 5,
      userId: user.id,
      sireId,
      damId,
    },
  });
  createdHorseIds.push(horse.id);
  horses[key] = horse;
  return horse;
}

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `inbreedwalk-${RUN}@test.com`,
      username: `inbreedwalk${RUN}`,
      password: 'irrelevant-hash',
      firstName: 'Inbreed',
      lastName: 'Walk',
      money: 0,
    },
  });

  // Pedigree (S = stallion, M = mare):
  //   S: sire A, dam B        M: sire A, dam C
  //   A: sire X, dam D        B: sire X, dam E        C: sire F, dam G
  //   X: sire Y, dam Z        Y: sire W, dam V        W: sire U   (U is gen 5 from S/M -> cut off)
  const u = await makeHorse('U', 'Stallion');
  const v = await makeHorse('V', 'Mare');
  const w = await makeHorse('W', 'Stallion', u.id, null);
  const y = await makeHorse('Y', 'Stallion', w.id, v.id);
  const z = await makeHorse('Z', 'Mare');
  const x = await makeHorse('X', 'Stallion', y.id, z.id);
  const d = await makeHorse('D', 'Mare');
  const e = await makeHorse('E', 'Mare');
  const f = await makeHorse('F', 'Stallion');
  const g = await makeHorse('G', 'Mare');
  const a = await makeHorse('A', 'Stallion', x.id, d.id);
  const b = await makeHorse('B', 'Mare', x.id, e.id);
  const c = await makeHorse('C', 'Mare', f.id, g.id);
  await makeHorse('S', 'Stallion', a.id, b.id);
  await makeHorse('M', 'Mare', a.id, c.id);

  cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } }), 'pedigreeHorses');
  cleanup.add(() => prisma.user.deleteMany({ where: { id: user.id } }), 'inbreedWalkUser');
}, 60_000);

afterAll(() => cleanup.run(), 60_000);

describe('calculateDetailedInbreedingCoefficient() pedigree walk (Equoria-cmw85.3)', () => {
  it('walks each side in one findMany per generation and returns the same analysis', async () => {
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

    let result;
    try {
      result = await calculateDetailedInbreedingCoefficient(horses.S.id, horses.M.id);
    } finally {
      prisma.horse.findUnique = realFindUnique;
      prisma.horse.findMany = realFindMany;
    }

    // Query shape: five generations per side = at most 5 findMany each.
    expect(ops.findUnique).toBe(0);
    expect(ops.findMany).toBeGreaterThanOrEqual(2);
    expect(ops.findMany).toBeLessThanOrEqual(10);

    // Common ancestors, in stallion-lineage BFS order:
    //   A: S gen1 (sire), M gen1 (sire)           -> (1/2)^3        = 0.125
    //   X: S gen2 first visited via A (sire,sire), M gen2 (sire,sire) -> (1/2)^5 = 0.03125
    //   Y: S gen3 (sire,sire,sire), M gen3          -> (1/2)^7        = 0.0078125
    //   W: S gen4, M gen4                           -> (1/2)^9        = 0.001953125
    //   Z: S gen3 (sire,sire,dam), M gen3           -> (1/2)^7        = 0.0078125
    //   V: S gen4 (sire,sire,sire,dam), M gen4      -> (1/2)^9        = 0.001953125
    // U (gen 5) is beyond the five-generation walk.
    // D is A's dam: S gen2 (sire,dam), M gen2 (sire,dam)  -> (1/2)^5   = 0.03125
    const byName = Object.fromEntries(result.commonAncestors.map(ancestor => [ancestor.name.split('-')[2], ancestor]));
    expect(Object.keys(byName).sort()).toEqual(['A', 'D', 'V', 'W', 'X', 'Y', 'Z']);
    expect(byName.A.stallionPath).toEqual(['sire']);
    expect(byName.A.marePath).toEqual(['sire']);
    expect(byName.A.contribution).toBe(0.125);
    expect(byName.X.stallionPath).toEqual(['sire', 'sire']);
    expect(byName.X.marePath).toEqual(['sire', 'sire']);
    expect(byName.X.contribution).toBe(0.031);
    expect(byName.D.stallionPath).toEqual(['sire', 'dam']);
    expect(byName.Y.stallionPath).toEqual(['sire', 'sire', 'sire']);
    expect(byName.Z.stallionPath).toEqual(['sire', 'sire', 'dam']);
    expect(byName.W.stallionPath).toEqual(['sire', 'sire', 'sire', 'sire']);
    expect(byName.V.stallionPath).toEqual(['sire', 'sire', 'sire', 'dam']);
    expect(result.commonAncestors.some(ancestor => ancestor.name.includes('-U-'))).toBe(false);

    // 0.125 + 0.03125*2 + 0.0078125*2 + 0.001953125*2 = 0.20703125 -> 0.207
    expect(result.coefficient).toBe(0.207);
    expect(result.pathAnalysis).toHaveLength(7);
  }, 60_000);
});
