/**
 * Keyset page reads of the marketplace sale browse and a player's sale history
 * (Equoria-cmw85.21, Equoria-cmw85.22), kept out of the controller so it stays
 * under the file-size ratchet.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { findKeysetPage, readKeysetParams } from '../../../utils/paginationHelper.mjs';

/**
 * One page of the sale browse, plus the total of the filter for a numbered-page
 * request. `cursor` continues a list; `skip` is the legacy page offset. A cursor
 * request does not pay for the count: the client already has the total.
 *
 * @param {{ where: object, sort: object[], pageSize: number, cursor?: string, skip: number }} spec
 * @returns {Promise<{ horses: object[], pageInfo: object, total: number|undefined }>}
 * @throws {InvalidCursorError}
 */
export async function findSaleListingsPage({ where, sort, pageSize, cursor, skip }) {
  const [{ items: horses, pageInfo }, total] = await Promise.all([
    findKeysetPage(args => prisma.horse.findMany(args), {
      where,
      sort,
      limit: pageSize,
      cursor,
      skip,
      extra: {
        include: {
          breed: { select: { name: true } },
          user: { select: { username: true } },
        },
      },
    }),
    cursor ? Promise.resolve(undefined) : prisma.horse.count({ where }),
  ]);
  return { horses, pageInfo, total };
}

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
