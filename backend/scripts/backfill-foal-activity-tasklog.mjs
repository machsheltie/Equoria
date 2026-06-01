/**
 * backfill-foal-activity-tasklog.mjs (Equoria-2emg)
 *
 * One-shot, idempotent script that reconciles every horse's Horse.taskLog
 * count cache against the canonical FoalActivity event log.
 *
 * Background — game-design decision "FoalActivity canonical" (Equoria-2emg):
 * FoalActivity rows are the single source of truth for foal-activity events.
 * Horse.taskLog is a derived O(1) count cache. Before Equoria-2emg, the
 * groom-interaction path wrote ONLY GroomInteraction + the taskLog JSONB
 * counter and never emitted a canonical FoalActivity row, so the cache and
 * the event log could diverge. The recordInteraction path now co-writes the
 * canonical row going forward; this script closes the gap for any foal whose
 * cache is below its canonical floor.
 *
 * Reconcile semantics (see foalActivityStore.reconcileTaskLogFromActivities):
 *   - For each task key present in FoalActivity, raise the cached count up to
 *     the canonical floor (Math.max(cached, derived)).
 *   - Legacy taskLog keys with NO FoalActivity rows (pre-Equoria-2emg
 *     groom-interaction history) are PRESERVED — historical derivation
 *     tolerates the gap (Equoria-2emg bd notes). The cache is never silently
 *     reduced; trait/milestone-driving counts are not lost.
 *
 * Idempotent: a second run finds cache == canonical floor for all rows and
 * writes nothing.
 *
 * Per CLAUDE.md Rule 2 (REAL DB ONLY): runs against the canonical Equoria DB
 * with an explicit per-horse loop. Every write is scoped to a single horse ID
 * via reconcileTaskLogFromActivities — no raw updateMany / deleteMany.
 *
 * Usage:
 *   node backend/scripts/backfill-foal-activity-tasklog.mjs --print-only
 *   node backend/scripts/backfill-foal-activity-tasklog.mjs
 *
 * Flags:
 *   --print-only   Dry-run: report which foals WOULD change; no writes.
 *   --limit N      Only process the first N horses (debugging convenience).
 *   --quiet        Suppress per-horse logs; only print summary.
 */

import prisma from '../../packages/database/prismaClient.mjs';
import { fileURLToPath } from 'node:url';
import {
  deriveTaskCountsFromActivities,
  reconcileTaskLogFromActivities,
} from '../utils/foalActivityStore.mjs';

const args = process.argv.slice(2);
const printOnly = args.includes('--print-only');
const quiet = args.includes('--quiet');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : null;

async function main() {
  // Only foals that actually have canonical activity rows can need
  // reconciliation; scope the scan to those foalIds.
  const foalIdRows = await prisma.foalActivity.groupBy({ by: ['foalId'] });
  let foalIds = foalIdRows.map(r => r.foalId);
  if (limit && limit > 0) {
    foalIds = foalIds.slice(0, limit);
  }

  let changed = 0;
  let unchanged = 0;
  const changedSample = [];

  for (const foalId of foalIds) {
    if (printOnly) {
      const horse = await prisma.horse.findUnique({
        where: { id: foalId },
        select: { id: true, taskLog: true },
      });
      if (!horse) {
        continue;
      }
      const before =
        horse.taskLog && typeof horse.taskLog === 'object' && !Array.isArray(horse.taskLog)
          ? horse.taskLog
          : {};
      const derived = await deriveTaskCountsFromActivities(foalId);
      const after = { ...before };
      for (const [task, count] of Object.entries(derived)) {
        after[task] = Math.max(before[task] || 0, count);
      }
      const wouldChange = JSON.stringify(before) !== JSON.stringify(after);
      if (wouldChange) {
        changed += 1;
        if (changedSample.length < 10) {
          changedSample.push({ foalId, before, after });
        }
      } else {
        unchanged += 1;
      }
    } else {
      const result = await reconcileTaskLogFromActivities(foalId);
      if (result.changed) {
        changed += 1;
        if (changedSample.length < 10) {
          changedSample.push({ foalId, before: result.before, after: result.after });
        }
        if (!quiet) {
          console.log(`[backfill] foal ${foalId} reconciled`);
        }
      } else {
        unchanged += 1;
      }
    }
  }

  console.log(
    `[backfill-foal-activity-tasklog] mode=${printOnly ? 'DRY-RUN' : 'WET'} ` +
      `scanned=${foalIds.length} changed=${changed} unchanged=${unchanged}`,
  );
  if (changedSample.length) {
    console.log('[backfill-foal-activity-tasklog] sample:', JSON.stringify(changedSample, null, 2));
  }
}

// Equoria-5z0if: main-module guard. main() mutates foal task-log rows —
// must NOT run on bare import.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
    .then(() => prisma.$disconnect())
    .catch(async err => {
      console.error('[backfill-foal-activity-tasklog] FAILED:', err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
