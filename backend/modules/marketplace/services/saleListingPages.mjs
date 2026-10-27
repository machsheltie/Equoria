/**
 * Keyset page read of a player's sale history (Equoria-cmw85.22), kept out of the
 * controller so it stays under the file-size ratchet.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { findKeysetPage, readKeysetParams } from '../../../utils/paginationHelper.mjs';

/**
 * One page of a player's buy and sell history: newest sale first, ties by id,
 * 100 per page (default and maximum).
 *
 * @param {string} userId
 * @param {Record<string, unknown>} query - req.query
 * @returns {Promise<{ sales: object[], pageInfo: object }>}
 * @throws {InvalidCursorError}
 */
export async function findSaleHistoryPage(userId, query) {
  const { limit, cursor, skip } = readKeysetParams(query, { def: 100, max: 100 });
  const { items: sales, pageInfo } = await findKeysetPage(args => prisma.horseSale.findMany(args), {
    where: { OR: [{ sellerId: userId }, { buyerId: userId }] },
    sort: [
      { key: 'soldAt', dir: 'desc', type: 'date' },
      { key: 'id', dir: 'desc', type: 'int' },
    ],
    limit,
    cursor,
    skip,
    extra: {
      include: {
        seller: { select: { username: true } },
        buyer: { select: { username: true } },
      },
    },
  });
  return { sales, pageInfo };
}
