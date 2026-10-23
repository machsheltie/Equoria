/**
 * backfill-user-levels.mjs (Equoria-smqn7)
 *
 * One-off, idempotent backfill for the player level curve. Owner decision
 * 2026-07-07 (option A): level = floor(xp / 100) + 1. Before this change the
 * stored curve lagged one level behind from 100 xp on (level 1 spanned 0-199).
 *
 * This script sets User.level to floor(xp / 100) + 1 ONLY where that RAISES the
 * stored level. A player's level never drops: a stored level already at or above
 * the curve is left alone. A second run finds nothing to raise and writes nothing.
 *
 * Default is a DRY RUN. Writes happen only with --apply, and then as one
 * transaction, so a failure part-way leaves every level as it was.
 *
 * Usage (never run against production without the owner's say-so):
 *   node backend/scripts/backfill-user-levels.mjs            # dry run, prints counts
 *   node backend/scripts/backfill-user-levels.mjs --apply    # raises levels
 */

import { fileURLToPath } from 'node:url';
import prisma from '../../packages/database/prismaClient.mjs';
import { levelForXp } from '../modules/users/index.mjs';

/**
 * The accounts whose stored level is below the curve, read in id order.
 * The curve itself is `levelForXp`; it is applied here, not repeated in SQL.
 */
async function findBehindCurve(db, scope) {
  const rows = await db.user.findMany({
    where: scope,
    select: { id: true, xp: true, level: true },
    orderBy: { id: 'asc' },
  });
  return rows
    .map(row => ({ ...row, target: levelForXp(row.xp) }))
    .filter(row => row.target > row.level);
}

/**
 * Raise every player whose level is below the curve.
 *
 * @param {{ dryRun?: boolean, db?: object, userIds?: string[] }} [options] dryRun
 *   defaults to true; db is a prisma client (its $transaction is used for the
 *   write); userIds limits the run to those accounts (the tests use it so they
 *   only touch rows they own; the command line always runs on everyone).
 * @returns {Promise<{ dryRun: boolean, scanned: number, behind: number, raised: number }>}
 */
export async function backfillUserLevels({ dryRun = true, db = prisma, userIds } = {}) {
  const scope = userIds ? { id: { in: userIds } } : {};
  const scanned = await db.user.count({ where: scope });
  if (dryRun) {
    const behind = await findBehindCurve(db, scope);
    return { dryRun: true, scanned, behind: behind.length, raised: 0 };
  }
  return db.$transaction(
    async tx => {
      const behind = await findBehindCurve(tx, scope);
      let raised = 0;
      for (const row of behind) {
        // Conditional on the level read above: a concurrent award that already
        // raised it further makes this a no-op, so the level can never drop.
        const { count } = await tx.user.updateMany({
          where: { id: row.id, level: { lt: row.target } },
          data: { level: row.target },
        });
        raised += count;
      }
      return { dryRun: false, scanned, behind: behind.length, raised };
    },
    { timeout: 120_000 },
  );
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  const result = await backfillUserLevels({ dryRun });
  process.stdout.write(
    `backfill-user-levels (${dryRun ? 'dry run, nothing written' : 'applied'}): ` +
      `scanned ${result.scanned}, below the curve ${result.behind}, raised ${result.raised}\n`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
    .catch(error => {
      process.stderr.write(`backfill-user-levels failed: ${error.message}\n`);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
