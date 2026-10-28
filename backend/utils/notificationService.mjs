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
export const notificationRetentionCount = 100;
// Older spelling, still imported by existing callers.
export const NOTIFICATION_RETENTION_COUNT = notificationRetentionCount;

/**
 * Prune a user's Notification rows down to the newest
 * NOTIFICATION_RETENTION_COUNT entries by deleting any oldest extras.
 *
 * Uses a two-step approach (findMany ids past offset, then deleteMany by
 * id) so the deletion target is bounded by the read snapshot — a race with
 * a concurrent inserter cannot delete the newer row. That snapshot is the whole
 * safety argument, so the two steps are plain statements, not an interactive
 * transaction: the prune runs fire-and-forget after a commit, and a transaction
 * here held a second pool connection beside the nightly show settlement, whose
 * contract is one transaction at a time (Equoria-cmw85.1).
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
 * Equoria-y9n99 — coalesce the post-insert prune per user.
 *
 * Every insert used to fire its own prune, so a producer that writes many
 * notifications for one user in a row ran one redundant prune per row. The
 * scheduler keeps at most one prune per user in flight:
 *   - a request while none is pending starts one on the next turn of the
 *     event loop, so every request made before it starts shares it;
 *   - a request while one is running marks it to run once more after it
 *     finishes, so the last insert of a burst is always followed by a full
 *     prune.
 * The retention rule is unchanged: the same pruneOldNotifications runs after
 * the last insert, keeping the newest notificationRetentionCount rows.
 *
 * @param {(userId: string) => Promise<number>} pruneFn
 */
export function createPruneScheduler(pruneFn = pruneOldNotifications) {
  const pending = new Map();

  const runFor = async (userId, state) => {
    await new Promise(resolve => setImmediate(resolve));
    do {
      state.again = false;
      try {
        await pruneFn(userId);
      } catch (err) {
        logger.error(`[notificationService] scheduled prune failed: ${err.message}`);
      }
    } while (state.again);
    // Same synchronous turn as the loop's last check: a request cannot slip in
    // between deciding to stop and leaving the map.
    pending.delete(userId);
  };

  return {
    schedule(userId) {
      const existing = pending.get(userId);
      if (existing) {
        existing.again = true;
        return existing.done;
      }
      const state = { again: false, done: null };
      pending.set(userId, state);
      state.done = runFor(userId, state);
      return state.done;
    },
    /** Resolves once every prune scheduled so far has finished. */
    async settle() {
      while (pending.size > 0) {
        await Promise.all([...pending.values()].map(state => state.done));
      }
    },
  };
}

const defaultPruneScheduler = createPruneScheduler();

/** Ask for a retention prune of one user's notifications. Never throws. */
export function schedulePrune(userId) {
  return defaultPruneScheduler.schedule(userId);
}

/** Resolves once every scheduled post-insert prune has finished. */
export function settleScheduledPrunes() {
  return defaultPruneScheduler.settle();
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
 *   the player loses a groom silently. `foalBorn`, `horseSold` and
 *   `statGain` are all echoes of state the player can already see, so they
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
 * Delete a user's UNREAD notifications of the given types inside the caller's
 * transaction (STAFF-CR-11: a demoted moderator's staff-ticket bells). Read
 * notifications stay. Like createNotificationTx, `tx` is required and errors
 * throw so the caller's transaction rolls back.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {string} userId
 * @param {string[]} types
 * @returns {Promise<{count: number}>}
 */
export async function deleteUnreadNotificationsTx(tx, userId, types) {
  if (!tx || typeof tx.notification?.deleteMany !== 'function') {
    throw new Error(
      '[notificationService.deleteUnreadNotificationsTx] a Prisma transaction client is required as the first argument',
    );
  }
  if (typeof userId !== 'string' || userId === '' || !Array.isArray(types) || types.length === 0) {
    // An undefined filter would widen the delete to every user or type.
    throw new Error(
      '[notificationService.deleteUnreadNotificationsTx] a user id and types are required',
    );
  }
  return tx.notification.deleteMany({ where: { userId, type: { in: types }, isRead: false } });
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

  // Prune AFTER successful insert. Non-blocking — if the prune fails, the
  // insert is still successful and the user has at most a few extra rows,
  // which the next insert will clean up. Equoria-y9n99: a burst of inserts for
  // one user (a payroll loop, several placements in one show) shares one
  // prune instead of firing one per insert; see schedulePrune.
  schedulePrune(userId);
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

// Equoria-ctyia: one backfill request stops taking new users after this long,
// well inside the 30s request timeout, and hands back a cursor to resume from.
export const backfillTimeBudgetMs = 20_000;

/**
 * Prune every user's notifications down to the retention cap (ADR-007
 * one-time backfill), in bounded, resumable steps.
 *
 * Users are read in id order, `batchSize` at a time, starting after `cursor`.
 * Each user's prune is its own short read and delete (pruneOldNotifications), so
 * no long transaction is ever held. Once `timeBudgetMs` has passed the scan
 * stops after the current user and returns `nextCursor` (the last user id it
 * processed); calling again with that cursor carries on. `nextCursor` is null
 * when every user has been processed. At least one user is processed per
 * call, so a resumed scan always makes progress.
 *
 * @param {{batchSize: number, cursor?: string|null, timeBudgetMs?: number}} options
 * @returns {Promise<{usersProcessed: number, usersPruned: number, rowsPruned: number, nextCursor: string|null}>}
 */
export async function pruneNotificationsForAllUsers({
  batchSize,
  cursor = null,
  timeBudgetMs = backfillTimeBudgetMs,
}) {
  const startedAt = Date.now();
  const outcome = { usersProcessed: 0, usersPruned: 0, rowsPruned: 0, nextCursor: null };
  let afterId = cursor;

  for (;;) {
    const users = await prisma.user.findMany({
      ...(afterId ? { where: { id: { gt: afterId } } } : {}),
      take: batchSize,
      orderBy: { id: 'asc' },
      select: { id: true },
    });

    for (const { id } of users) {
      const deleted = await pruneOldNotifications(id);
      outcome.usersProcessed += 1;
      if (deleted > 0) {
        outcome.usersPruned += 1;
        outcome.rowsPruned += deleted;
      }
      afterId = id;
      if (Date.now() - startedAt >= timeBudgetMs) {
        outcome.nextCursor = id;
        return outcome;
      }
    }

    if (users.length < batchSize) {
      return outcome;
    }
  }
}
