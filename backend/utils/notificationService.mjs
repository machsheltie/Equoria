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
import prisma from '../db/index.mjs';
import logger from './logger.mjs';

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

export async function createNotification(userId, type, payload) {
  try {
    await prisma.notification.create({ data: { userId, type, payload } });
  } catch (err) {
    logger.error(`[notificationService] failed to create notification: ${err.message}`);
    return;
  }

  // Prune AFTER successful insert. Non-blocking fire-and-forget — if the
  // prune fails, the insert is still successful and the user has at most
  // one extra row, which the next insert will clean up.
  pruneOldNotifications(userId).catch(err => {
    logger.error(`[notificationService] prune fire-and-forget failed: ${err.message}`);
  });
}
