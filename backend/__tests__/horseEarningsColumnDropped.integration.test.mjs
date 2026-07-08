/**
 * Horse.earnings column drop sentinel (Equoria-8nmxm).
 *
 * Asserts the dead Horse.earnings (Decimal) column is gone from the live
 * schema and that the canonical Horse.totalEarnings (Int) column exists.
 *
 * A regression that re-adds the Decimal column OR changes totalEarnings away
 * from an integer column fails this test.
 *
 * Equoria-709qm (slice 2): the former third assertion exercised the legacy
 * writer updateHorseEarnings (increments totalEarnings). That writer was a
 * non-ledger money/earnings writer with zero production consumers (the live
 * competition path — competitionAwards.mjs, oey96.4 — deliberately does NOT
 * write totalEarnings; that gap is the separate Equoria-xal4m), so it was
 * removed alongside the other legacy money writers. The two STRUCTURAL column
 * guards below are schema-level and independent of any writer, so they remain
 * (and no longer need a horse/user fixture — they read information_schema only).
 *
 * Real DB, no fixtures needed (pure schema introspection).
 */

import { describe, it, expect } from '@jest/globals';
import prisma from '../../packages/database/prismaClient.mjs';

describe('Horse.earnings column drop (Equoria-8nmxm)', () => {
  it('STRUCTURAL: Horse.earnings column no longer exists in the live schema', async () => {
    const rows = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'horses'
        AND column_name = 'earnings'
    `;
    expect(rows).toHaveLength(0);
  });

  it('STRUCTURAL: Horse.totalEarnings column DOES exist (the canonical one)', async () => {
    const rows = await prisma.$queryRaw`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'horses'
        AND column_name = 'totalEarnings'
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0].data_type).toBe('integer');
  });
});
