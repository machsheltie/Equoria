/**
 * Test teardown for shows whose escrow went through the real credit paths
 * (Equoria-r3mv2).
 *
 * createShow credits SystemAccount[showEscrow] with the prize, and every paid
 * entry credits it with the entry fee; only execution or settlement debits it
 * again. A suite that raw-deletes such a show leaves its remaining
 * prizeEscrow + feeEscrow behind as orphaned credit on the shared singleton.
 *
 * releaseShowEscrow(showIds) moves exactly that remaining escrow back out of
 * the singleton and zeroes the shows' escrow columns, in one transaction, so
 * the caller's delete leaves the singleton as it found it. A show that was
 * executed or settled holds no escrow and releases nothing.
 *
 * Use it ONLY for shows whose escrow columns were filled by a credit (the
 * create route, an entry, or a fixture that credits the singleton itself). A
 * fixture that writes prizeEscrow straight onto the row never credited the
 * singleton, and releasing it would drift the singleton the other way.
 *
 * Fail-loud: the debit throws if the singleton holds less than the escrow
 * being released, which means some fixture escrow was never credited.
 */

import prisma from '../../../packages/database/prismaClient.mjs';
import { debitSystemAccountOrThrow } from '../../modules/economy/index.mjs';

/** The SystemAccount row name createShow and entries credit. */
const showEscrowAccount = 'showEscrow';

/**
 * @param {number[]} showIds the shows this suite created
 * @returns {Promise<number>} the escrow released
 */
export async function releaseShowEscrow(showIds) {
  const ids = [...new Set(showIds)].filter(id => Number.isInteger(id));
  if (ids.length === 0) {
    return 0;
  }
  return prisma.$transaction(async tx => {
    const rows = await tx.$queryRaw`
      SELECT "id", "prizeEscrow", "feeEscrow" FROM "shows"
      WHERE "id" = ANY(${ids}::int[]) ORDER BY "id" FOR UPDATE`;
    const total = rows.reduce(
      (sum, row) => sum + Number(row.prizeEscrow) + Number(row.feeEscrow),
      0,
    );
    if (total > 0) {
      await debitSystemAccountOrThrow(tx, showEscrowAccount, total, {
        category: 'testTeardownEscrowRelease',
        description: 'Test teardown: release escrow of fixture shows',
      });
      await tx.show.updateMany({
        where: { id: { in: ids } },
        data: { prizeEscrow: 0, feeEscrow: 0 },
      });
    }
    return total;
  });
}
