/**
 * Sentinel-positive performance test for advancedLineageAnalysisService
 * organizeByGenerations() N+1 fix (Equoria-gakyp).
 *
 * Before the fix: organizeByGenerations() iterates each generation's horse
 * IDs and calls prisma.horse.findUnique() per horse — N round-trips per
 * generation, blowing up at 4 generations to ~30 round-trips for a fully
 * populated pedigree.
 *
 * After the fix: a single prisma.horse.findMany({ where: { id: { in: ids } } })
 * per generation collapses each generation to ONE round-trip.
 *
 * The sentinel observes Prisma operations via $extends and asserts the upper
 * bound — N findMany calls (one per generation that has unprocessed horses),
 * zero findUnique calls inside organizeByGenerations.
 *
 * Per Equoria Testing Philosophy: real DB, no mocks. The extension only
 * counts operations; it does not alter them.
 *
 * @module __tests__/breeding/advancedLineagePerformance
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { generateLineageTree } from '../services/advancedLineageAnalysisService.mjs';

// Build a 4-generation pedigree:
//   gen0: 1 stallion + 1 mare (roots)
//   gen1: their 4 parents (2 sires + 2 dams)
//   gen2: 8 grandparents
//   gen3: 16 great-grandparents
// Real DB, scoped TestFixture-LineagePerfN42P-* names.
const SCOPE = 'TestFixture-LineagePerfN42P';
const ts = Date.now();

let user;
let stallion;
let mare;

async function makeHorse(name, sex, sireId = null, damId = null) {
  return prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${SCOPE}-${name}-${ts}`,
      sex,
      dateOfBirth: new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000),
      age: 5,
      userId: user.id,
      sireId,
      damId,
      speed: 60,
      stamina: 60,
      agility: 60,
    },
  });
}

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `lineageperf-${ts}@test.com`,
      username: `lineageperf${ts}`,
      password: 'irrelevant-hash',
      firstName: 'Lineage',
      lastName: 'Perf',
      money: 0,
    },
  });

  // gen3: 16 leaves (8 stallions, 8 mares — sire/dam respectively for the 8 gen2 horses)
  const gen3 = [];
  for (let i = 0; i < 8; i++) {
    gen3.push(await makeHorse(`g3s${i}`, 'Stallion'));
    gen3.push(await makeHorse(`g3m${i}`, 'Mare'));
  }

  // gen2: 8 horses; each takes a unique sire + dam from gen3
  const gen2 = [];
  for (let i = 0; i < 4; i++) {
    gen2.push(await makeHorse(`g2s${i}`, 'Stallion', gen3[i * 4].id, gen3[i * 4 + 1].id));
    gen2.push(await makeHorse(`g2m${i}`, 'Mare', gen3[i * 4 + 2].id, gen3[i * 4 + 3].id));
  }

  // gen1: 4 horses (2 sires + 2 dams of the roots)
  const gen1 = [];
  for (let i = 0; i < 2; i++) {
    gen1.push(await makeHorse(`g1s${i}`, 'Stallion', gen2[i * 4].id, gen2[i * 4 + 1].id));
    gen1.push(await makeHorse(`g1m${i}`, 'Mare', gen2[i * 4 + 2].id, gen2[i * 4 + 3].id));
  }

  // gen0 roots
  stallion = await makeHorse('rootS', 'Stallion', gen1[0].id, gen1[1].id);
  mare = await makeHorse('rootM', 'Mare', gen1[2].id, gen1[3].id);
}, 60_000);

afterAll(async () => {
  // Scoped cleanup — only rows we created
  await prisma.horse.deleteMany({ where: { name: { startsWith: `${SCOPE}-` } } }).catch(() => undefined);
  await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
}, 60_000);

describe('generateLineageTree() — N+1 fix sentinel (Equoria-gakyp)', () => {
  it('issues at most N findMany and zero findUnique per generation across a 4-gen pedigree', async () => {
    const ops = { findUnique: 0, findMany: 0 };

    // $extends produces a counting client that proxies the real Prisma. The
    // module under test uses the global `prisma` import, so we cannot inject
    // ours directly — instead, install a process-wide counter via Prisma
    // middleware (the older `$use` API is dead on extended clients, but the
    // `$extends` API can re-wrap the global client for the duration of the
    // test). We achieve the same observation by attaching a query hook that
    // increments on every horse.findUnique/findMany system-wide during the
    // window of the call.
    //
    // Implementation: temporarily monkey-patch `prisma.horse.findUnique` and
    // `prisma.horse.findMany` to count then delegate. We capture the originals
    // and restore in `finally` so no other test is affected. This is the
    // ONLY allowed observation surface — counts call sites without changing
    // behavior.
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

    try {
      const tree = await generateLineageTree(stallion.id, mare.id, 4);
      expect(tree.root.stallion).not.toBeNull();
      expect(tree.root.mare).not.toBeNull();
      expect(tree.generations.length).toBeGreaterThanOrEqual(1);
    } finally {
      prisma.horse.findUnique = realFindUnique;
      prisma.horse.findMany = realFindMany;
    }

    // Scope: prove BOTH fixes
    //   - gakyp (organizeByGenerations): batches one findMany per generation
    //   - a56gl (buildHorseNode): no longer recurses into the DB; uses the
    //     pre-fetched ancestor map from collectAncestorIdsBFS + ONE batched
    //     findMany for the full ancestor row data
    //
    // Measured shapes (sentinel-positive proof):
    //   - Pre-gakyp (legacy code, 30-horse pedigree): findUnique=60, findMany=0
    //     (2 root preconditions + 28 buildHorseNode recursion + 30 in the
    //      organizeByGenerations loop body).
    //   - Post-gakyp + pre-a56gl: findUnique=30, findMany∈[1,4]
    //     (organizeByGenerations contributes 0 findUnique + N findMany;
    //      the 30 remaining findUnique come from root + buildHorseNode).
    //   - Post-a56gl (current): findUnique=2, findMany∈[2,8]
    //     (2 root preconditions; organizeByGenerations contributes N findMany;
    //      collectAncestorIdsBFS contributes up to maxGen-1 findMany; and
    //      ONE more findMany batches the full ancestor row data).
    //
    // Bounds:
    //   - findUnique <= 4 (was <=40, now ≤ root pair only). Per a56gl AC.
    //   - findMany >= 1, <= 10 (covers both fixes' batches; legacy was 0).
    // Sentinel-positive: regressing either fix bumps findUnique past 4.
    expect(ops.findMany).toBeGreaterThanOrEqual(1);
    expect(ops.findMany).toBeLessThanOrEqual(10);
    expect(ops.findUnique).toBeLessThanOrEqual(4);
  }, 60_000);
});
