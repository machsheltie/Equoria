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
 * FoalActivity stream-source discriminators (Equoria-8yhe3).
 *
 * The FoalActivity table has TWO writers that are DISJOINT BY DESIGN
 * (Equoria-2emg / 8yhe3 — unifying them was explicitly rejected as
 * data-corrupting):
 *   - GROOM_INTERACTION: groomController.recordInteraction. This is the ONLY
 *     stream that drives the Horse.taskLog count cache (trait/milestone/streak
 *     evaluators read those counts on a hot path).
 *   - ENRICHMENT_ACTIVITY: foalModel.completeActivity (legacy foal-development
 *     enrichment-day system). It does NOT touch taskLog.
 *
 * Before 8yhe3 the disjointness was an UNENFORCED activityType naming
 * convention: deriveTaskCountsFromActivities did a blind groupBy(activityType)
 * with no source filter, so if an enrichment activityType ever collided with a
 * groom interactionType the enrichment rows would inflate that taskLog key via
 * the reconcile Math.max merge (a double-count vector into trait-driving
 * counts). The `source` column now ENFORCES the separation: the derivation
 * counts ONLY groom-source rows, so an enrichment row CANNOT be counted
 * regardless of any activityType-namespace collision.
 */
export const FOAL_ACTIVITY_SOURCE = Object.freeze({
  GROOM_INTERACTION: 'groom_interaction',
  ENRICHMENT_ACTIVITY: 'enrichment_activity',
});

/**
 * Derive the per-task count map for a foal directly from the canonical
 * FoalActivity event log. This is the authoritative `{taskName: count}`
 * shape — identical in structure to Horse.taskLog — but computed from rows
 * rather than read from the JSONB cache.
 *
 * ONLY groom-interaction-source rows are counted (Equoria-8yhe3). Legacy rows
 * written before the `source` column existed have source = NULL; those are
 * treated as groom-source because recordInteraction was the only canonical
 * writer that fed taskLog pre-8yhe3 (the enrichment writer never touched
 * taskLog). Enrichment-source rows are EXCLUDED by construction so they can
 * never inflate a taskLog count.
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
    where: {
      foalId: parsedFoalId,
      // ENFORCEMENT: count only the groom-interaction stream. NULL = legacy
      // pre-8yhe3 row, which can only be groom-origin (the sole canonical
      // taskLog-feeding writer before this column). Enrichment-source rows are
      // excluded so a namespace collision cannot corrupt the count.
      OR: [
        { source: FOAL_ACTIVITY_SOURCE.GROOM_INTERACTION },
        { source: null },
      ],
    },
    _count: { _all: true },
  });

  const counts = {};
  for (const row of grouped) {
    counts[row.activityType] = row._count._all;
  }
  return counts;
}

/**
 * Derive the total task count for a foal from the canonical event log.
 * Equivalent to getTotalTaskCount(taskLog) but sourced from rows.
 *
 * Source-scoped to the groom stream (Equoria-8yhe3) — the SAME filter as
 * deriveTaskCountsFromActivities. This keeps the documented invariant honest:
 * the taskLog cache is groom-only, so its total must equal the count of
 * groom-source (incl. legacy NULL-source) rows, NOT all FoalActivity rows.
 * Counting enrichment rows here would break the no-double-count invariant the
 * moment a foal carried both streams.
 *
 * @param {number} foalId - Foal (Horse) id
 * @returns {Promise<number>} total groom-stream FoalActivity rows for the foal
 */
export async function deriveTotalActivityCount(foalId) {
  const parsedFoalId = parseInt(foalId, 10);
  if (Number.isNaN(parsedFoalId) || parsedFoalId <= 0) {
    throw new Error('Foal ID must be a positive integer');
  }
  return prisma.foalActivity.count({
    where: {
      foalId: parsedFoalId,
      OR: [{ source: FOAL_ACTIVITY_SOURCE.GROOM_INTERACTION }, { source: null }],
    },
  });
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
  FOAL_ACTIVITY_SOURCE,
  deriveTaskCountsFromActivities,
  deriveTotalActivityCount,
  reconcileTaskLogFromActivities,
};
