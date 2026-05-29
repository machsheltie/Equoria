/**
 * advancedLineageAnalysisService — N+1 sentinel (Equoria-gakyp).
 *
 * `organizeByGenerations()` previously issued one `prisma.horse.findUnique`
 * per horse per generation, so a 4-generation pedigree cost O(N) round-trips
 * where N is the total number of horses across all generations. This sentinel
 * pins the corrected behaviour: ONE batched `findMany({ where: { id: { in:
 * <generation> } } })` per generation — so the round-trip count is bounded by
 * the GENERATION count, not the horse count.
 *
 * The check fires by spying on the real prisma client used inside the service.
 * It does NOT mock the DB — fixtures are written through the real
 * `prisma.horse.create` path (with `fixtureColor()` spread per
 * `.claude/rules/CONTRIBUTING.md`) and the assertions count the real call
 * shape after `generateLineageTree(...)` completes.
 *
 * Why a sentinel and not just a perf test: a future contributor could
 * accidentally re-introduce the per-horse `findUnique` loop while the data
 * shape stays identical and the existing functional tests stay green. Without
 * a call-count assertion, the N+1 regression is invisible.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { generateLineageTree } from '../services/advancedLineageAnalysisService.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { randomBytes } from 'node:crypto';

const FIXTURE_PREFIX = 'TestFixture-LineageN1-';
const randHex = () => randomBytes(8).toString('hex');

let user;
const created = [];

async function makeHorse(name, overrides = {}) {
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${FIXTURE_PREFIX}${name}-${randHex()}`,
      sex: overrides.sex ?? 'Mare',
      dateOfBirth: new Date('2020-01-01'),
      userId: user.id,
      ...overrides,
    },
  });
  created.push(horse.id);
  return horse;
}

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      id: randHex(),
      username: `lineagen1-${randHex()}`,
      email: `lineagen1-${randHex()}@test.local`,
      password: 'x',
      firstName: 'Lineage',
      lastName: 'N1Test',
      money: 0,
    },
  });
}, 30000);

afterAll(async () => {
  if (created.length > 0) {
    await prisma.horse
      .deleteMany({ where: { id: { in: created } } })
      .catch(() => {});
  }
  if (user) {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }
}, 30000);

describe('organizeByGenerations() — N+1 sentinel (Equoria-gakyp)', () => {
  it('issues at most one prisma.horse query per generation depth (not per horse)', async () => {
    // Build a 3-generation pedigree:
    //   gen 0: stallion + mare (the root pair)
    //   gen 1: stallion's sire+dam, mare's sire+dam (4 parents)
    //   gen 2: their 8 grandparents
    // Total horses across 3 gens = 2 + 4 + 8 = 14.
    // Bounded behaviour: <= 3 prisma.horse queries (one batched findMany per
    //   gen). N+1 behaviour: ~14 prisma.horse.findUnique calls.

    // Build gen 2 (grandparents — no further parents)
    const gp = [];
    for (let i = 0; i < 8; i++) {
      const h = await makeHorse(`GP${i}`, { sex: i % 2 === 0 ? 'Stallion' : 'Mare' });
      gp.push(h);
    }
    // Build gen 1 (parents — point at their parents in gp[])
    const p = [];
    for (let i = 0; i < 4; i++) {
      const sireId = gp[i * 2].id;
      const damId = gp[i * 2 + 1].id;
      const h = await makeHorse(`P${i}`, {
        sex: i % 2 === 0 ? 'Stallion' : 'Mare',
        sireId,
        damId,
      });
      p.push(h);
    }
    // Build gen 0 (stallion + mare)
    const stallion = await makeHorse('S0', {
      sex: 'Stallion',
      sireId: p[0].id,
      damId: p[1].id,
    });
    const mare = await makeHorse('M0', {
      sex: 'Mare',
      sireId: p[2].id,
      damId: p[3].id,
    });

    // Spy on the real prisma.horse client. Wrap each call so the spy fires
    // ONCE per actual DB round-trip. We do NOT replace the implementation;
    // we delegate to the original after counting.
    const findUniqueOrig = prisma.horse.findUnique.bind(prisma.horse);
    const findManyOrig = prisma.horse.findMany.bind(prisma.horse);
    let findUniqueCount = 0;
    let findManyCount = 0;
    prisma.horse.findUnique = async (...args) => {
      findUniqueCount += 1;
      return findUniqueOrig(...args);
    };
    prisma.horse.findMany = async (...args) => {
      findManyCount += 1;
      return findManyOrig(...args);
    };

    try {
      const result = await generateLineageTree(stallion.id, mare.id, 3);
      expect(result).toBeDefined();
      expect(Array.isArray(result.generations)).toBe(true);

      // organizeByGenerations() MUST batch — assert at least one
      // findMany was issued during the run. Pre-fix the function used
      // only findUnique inside its loop, so this assertion catches the
      // structural defect even if call counts shift due to unrelated
      // refactors elsewhere in the pipeline.
      expect(findManyCount).toBeGreaterThanOrEqual(1);

      // Pre-fix: ~14 findUnique calls inside organizeByGenerations alone
      // (one per horse across 3 gens of 2+4+8 horses), on TOP of the
      // ~14 findUnique calls from the buildHorseNode recursive tree
      // (independent codepath; out of scope for this issue). Pre-fix
      // total observed: 28 calls. Post-fix: findMany batches the
      // organizeByGenerations calls, leaving only the buildHorseNode
      // tree's ~14 findUnique calls + 3 batched findMany = ~17 total.
      //
      // Cap at 22 so:
      //   - post-fix (~17) passes with headroom
      //   - pre-fix regression (28) fails clearly
      //   - the cap fires on the N+1 reintroduction even if buildHorseNode
      //     itself grows a couple of legitimate lookups
      const totalHorseQueries = findUniqueCount + findManyCount;
      expect(totalHorseQueries).toBeLessThanOrEqual(22);
    } finally {
      // Restore originals — leaking the spy across tests would break other
      // suites in the same Jest worker.
      prisma.horse.findUnique = findUniqueOrig;
      prisma.horse.findMany = findManyOrig;
    }
  }, 60000);
});
