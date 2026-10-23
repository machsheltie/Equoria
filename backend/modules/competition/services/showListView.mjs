/**
 * showListView.mjs (Equoria-fyoca)
 *
 * The one owner of the shape GET /api/v1/competition sends for each open show.
 * The Arena list reads `date`, `prizePool` and the entry counts; a raw Show row
 * carries `runDate`, `prize` and no counts, so every card showed no date, a zero
 * prize and no field size. Reads are scoped DTOs built here, never raw rows.
 */

/**
 * A listed show for the Arena. `currentEntries` is the real number of entries on
 * the show. `maxEntries` is present only when the show has a cap: entries are
 * unlimited by default (showController), and an uncapped show reports no ceiling
 * rather than a fabricated one.
 *
 * @param {object} show A Show row read with `_count: { select: { entries: true } }`.
 * @returns {object}
 */
export function toShowListItem(show) {
  const item = {
    id: show.id,
    name: show.name,
    description: show.description ?? undefined,
    discipline: show.discipline,
    showType: show.showType,
    status: show.status,
    levelMin: show.levelMin,
    levelMax: show.levelMax,
    entryFee: show.entryFee,
    prizePool: show.prize,
    date: show.runDate,
    runDate: show.runDate,
    openDate: show.openDate,
    closeDate: show.closeDate,
    hostUserId: show.hostUserId,
    currentEntries: show._count?.entries ?? 0,
  };
  if (show.maxEntries !== null && show.maxEntries !== undefined) {
    item.maxEntries = show.maxEntries;
  }
  return item;
}
