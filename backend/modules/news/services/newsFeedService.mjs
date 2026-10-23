/**
 * The players' News feed (Equoria-wbt8l): published entries, newest first.
 *
 * "Published" means publishAt has arrived. A seasonal event written ahead of
 * time stays out of the feed until the start of the 1st of its month.
 *
 * Paging is by cursor over (publishAt, id), both descending, so entries
 * posted in the same instant (a nightly batch) keep a stable order and a
 * page boundary never repeats or skips one. The first page also carries
 * "Ahead": published entries whose endsAt is still in the future (polls that
 * close, contests that close, the month's event), soonest first.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { gameDateKey } from '../../../utils/gameTime.mjs';
import { toNewsItemDto } from './newsItemShape.mjs';

export const NEWS_PAGE_SIZE = 30;
export const NEWS_PAGE_SIZE_MAX = 50;
const AHEAD_LIMIT = 12;

/** A cursor is "<publishAt epoch ms>.<id>" of the last entry on a page. */
export const NEWS_CURSOR_PATTERN = /^\d{1,15}\.\d{1,10}$/;

/**
 * @param {string} cursor - already matched against NEWS_CURSOR_PATTERN
 * @returns {{ publishAt: Date, id: number }}
 */
function parseCursor(cursor) {
  const [ms, id] = cursor.split('.');
  return { publishAt: new Date(Number(ms)), id: Number(id) };
}

/**
 * @param {{ cursor?: string|null, limit?: number, now?: Date }} [options]
 */
export async function listPublishedNews({
  cursor = null,
  limit = NEWS_PAGE_SIZE,
  now = new Date(),
} = {}) {
  const take = Math.min(Math.max(1, limit), NEWS_PAGE_SIZE_MAX);
  const where = { publishAt: { lte: now } };
  if (cursor) {
    const after = parseCursor(cursor);
    where.OR = [
      { publishAt: { lt: after.publishAt } },
      { publishAt: after.publishAt, id: { lt: after.id } },
    ];
  }

  const rows = await prisma.newsItem.findMany({
    where,
    orderBy: [{ publishAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
  });
  const page = rows.slice(0, take);
  const last = page[page.length - 1];
  const nextCursor = rows.length > take && last ? `${last.publishAt.getTime()}.${last.id}` : null;

  const ahead = cursor
    ? null
    : await prisma.newsItem.findMany({
        where: { publishAt: { lte: now }, endsAt: { gt: now } },
        orderBy: [{ endsAt: 'asc' }, { id: 'asc' }],
        take: AHEAD_LIMIT,
      });

  return {
    today: gameDateKey(now),
    items: page.map(toNewsItemDto),
    nextCursor,
    ahead: ahead ? ahead.map(toNewsItemDto) : null,
  };
}
