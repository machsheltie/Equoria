/**
 * Lineage Tree Service (Equoria-urqic.6 split from advancedLineageAnalysisService.mjs)
 *
 * Owns the pedigree-tree construction path: hierarchical tree build, the
 * batched ancestor pre-fetch (Equoria-a56gl / gakyp), the per-generation
 * organisation used as the shared lineage-data substrate by the diversity and
 * performance services, and the visualization-ready node/edge structure.
 *
 * `organizeByGenerations` is exported (not module-private) because the
 * diversity and performance siblings consume it to derive their inputs — it is
 * the canonical "lineageData" producer for the whole lineage-analysis cluster.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { asFlagArray, asFlagObject } from '../../../utils/jsonbArrayGuard.mjs';

/**
 * Generate hierarchical lineage tree structure
 * @param {number} stallionId - ID of the stallion
 * @param {number} mareId - ID of the mare
 * @param {number} maxGenerations - Maximum generations to trace
 * @returns {Object} Tree structure with nodes and relationships
 */
export async function generateLineageTree(stallionId, mareId, maxGenerations = 3) {
  logger.info(
    `[lineageTree.generateLineageTree] Generating tree for stallion ${stallionId} and mare ${mareId}, ${maxGenerations} generations`,
  );

  // Get the parent horses
  const [stallion, mare] = await Promise.all([
    prisma.horse.findUnique({
      where: { id: stallionId },
      include: {
        sire: true,
        dam: true,
        competitionResults: true,
      },
    }),
    prisma.horse.findUnique({
      where: { id: mareId },
      include: {
        sire: true,
        dam: true,
        competitionResults: true,
      },
    }),
  ]);

  if (!stallion || !mare) {
    logger.warn('[lineageTree.generateLineageTree] Missing parent horses');
    return {
      root: { stallion: null, mare: null },
      generations: [],
      totalHorses: 0,
      maxDepth: 0,
    };
  }

  // Equoria-a56gl: pre-fetch every ancestor reachable within maxGenerations
  // in ONE batched findMany. buildHorseNode now walks an in-memory map
  // instead of recursing into the DB — eliminates the O(2^gen) findUnique
  // tree-traversal that gakyp's organizeByGenerations fix did not cover.
  const ancestorIds = await collectAncestorIdsBFS(
    [stallion.sire?.id, stallion.dam?.id, mare.sire?.id, mare.dam?.id].filter(
      id => id !== undefined && id !== null,
    ),
    maxGenerations - 1, // root level is depth 0; we already have stallion+mare
  );
  const ancestorRows =
    ancestorIds.size > 0
      ? await prisma.horse.findMany({
          where: { id: { in: [...ancestorIds] } },
          include: { sire: true, dam: true, competitionResults: true },
        })
      : [];
  const ancestorById = new Map(ancestorRows.map(h => [h.id, h]));
  // Seed the map with the two roots so buildHorseNode can find them by id.
  ancestorById.set(stallion.id, stallion);
  ancestorById.set(mare.id, mare);

  const tree = {
    root: {
      stallion: buildHorseNode(stallion, 0, maxGenerations, ancestorById),
      mare: buildHorseNode(mare, 0, maxGenerations, ancestorById),
    },
    generations: [],
    totalHorses: 0,
    maxDepth: maxGenerations,
  };

  // Organize by generations
  tree.generations = await organizeByGenerations(stallionId, mareId, maxGenerations);
  tree.totalHorses = tree.generations.reduce((total, gen) => total + gen.horses.length, 0);

  logger.info(
    `[lineageTree.generateLineageTree] Generated tree with ${tree.totalHorses} horses across ${tree.generations.length} generations`,
  );
  return tree;
}

