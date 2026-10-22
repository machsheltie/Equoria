/**
 * Shared batched pedigree walker (Equoria-cmw85.3).
 *
 * The one place that walks a horse's ancestry through the database. Every walk
 * issues ONE `findMany` per generation — never one query per ancestor — so the
 * round-trip count is bounded by the number of generations, not by the (2^n)
 * size of the pedigree.
 *
 * Origin: `collectAncestorIdsBFS` was introduced in lineageTree.mjs
 * (Equoria-a56gl / gakyp); inbreedingAnalysis.getLineage still used a
 * per-ancestor `findUnique` loop. Both now use this module.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';

/**
 * BFS-collect all ancestor IDs reachable from `seedIds` within
 * `maxRemainingDepth` generations. Caller passes the IDs at depth-1 relative to
 * the roots; this expands generation by generation, batching the sire/dam
 * lookups per level. Inbred branches are de-duplicated by the visited Set.
 * @param {Array<number>} seedIds - Seed ancestor IDs at depth-1
 * @param {number} maxRemainingDepth - Remaining generations to expand
 * @returns {Promise<Set<number>>} Set of reachable ancestor IDs
 */
export async function collectAncestorIdsBFS(seedIds, maxRemainingDepth) {
  const visited = new Set();
  let frontier = [...new Set(seedIds)];
  for (let depth = 0; depth < maxRemainingDepth && frontier.length > 0; depth++) {
    const toFetch = frontier.filter(id => !visited.has(id));
    toFetch.forEach(id => visited.add(id));
    if (toFetch.length === 0) {
      break;
    }
    const rows = await prisma.horse.findMany({
      where: { id: { in: toFetch } },
      select: { id: true, sireId: true, damId: true },
    });
    const nextFrontier = [];
    for (const r of rows) {
      if (r.sireId && !visited.has(r.sireId)) {
        nextFrontier.push(r.sireId);
      }
      if (r.damId && !visited.has(r.damId)) {
        nextFrontier.push(r.damId);
      }
    }
    frontier = [...new Set(nextFrontier)];
  }
  return visited;
}

/**
 * Walk one horse's pedigree up to `generations` generations (the root is
 * generation 0, so `generations: 5` reaches great-great-grandparents).
 *
 * Each ancestor appears once, at its first breadth-first visit (sire before
 * dam), carrying the sire/dam path that reached it. Horses that do not exist
 * are skipped.
 * @param {number} horseId - Root horse
 * @param {number} generations - Number of generations to include
 * @returns {Promise<Array<{id:number,name:string,path:string[],generation:number}>>}
 */
export async function walkPedigree(horseId, generations) {
  const lineage = [];
  const processed = new Set();
  let level = [{ id: horseId, path: [] }];

  for (let generation = 0; generation < generations && level.length > 0; generation++) {
    // First breadth-first visit wins: later duplicates (inbred branches, or an
    // id already seen in an earlier generation) are dropped before the fetch.
    const entries = level.filter(({ id }) => {
      if (processed.has(id)) {
        return false;
      }
      processed.add(id);
      return true;
    });
    const rows = entries.length
      ? await prisma.horse.findMany({
          where: { id: { in: entries.map(entry => entry.id) } },
          select: { id: true, name: true, sireId: true, damId: true },
        })
      : [];
    const byId = new Map(rows.map(row => [row.id, row]));

    const nextLevel = [];
    for (const { id, path } of entries) {
      const horse = byId.get(id);
      if (!horse) {
        continue;
      }
      lineage.push({ id: horse.id, name: horse.name, path: [...path], generation });
      if (horse.sireId && generation + 1 < generations) {
        nextLevel.push({ id: horse.sireId, path: [...path, 'sire'] });
      }
      if (horse.damId && generation + 1 < generations) {
        nextLevel.push({ id: horse.damId, path: [...path, 'dam'] });
      }
    }
    level = nextLevel;
  }

  return lineage;
}
