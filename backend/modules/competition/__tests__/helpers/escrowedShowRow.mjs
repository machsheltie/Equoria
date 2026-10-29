/**
 * A Show row whose prize is held in escrow, for suites that build shows with
 * prisma.show.create instead of through createShow (Equoria-law5w).
 *
 * Owner ruling q52 (2026-10-23): a show pays its prizes only from escrow; the
 * executor no longer mints an unescrowed prize. A suite that needs a show to pay
 * therefore escrows the prize the way createShow does: SystemAccount[showEscrow]
 * is credited by the prize and Show.prizeEscrow holds it, in one transaction.
 * No player wallet is debited, so a suite's wallet assertions are unchanged.
 */

import { creditSystemAccount } from '../../../economy/index.mjs';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} data - prisma.show.create data; `prize` a whole number (0 escrows nothing).
 * @returns {Promise<object>} The created Show row.
 */
export async function createEscrowedShowRow(prisma, data) {
  if (!Number.isInteger(data.prize) || data.prize < 0) {
    throw new Error(`createEscrowedShowRow: prize ${data.prize} must be a whole number`);
  }
  if (data.prize === 0) {
    return prisma.show.create({ data: { ...data, prizeEscrow: 0 } });
  }
  return prisma.$transaction(async tx => {
    await creditSystemAccount(tx, 'showEscrow', data.prize, {
      category: 'showCreatePrizeEscrow',
      description: `Prize escrow for test show ${data.name}`,
    });
    return tx.show.create({ data: { ...data, prizeEscrow: data.prize } });
  });
}