/**
 * Build individual horse node with parent relationships
 *
 * Equoria-a56gl: walk the pedigree tree from a pre-fetched ancestor map.
 *
 * Pre-fix: this function did `await prisma.horse.findUnique` per sire and
 * per dam at every depth — for a 4-gen pedigree that's 28 round-trips on
 * top of gakyp's still-2 root preconditions, so the hot path was O(2^gen).
 *
 * Post-fix: ancestors are batched by collectAncestorIdsBFS + a single
 * findMany before this is called. The function is now synchronous (no
 * awaits) and runs in O(nodes) with zero DB round-trips.
 *
 * `horse` is a row from `ancestorById` (always has `sire`/`dam` include
 * fields, possibly null), `ancestorById` is the prefetched map of every
 * reachable ancestor including the root pair. Self-loop guard via
 * `visited` so a malformed cycle in the pedigree can't infinite-recurse.
 * @param {Object} horse - Horse data from database
 * @param {number} currentDepth - Current generation depth
 * @param {number} maxDepth - Maximum depth to traverse
 * @param {Map} ancestorById - Prefetched ancestor map
 * @param {Set} visited - Cycle-guard set
 * @returns {Object} Horse node with parent relationships
 */
function buildHorseNode(horse, currentDepth, maxDepth, ancestorById, visited = new Set()) {
  if (!horse || currentDepth >= maxDepth) {
    return null;
  }
  if (visited.has(horse.id)) {
    return null; // self-referential pedigree — surface as a leaf
  }
  visited.add(horse.id);

  const node = {
    id: horse.id,
    name: horse.name,
    generation: currentDepth,
    stats: {
      // Equoria-qrb08: use `??` not `||` so legitimate stat-0 (undeveloped or
      // injured horse) is preserved instead of being silently boosted to 50,
      // which skews pedigree quality and breeding-recommendation calculations.
      speed: horse.speed ?? 50,
      stamina: horse.stamina ?? 50,
      agility: horse.agility ?? 50,
      intelligence: horse.intelligence ?? 50,
    },
    traits: {
      positive: asFlagArray(horse.positiveTraits),
      negative: asFlagArray(horse.negativeTraits),
      hidden: asFlagArray(horse.hiddenTraits),
    },
    disciplineScores: asFlagObject(horse.disciplineScores),
    competitionResults: horse.competitionResults || [],
    sire: null,
    dam: null,
  };

  if (horse.sire && currentDepth + 1 < maxDepth) {
    const sireData = ancestorById.get(horse.sire.id);
    if (sireData) {
      node.sire = buildHorseNode(sireData, currentDepth + 1, maxDepth, ancestorById, visited);
    }
  }

  if (horse.dam && currentDepth + 1 < maxDepth) {
    const damData = ancestorById.get(horse.dam.id);
    if (damData) {
      node.dam = buildHorseNode(damData, currentDepth + 1, maxDepth, ancestorById, visited);
    }
  }

  return node;
}

/**
 * Equoria-a56gl: BFS-collect all ancestor IDs reachable from `seedIds`
 * within `maxRemainingDepth` generations. Caller passes the IDs at depth-1
 * relative to the roots; this expands generation by generation, batching
 * the sire/dam lookups per level.
 *
 * The traversal de-dupes via the same `visited` Set used in
 * organizeByGenerations so inbred branches don't double-count.
 * @param {Array<number>} seedIds - Seed ancestor IDs at depth-1
 * @param {number} maxRemainingDepth - Remaining generations to expand
 * @returns {Promise<Set<number>>} Set of reachable ancestor IDs
 */
