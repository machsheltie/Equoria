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
 * Real DB, no fixtures (read-only against existing canonical data).
 */

import { describe, it, expect } from '@jest/globals';
import prisma from '../../packages/database/prismaClient.mjs';

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
