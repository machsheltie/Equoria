/**
 * Shared walk for the keyset-pagination integration tests (Equoria-cmw85.20/.21/.22).
 *
 * Follows `nextCursor` page by page, calling `afterFirstPage` once (the test
 * inserts rows tied on the sort key there, the exact write that makes OFFSET
 * paging skip or repeat rows), and returns every id seen in order.
 *
 * @param {{
 *   fetchPage: (cursor: string|undefined) => Promise<object>,
 *   idsOf: (body: object) => number[],
 *   pageInfoOf: (body: object) => { nextCursor: string|null, hasMore: boolean },
 *   afterFirstPage?: () => Promise<void>,
 *   maxPages?: number,
 * }} spec
 * @returns {Promise<{ ids: number[], pages: number, sizes: number[] }>}
 */
export async function walkPages({ fetchPage, idsOf, pageInfoOf, afterFirstPage, maxPages = 20 }) {
  const ids = [];
  const sizes = [];
  let cursor;
  let pages = 0;
  do {
    const body = await fetchPage(cursor);
    const pageIds = idsOf(body);
    ids.push(...pageIds);
    sizes.push(pageIds.length);
    const info = pageInfoOf(body);
    if (info.hasMore !== Boolean(info.nextCursor)) {
      throw new Error('pageInfo.hasMore disagrees with pageInfo.nextCursor');
    }
    cursor = info.nextCursor ?? undefined;
    pages += 1;
    if (pages === 1 && afterFirstPage) {
      await afterFirstPage();
    }
  } while (cursor && pages < maxPages);
  return { ids, pages, sizes };
}