async function collectAncestorIdsBFS(seedIds, maxRemainingDepth) {
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
 * Organize lineage data by generations.
 *
 * This is the canonical "lineageData" producer consumed by the diversity and
 * performance siblings — exported (not module-private) so they can derive
 * their inputs from the same batched traversal.
 * @param {number} stallionId - Stallion ID
 * @param {number} mareId - Mare ID
 * @param {number} maxGenerations - Maximum generations
 * @returns {Array} Array of generation objects
 */
export async function organizeByGenerations(stallionId, mareId, maxGenerations) {
  const generations = [];
  const processed = new Set();
  let currentGeneration = [stallionId, mareId];

  for (let gen = 0; gen < maxGenerations && currentGeneration.length > 0; gen++) {
    // Filter out already-processed horses BEFORE issuing the batched
    // findMany so a duplicate parent (e.g., inbreeding where two siblings
    // share a sire) is only counted once across the whole pedigree.
    const toFetch = currentGeneration.filter(id => !processed.has(id));
    toFetch.forEach(id => processed.add(id));

    // Equoria-gakyp: batch the per-generation lookup into ONE findMany.
    // Pre-fix this was a per-horse findUnique loop — O(N) round-trips
    // where N is the total horse count across all generations. Post-fix
    // it is O(generations) round-trips, irrespective of horse count.
    // Map the result by id so the iteration below preserves the original
    // currentGeneration ordering (downstream callers depend on deterministic
    // ordering of horses within a generation).
    const fetched =
      toFetch.length > 0
        ? await prisma.horse.findMany({
            where: { id: { in: toFetch } },
            include: { competitionResults: true },
          })
        : [];
    const byId = new Map(fetched.map(h => [h.id, h]));

    const horses = [];
    const nextGeneration = [];

    for (const horseId of toFetch) {
      const horse = byId.get(horseId);
      if (!horse) {
        continue;
      }

      horses.push({
        id: horse.id,
        name: horse.name,
        sireId: horse.sireId,
        damId: horse.damId,
        stats: {
          // Equoria-qrb08: `??` preserves legitimate stat-0 instead of
          // silently boosting it to 50 (skews lineage stat averages).
          speed: horse.speed ?? 50,
          stamina: horse.stamina ?? 50,
          agility: horse.agility ?? 50,
          intelligence: horse.intelligence ?? 50,
        },
        traits: {
          positive: asFlagArray(horse.positiveTraits),
          negative: asFlagArray(horse.negativeTraits),
          hidden: asFlagArray(horse.hiddenTraits),
        },
        disciplineScores: asFlagObject(horse.disciplineScores),
        competitionResults: horse.competitionResults || [],
      });

      // Add parents to next generation
      if (horse.sireId) {
        nextGeneration.push(horse.sireId);
      }
      if (horse.damId) {
        nextGeneration.push(horse.damId);
      }
    }

    if (horses.length > 0) {
      generations.push({
        generation: gen,
        horses,
      });
    }

    currentGeneration = [...new Set(nextGeneration)]; // Remove duplicates
  }

  return generations;
}

/**
 * Create visualization-ready data structure
 * @param {number} stallionId - Stallion ID
 * @param {number} mareId - Mare ID
 * @param {number} maxGenerations - Maximum generations
 * @returns {Object} Visualization data structure
 */
export async function createVisualizationData(stallionId, mareId, maxGenerations = 3) {
  logger.info(
    `[lineageTree.createVisualizationData] Creating visualization for stallion ${stallionId} and mare ${mareId}`,
  );

  const tree = await generateLineageTree(stallionId, mareId, maxGenerations);
  const nodes = [];
  const edges = [];

  // Convert tree to nodes and edges
  function processNode(horse, generation, parentId = null, relationship = null) {
    if (!horse) {
      return;
    }

    const nodeId = `horse_${horse.id}`;

    // Add node
    nodes.push({
      id: nodeId,
      name: horse.name,
      generation,
      position: {
        x: generation * 200,
        y: nodes.filter(n => n.generation === generation).length * 100,
      },
      stats: horse.stats,
      traits: horse.traits,
      disciplineScores: asFlagObject(horse.disciplineScores),
      type: 'horse',
    });

    // Add edge to parent
    if (parentId && relationship) {
      edges.push({
        from: nodeId,
        to: parentId,
        relationship,
        type: 'lineage',
      });
    }

    // Process children
    if (horse.sire) {
      processNode(horse.sire, generation + 1, nodeId, 'sire');
    }
    if (horse.dam) {
      processNode(horse.dam, generation + 1, nodeId, 'dam');
    }
  }

  // Process both parent trees
  if (tree.root.stallion) {
    processNode(tree.root.stallion, 0);
  }
  if (tree.root.mare) {
    processNode(tree.root.mare, 0);
  }

  return {
    nodes,
    edges,
    layout: {
      type: 'hierarchical',
      dimensions: {
        width: maxGenerations * 200,
        height: Math.max(nodes.length * 50, 400),
      },
    },
    metadata: {
      totalHorses: nodes.length,
      maxGenerations,
      createdAt: new Date().toISOString(),
    },
  };
}
