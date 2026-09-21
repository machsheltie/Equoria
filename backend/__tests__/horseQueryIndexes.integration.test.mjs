/**
 * horses table query-indexes sentinel (Equoria-ezx1y).
 *
 * Asserts the three indexes added by migration
 * 20260529140000_ezx1y_add_horse_query_indexes exist with the expected
 * column composition and that the query planner actually uses them for
 * the canonical hot-path queries (marketplace browse + gdpr cascade).
 *
 * A regression that drops the indexes or alters them to a shape the
 * planner can't use fails this test.
 *
 * SENTINEL preconditions (Equoria-45bwy): the two plan-shape assertions
 * below only hold when `horses` is populated enough that the Postgres
 * planner actually prefers the index over a sequential scan. The pre-push
 * gate runs each shard against a disposable lane database built from
 * migrations + backend/seed/seedDatabase.mjs, and that seed creates ZERO
 * horse rows — so without an explicit population here, these two cases
 * passed or failed purely on whichever earlier suite in the shard happened
 * to leave horse rows (and planner statistics) behind. Evidence: gate run
 * equoria-shard-1taeAx (suite at position 99/115) failed both cases against
 * a one-row table (`Seq Scan on horses (cost=0.00..1.02 rows=1 ...)`); two
 * earlier gate runs (suite at position 111, different predecessors) passed.
 * Reproduced RED deterministically against an empty lane-shaped database
 * (`node scripts/test-lane-db.mjs create`) before this fix; see bd
 * Equoria-45bwy notes for the full RED/GREEN evidence.
 *
 * Fix: seed a scoped, fail-loud-cleanup-tracked horse population before the
 * EXPLAIN cases, run ANALYZE horses so planner statistics reflect the rows,
 * then EXPLAIN. 800 rows (measured against an empty lane database) gives a
 * comfortable margin above what the planner needs — matching the order of
 * magnitude of the canonical dev DB (787 horses), against which these
 * assertions already passed standalone. The STRUCTURAL case remains
 * read-only against whatever the DB already holds.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';

const SENTINEL = `TestFixture-HorseQueryIndexes-${randomBytes(6).toString('hex')}`;
// Comfortable margin above what an empty lane-shaped table needs to flip
// both plans away from Seq Scan (measured; see module docstring).
const FIXTURE_HORSE_COUNT = 800;
// A pool of "sire" horses created first (individually, so their real ids
// are known) that the bulk population's sireId legitimately references —
// giving the sireId column a genuine non-null distribution so the planner
// has real statistics to estimate selectivity from, rather than a column
// that is entirely NULL.
const SIRE_POOL_SIZE = 40;

const suiteCleanup = createCleanupTracker();
let user;

beforeAll(async () => {
  user = await prisma.user.create({
    data: {
      email: `hqifix-${randomBytes(6).toString('hex')}@test.com`,
      username: `hqifix${randomBytes(6).toString('hex')}`,
      password: 'irrelevant-hash',
      firstName: 'HorseQueryIndexes',
      lastName: 'Fixture',
      money: 0,
    },
  });

  const sireIds = [];
  for (let i = 0; i < SIRE_POOL_SIZE; i += 1) {
    const sire = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `${SENTINEL}-sire-${i}`,
        sex: 'Stallion',
        dateOfBirth: new Date('2015-01-01'),
        userId: user.id,
        forSale: i % 2 === 0,
        salePrice: i % 2 === 0 ? 1000 + i * 41 : 0,
      },
    });
    sireIds.push(sire.id);
  }

  const bulk = [];
  for (let i = 0; i < FIXTURE_HORSE_COUNT - SIRE_POOL_SIZE; i += 1) {
    bulk.push({
      ...fixtureColor(),
      name: `${SENTINEL}-bulk-${i}`,
      sex: i % 2 === 0 ? 'Mare' : 'Stallion',
      dateOfBirth: new Date('2019-01-01'),
      userId: user.id,
      forSale: true,
      salePrice: 500 + ((i * 37) % 50000),
      sireId: sireIds[i % sireIds.length],
    });
  }
  await prisma.horse.createMany({ data: bulk });

  // Planner statistics (pg_class.reltuples, per-column MCV/histogram) are
  // only refreshed by ANALYZE (or autovacuum, which is not guaranteed to
  // have run yet within this test). Without this, EXPLAIN below sees the
  // pre-insert (empty) statistics and keeps choosing Seq Scan.
  await prisma.$executeRawUnsafe('ANALYZE horses');

  suiteCleanup.add(() => prisma.horse.deleteMany({ where: { name: { startsWith: SENTINEL } } }), 'horses');
  suiteCleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
});

afterAll(() => suiteCleanup.run());

describe('horses query-indexes (Equoria-ezx1y)', () => {
  it('STRUCTURAL: all 3 ezx1y indexes exist with the expected columns', async () => {
    const rows = await prisma.$queryRaw`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'horses'
        AND indexname IN (
          'horses_sireId_idx',
          'horses_damId_idx',
          'horses_forSale_salePrice_idx'
        )
      ORDER BY indexname
    `;
    expect(rows).toHaveLength(3);

    const byName = Object.fromEntries(rows.map(r => [r.indexname, r.indexdef]));

    // sireId index must reference the sireId column.
    expect(byName.horses_sireId_idx).toMatch(/\("sireId"\)/);
    // damId index must reference the damId column.
    expect(byName.horses_damId_idx).toMatch(/\("damId"\)/);
    // Composite must be (forSale, salePrice) in that order so the leading
    // column serves both the WHERE filter and the ORDER BY sort.
    expect(byName.horses_forSale_salePrice_idx).toMatch(/\("forSale",\s*"salePrice"\)/);
  });

  it('SENTINEL: marketplace-browse query uses horses_forSale_salePrice_idx', async () => {
    // EXPLAIN (no ANALYZE — we don't need wall-clock numbers in CI, just
    // the planner's chosen access method).
    const plan = await prisma.$queryRawUnsafe(`
      EXPLAIN
      SELECT id, name, "salePrice"
      FROM horses
      WHERE "forSale" = true
      ORDER BY "salePrice" ASC
      LIMIT 20
    `);
    const planText = plan.map(r => r['QUERY PLAN']).join('\n');
    expect(planText).toMatch(/horses_forSale_salePrice_idx/);
    expect(planText).not.toMatch(/Seq Scan on "?horses"?/);
  });

  it('SENTINEL: gdpr cascade-style query uses horses_sireId_idx', async () => {
    const plan = await prisma.$queryRawUnsafe(`
      EXPLAIN
      SELECT COUNT(*) FROM horses WHERE "sireId" IN (1,2,3,4,5,6,7,8,9,10)
    `);
    const planText = plan.map(r => r['QUERY PLAN']).join('\n');
    expect(planText).toMatch(/horses_sireId_idx/);
    expect(planText).not.toMatch(/Seq Scan on "?horses"?/);
  });
});
