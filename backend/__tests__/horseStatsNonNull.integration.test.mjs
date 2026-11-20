/**
 * Horse stat columns NOT NULL (Equoria-507mt).
 *
 * Asserts the 19 Horse stat / counter columns made non-null by migration
 * 20260530130000_507mt_horse_stats_nonnull are still enforced at the DB
 * layer.
 *
 * Companion bond default decision (per user): unbonded (0), not neutral (50).
 *
 * A regression that drops the NOT NULL on any of the 19 columns fails this
 * test.
 */

import { describe, it, expect } from '@jest/globals';
import prisma from '../../packages/database/prismaClient.mjs';

const targetColumns = [
  'precision',
  'strength',
  'speed',
  'agility',
  'endurance',
  'intelligence',
  'stamina',
  'balance',
  'boldness',
  'flexibility',
  'obedience',
  'focus',
  'totalEarnings',
  'bondScore',
  'daysGroomedInARow',
  'consecutiveDaysFoalCare',
  'horseXp',
  'availableStatPoints',
];

describe('Horse stat columns NOT NULL (Equoria-507mt)', () => {
  it('STRUCTURAL: all 19 target columns are is_nullable = NO in the live DB', async () => {
    const rows = await prisma.$queryRaw`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'horses'
        AND column_name = ANY(${targetColumns}::text[])
      ORDER BY column_name
    `;
    expect(rows).toHaveLength(targetColumns.length);
    for (const r of rows) {
      expect(r.is_nullable).toBe('NO');
    }
  });
});
