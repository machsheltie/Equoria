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
 * the show. There is no ceiling: owner ruling q339 (2026-11-03), shows have no
 * entry cap, ever.
 *
 * @param {object} show A Show row read with `_count: { select: { entries: true } }`.
 * @returns {object}
 */
export function toShowListItem(show) {
  return {
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
}
