// backend/utils/notificationService.mjs
//
// Server-side helper for writing game-event Notification rows.
//
// Equoria-1fqs (per-user retention cap): the Notification table previously
// grew unbounded — the read path only applied `take: 100`, so old rows
// accumulated forever per user. Each insert now triggers a non-blocking
// prune step that keeps only the newest NOTIFICATION_RETENTION_COUNT rows
// for that user. Failures on the prune are logged but never propagated;
// notification creation must not be coupled to retention bookkeeping.
import prisma from '../../packages/database/prismaClient.mjs';
import logger from './logger.mjs';
// Equoria-rgyv (ADR-011): publish a low-latency real-time nudge for the SSE
// transport AFTER the durable DB write. Fire-and-forget — a bus failure
// must never affect the notification write (the DB row is the source of
// truth; the stream is an accelerator over polling).
import { publishUserEvent } from '../services/eventBus.mjs';

// Per-user retention cap. Matches the existing read-side `take: 100` so the
// table size stays bounded at exactly what the UI can ever surface.
export const NOTIFICATION_RETENTION_COUNT = 100;

/**
 * Prune a user's Notification rows down to the newest
 * NOTIFICATION_RETENTION_COUNT entries by deleting any oldest extras.
 *
 * Uses a two-step approach (findMany ids past offset, then deleteMany by
 * id) so the deletion target is bounded by the read snapshot — a race with
 * a concurrent inserter cannot delete the newer row.
 *
 * Returns the count of deleted rows. Never throws — failures are logged.
 */
export async function pruneOldNotifications(userId, retentionCount = NOTIFICATION_RETENTION_COUNT) {
  try {
    const stale = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: retentionCount,
      select: { id: true },
    });
    if (stale.length === 0) {
      return 0;
    }
    const ids = stale.map(row => row.id);
    const result = await prisma.notification.deleteMany({ where: { id: { in: ids } } });
    return result.count;
  } catch (err) {
    logger.error(`[notificationService] prune failed: ${err.message}`);
    return 0;
  }
}

/**
 * Equoria-m9lz1 — the DURABLE half of notification creation, written inside a
 * caller-supplied Prisma transaction client.
 *
 * WHEN TO USE THIS INSTEAD OF `createNotification`
 *   Only when losing the notification would leave the player unable to see or
 *   act on a state change the same transaction made — i.e. when the
 *   notification IS the player's warning, not a courtesy echo of something the
 *   surface already shows. Groom retirement is the motivating case: the game
 *   ends the player's assignments; if the announcement can fail independently
 *   the player loses a groom silently. `foal_born`, `horse_sold` and
 *   `stat_gain` are all echoes of state the player can already see, so they
 *   correctly stay on the post-commit `createNotification` path.
 *
 * CONTRACT — this differs from `createNotification` in TWO ways, deliberately:
 *   1. `tx` is a REQUIRED positional argument with no default. There is no
 *      silent fallback to the module-level `prisma` client, because a helper
 *      whose default argument quietly escapes its caller's transaction is the
 *      exact footgun this function exists to avoid.
 *   2. It THROWS on insert failure instead of logging and returning. That is
 *      the point: the caller's transaction must roll back so there is no
 *      unannounced retirement.
 *
 * It deliberately does NOT publish to the event bus and does NOT prune. Both
 * are post-commit concerns (ADR-011 requires the real-time nudge to follow the
 * durable write; ADR-007 requires pruning to follow a *successful* insert, and
 * inside an open transaction the insert is not yet successful). The caller must
 * call `finalizeNotificationAfterCommit` once its transaction has committed.
 *
 * ADR-007 note: this keeps the shared service the single notification producer
 * and the retention boundary. Producers must still not write
 * `tx.notification.create(...)` themselves.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx - the caller's transaction client
 * @param {string} userId
 * @param {string} type
 * @param {Object} payload
 * @returns {Promise<Object>} the created Notification row
 */
export async function createNotificationTx(tx, userId, type, payload) {
  if (!tx || typeof tx.notification?.create !== 'function') {
    throw new Error(
      '[notificationService.createNotificationTx] a Prisma transaction client is required as the first argument',
    );
  }
  return tx.notification.create({ data: { userId, type, payload } });
}

/**
 * Equoria-m9lz1 — the POST-COMMIT half: the real-time SSE nudge (ADR-011) and
 * the per-user retention prune (ADR-007). Never throws; a failure here leaves
 * the durable row in place, which is the source of truth.
 *
 * Call this after the transaction that ran `createNotificationTx` has
 * committed. Calling it is not optional: skipping it means the player only
 * sees the notification on the 5-second polling fallback, and the retention cap
 * is not enforced for that insert.
 *
 * @param {string} userId
 * @param {string} type
 * @param {Object} payload
 */
export function finalizeNotificationAfterCommit(userId, type, payload) {
  // Equoria-rgyv (ADR-011): publish the real-time nudge AFTER the DB insert
  // succeeded. publishUserEvent never throws, but guard anyway so a future
  // change cannot couple the notification write to bus delivery.
  try {
    publishUserEvent(userId, type, payload);
  } catch (err) {
    logger.error(`[notificationService] event bus publish failed: ${err.message}`);
  }

  // Prune AFTER successful insert. Non-blocking fire-and-forget — if the
  // prune fails, the insert is still successful and the user has at most
  // one extra row, which the next insert will clean up.
  pruneOldNotifications(userId).catch(err => {
    logger.error(`[notificationService] prune fire-and-forget failed: ${err.message}`);
  });
}

export async function createNotification(userId, type, payload) {
  try {
    // The module-level client is passed EXPLICITLY here: outside a transaction
    // `prisma` is itself a valid autocommit client, and routing through the
    // same helper keeps one insert code path.
    await createNotificationTx(prisma, userId, type, payload);
  } catch (err) {
    logger.error(`[notificationService] failed to create notification: ${err.message}`);
    return;
  }

  finalizeNotificationAfterCommit(userId, type, payload);
}
