/**
 * The rider pay week (owner ruling 2026-10-27, q111): the Eastern (game-clock) Sunday
 * that starts it, same as the groom pay week. One definition, shared by the weekly pass,
 * the hire charge and the unpaid-week handling.
 */

import {
  gameDateKey,
  gameDayIndex,
  startOfGameDayIndex,
  startOfGameWeek,
} from '../../../utils/gameTime.mjs';
import { jobNameToLockKey } from '../../../utils/cronLock.mjs';

/**
 * The pay week starts on Sunday (0 = Sunday). Owner ruling 2026-10-29 (q268, Equoria-hc96y):
 * the week ends Sunday midnight Eastern, as for grooms and the Hall of Fame. Old: Monday.
 */
export const riderPayDay = 0;

/** Eastern midnight of the Sunday that starts the pay week containing `now`. */
export function getRiderPayWeekStart(now = new Date()) {
  return startOfGameWeek(now, riderPayDay);
}

/** Start of the NEXT pay week (the exclusive end of this one). */
export function getRiderPayWeekEnd(payWeekStart) {
  return startOfGameDayIndex(gameDayIndex(payWeekStart) + 7);
}

/** The pay week's 'YYYY-MM-DD' key. */
export function riderPayWeekKey(payWeekStart) {
  return gameDateKey(payWeekStart);
}

/**
 * Take the per-(user, pay week) advisory lock. MUST be the first statement of the
 * transaction; the blocking variant, so a loser waits and then sees committed rows.
 */
export async function acquireRiderPayWeekLockTx(tx, userId, payWeekStart) {
  const lockKey = jobNameToLockKey(`riderSalary:${userId}:${payWeekStart.toISOString()}`);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`;
}
