/**
 * Foal Activity Store — canonical derivation layer (Equoria-2emg)
 *
 * 🎯 PURPOSE:
 * FoalActivity table rows are the SINGLE SOURCE OF TRUTH for foal-activity
 * events (the user game-design decision: "FoalActivity canonical"). The
 * Horse.taskLog JSONB `{taskName: count}` map is a DERIVED O(1) count cache —
 * its values must always equal an aggregate count over FoalActivity rows for
 * the same foal.
 *
 * This module provides the canonical aggregate-derivation so any consumer that
 * needs counts can derive them from the event log instead of trusting the
 * cache, and so an invariant test can assert cache == derived.
 *
 * 📋 WHY taskLog IS KEPT (not dropped):
 * The trait / milestone / streak evaluators (traitEvaluation.mjs,
 * foalTaskLogManager.mjs, horseAgingSystem.mjs) read counts on a hot path and
 * cannot afford an aggregate query per check. taskLog stays as the read cache;
 * FoalActivity is the authoritative log it must agree with. See Equoria-2emg
 * bd notes for the full rationale (incl. why literal "rebuild taskLog from
 * FoalActivity" was rejected as data-corrupting — taskLog counts come from
 * groom interactions, a disjoint event stream from legacy enrichment
 * activities, so a naive rebuild would zero out trait-driving counts).
 *
 * 🔧 INTEGRATION:
 * - prisma.foalActivity rows: { foalId, day, activityType, outcome, ... }
 * - Derived count for a task = COUNT(*) WHERE foalId=? AND activityType=task
 */

import prisma from '../../packages/database/prismaClient.mjs';
import logger from './logger.mjs';

/**
 * Derive the per-task count map for a foal directly from the canonical
 * FoalActivity event log. This is the authoritative `{taskName: count}`
 * shape — identical in structure to Horse.taskLog — but computed from rows
 * rather than read from the JSONB cache.
 *
 * @param {number} foalId - Foal (Horse) id
 * @returns {Promise<Object>} `{ taskName: count }` derived from FoalActivity
 */
export async function deriveTaskCountsFromActivities(foalId) {
  const parsedFoalId = parseInt(foalId, 10);
  if (Number.isNaN(parsedFoalId) || parsedFoalId <= 0) {
    throw new Error('Foal ID must be a positive integer');
  }

  const grouped = await prisma.foalActivity.groupBy({
    by: ['activityType'],
    where: { foalId: parsedFoalId },
    _count: { _all: true },
  });

  const counts = {};
  for (const row of grouped) {
    counts[row.activityType] = row._count._all;
  }
  return counts;
}

/**
 * Derive the total activity count for a foal from the canonical event log.
 * Equivalent to getTotalTaskCount(taskLog) but sourced from rows.
 *
 * @param {number} foalId - Foal (Horse) id
 * @returns {Promise<number>} total FoalActivity rows for the foal
 */
export async function deriveTotalActivityCount(foalId) {
  const parsedFoalId = parseInt(foalId, 10);
  if (Number.isNaN(parsedFoalId) || parsedFoalId <= 0) {
    throw new Error('Foal ID must be a positive integer');
  }
  return prisma.foalActivity.count({ where: { foalId: parsedFoalId } });
}

/**
 * Reconcile the Horse.taskLog cache from the canonical FoalActivity log for
 * a single foal. Idempotent: running it repeatedly yields the same taskLog.
 * Scoped to one foal id only (CLAUDE.md §2 — no broad writes).
 *
 * This is the scoped, idempotent backfill primitive. It does NOT delete or
 * touch any row other than the one Horse row identified by `foalId`, and it
 * only ever recomputes the JSONB cache to match the event log.
 *
 * @param {number} foalId - Foal (Horse) id
 * @returns {Promise<{foalId:number, before:Object, after:Object, changed:boolean}>}
 */
export async function reconcileTaskLogFromActivities(foalId) {
  const parsedFoalId = parseInt(foalId, 10);
  if (Number.isNaN(parsedFoalId) || parsedFoalId <= 0) {
    throw new Error('Foal ID must be a positive integer');
  }

  const horse = await prisma.horse.findUnique({
    where: { id: parsedFoalId },
    select: { id: true, taskLog: true },
  });
  if (!horse) {
    throw new Error(`Horse ${parsedFoalId} not found`);
  }

  const before =
    horse.taskLog !== null &&
    horse.taskLog !== undefined &&
    typeof horse.taskLog === 'object' &&
    !Array.isArray(horse.taskLog)
      ? horse.taskLog
      : {};

  const derived = await deriveTaskCountsFromActivities(parsedFoalId);

  // Merge: the derived event-log counts are authoritative for the keys they
  // cover. Legacy taskLog keys that have NO FoalActivity rows (pre-Equoria-2emg
  // groom-interaction history with no canonical row) are PRESERVED — see
  // Equoria-2emg bd notes "historical derivation tolerates the gap". Removing
  // them would lose trait/milestone-driving counts. The reconcile only ever
  // raises a cached count up to the canonical floor; it never silently drops a
  // legacy count it cannot reconstruct.
  const after = { ...before };
  for (const [task, count] of Object.entries(derived)) {
    after[task] = Math.max(before[task] || 0, count);
  }

  const changed = JSON.stringify(before) !== JSON.stringify(after);
  if (changed) {
    await prisma.horse.update({
      where: { id: parsedFoalId },
      data: { taskLog: after },
    });
    logger.info(
      `[foalActivityStore.reconcileTaskLogFromActivities] Reconciled taskLog for foal ${parsedFoalId}`,
    );
  }

  return { foalId: parsedFoalId, before, after, changed };
}

export default {
  deriveTaskCountsFromActivities,
  deriveTotalActivityCount,
  reconcileTaskLogFromActivities,
};
