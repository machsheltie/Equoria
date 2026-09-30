/**
 * Foreign-key index sentinel (Equoria-bvddn.23).
 *
 * Asserts the six FK indexes added by migration
 * 20260930120000_bvddn23_add_missing_fk_indexes exist, each as a
 * single-column btree on exactly the foreign-key column. A regression that
 * drops one, renames it away from the name schema.prisma implies, or widens
 * it so the FK is no longer the leading column fails this test.
 *
 * STRUCTURAL only: read-only against pg_indexes, no fixtures. Plan-shape
 * (EXPLAIN) assertions are deliberately left out — they need a populated,
 * ANALYZEd table to be deterministic (see Equoria-45bwy in
 * horseQueryIndexes.integration.test.mjs), and existence of the index is
 * the property this migration owns.
 */

import { describe, it, expect } from '@jest/globals';
import prisma from '../../packages/database/prismaClient.mjs';

// [table, index name, FK column] — names are Prisma's defaults for the
// @@index([...]) lines in schema.prisma, which the migration creates.
const EXPECTED = [
  ['shows', 'shows_createdByUserId_idx', 'createdByUserId'],
  ['ForumPost', 'ForumPost_threadId_idx', 'threadId'],
  ['DirectMessage', 'DirectMessage_senderId_idx', 'senderId'],
  ['DirectMessage', 'DirectMessage_recipientId_idx', 'recipientId'],
  ['ClubMembership', 'ClubMembership_userId_idx', 'userId'],
  ['horse_sales', 'horse_sales_horseId_idx', 'horseId'],
];

describe('foreign-key indexes (Equoria-bvddn.23)', () => {
  it.each(EXPECTED)('%s has %s as a single-column btree on "%s"', async (table, indexName, column) => {
    const rows = await prisma.$queryRaw`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = ${table} AND indexname = ${indexName}
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0].indexdef).toContain(`USING btree ("${column}")`);
  });
});
