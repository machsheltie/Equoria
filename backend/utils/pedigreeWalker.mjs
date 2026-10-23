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
 * per-ancestor `findUnique` loop. Both now use this module, as do the
 * population/pair-search inbreeding analyses (Equoria-cmw85.4, cmw85.5) and the
 * foal lineage (cmw85.13). It lives in utils/ because breeding and horses
 * both consume it and neither may import the other's internals.
 */

import prisma from '../../packages/database/prismaClient.mjs';

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
 * Fetch the pedigree graph reachable from `rootIds` within `generations`
 * generations (the roots are generation 0): ONE `findMany` per generation for
 * the whole set of roots, however many roots there are (Equoria-cmw85.4,
 * cmw85.5, cmw85.13). A caller that needs many horses' pedigrees (a whole
 * collection, every stallion and mare of a herd) fetches the union once and
 * reads each pedigree out of the returned map with {@link walkPedigreeInGraph}.
 *
 * An id is fetched once, at the first generation any root reaches it; a root
 * reaches it no later than that, so every row a root's own walk needs is here.
 *
 * @param {Array<number>} rootIds
 * @param {number} generations
 * @param {Object<string, true>} [extraSelect] - further horse columns to read per row
 * @returns {Promise<Map<number, {id:number,name:string,sireId:number|null,damId:number|null}>>}
 */
export async function fetchPedigreeGraph(rootIds, generations, extraSelect = {}) {
  const graph = new Map();
  const seen = new Set();
  let frontier = [...new Set(rootIds)];
  for (let generation = 0; generation < generations && frontier.length > 0; generation++) {
    const toFetch = frontier.filter(id => !seen.has(id));
    toFetch.forEach(id => seen.add(id));
    if (toFetch.length === 0) {
      break;
    }
    const rows = await prisma.horse.findMany({
      where: { id: { in: toFetch } },
      select: { id: true, name: true, sireId: true, damId: true, ...extraSelect },
    });
    const next = [];
    for (const row of rows) {
      graph.set(row.id, row);
      if (row.sireId) {
        next.push(row.sireId);
      }
      if (row.damId) {
        next.push(row.damId);
      }
    }
    frontier = [...new Set(next)];
  }
  return graph;
}

/**
 * Walk one horse's pedigree up to `generations` generations (the root is
 * generation 0, so `generations: 5` reaches great-great-grandparents) through
 * an already-fetched graph. Pure: no queries.
 *
 * Each ancestor appears once, at its first breadth-first visit (sire before
 * dam), carrying the sire/dam path that reached it. Horses that do not exist
 * (absent from the graph) are skipped.
 * @param {Map<number, {id:number,name:string,sireId:number|null,damId:number|null}>} graph
 * @param {number} horseId - Root horse
 * @param {number} generations - Number of generations to include
 * @returns {Array<{id:number,name:string,path:string[],generation:number}>}
 */
export function walkPedigreeInGraph(graph, horseId, generations) {
  return walkPedigreesInGraph(graph, [horseId], generations);
}

/**
 * {@link walkPedigreeInGraph} for several roots sharing one breadth-first pass:
 * all roots are generation 0 (in the order given), their parents generation 1,
 * and so on, each horse once at its first visit (a pair's sire and dam, for
 * the foal lineage). Roots that are null are ignored.
 * @param {Map<number, object>} graph
 * @param {Array<number|null>} rootIds
 * @param {number} generations
 * @returns {Array<{id:number,name:string,path:string[],generation:number}>}
 */
export function walkPedigreesInGraph(graph, rootIds, generations) {
  const lineage = [];
  const processed = new Set();
  let level = rootIds.filter(id => id !== null && id !== undefined).map(id => ({ id, path: [] }));

  for (let generation = 0; generation < generations && level.length > 0; generation++) {
    // First breadth-first visit wins: later duplicates (inbred branches, or an
    // id already seen in an earlier generation) are dropped.
    const entries = level.filter(({ id }) => {
      if (processed.has(id)) {
        return false;
      }
      processed.add(id);
      return true;
    });

    const nextLevel = [];
    for (const { id, path } of entries) {
      const horse = graph.get(id);
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

/**
 * Walk one horse's pedigree through the database: one `findMany` per
 * generation. See {@link walkPedigreeInGraph} for the shape returned.
 * @param {number} horseId - Root horse
 * @param {number} generations - Number of generations to include
 * @returns {Promise<Array<{id:number,name:string,path:string[],generation:number}>>}
 */
export async function walkPedigree(horseId, generations) {
  return walkPedigreeInGraph(
    await fetchPedigreeGraph([horseId], generations),
    horseId,
    generations,
  );
}
