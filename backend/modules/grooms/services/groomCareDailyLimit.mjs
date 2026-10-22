/**
 * Groom-care daily limit, enforced inside the caller's transaction
 * (Equoria-9a5ny, Equoria-mc22a).
 *
 * Every horse may have one groom interaction per Eastern game day. The two care
 * doors (POST /grooms/interact and POST /grooms/enhanced/interact) used to check
 * that with an unlocked read before writing, so two requests in flight for one
 * horse both saw "none today" and both groomed it. The check is only a guard if
 * it runs AFTER a lock that every competing writer also takes, inside the same
 * transaction as the write it guards.
 *
 * The lock is the Horse row (`SELECT ... FOR UPDATE`). It is the first row each
 * door writes, so taking it first keeps the repository lock order
 * (User -> Horse -> staff rows). A queued request resumes after the winner
 * commits, and under READ COMMITTED its next statement sees the winner's
 * interaction row, so it refuses instead of writing.
 *
 * The bond and stress values are re-read under the same lock so the caller
 * applies its change to the committed values, not to a pre-transaction read.
 * This does not change any amount: the caller computes its change exactly as
 * before and only the base it is applied to is current.
 */

import { gameDayBounds } from '../../../utils/gameTime.mjs';

/** Thrown inside the transaction when the horse already had today's interaction. */
export class GroomDailyLimitReachedError extends Error {
  constructor(lastInteraction, interactionsToday) {
    super('Horse has already had a groom interaction today');
    this.name = 'GroomDailyLimitReachedError';
    this.lastInteraction = lastInteraction;
    this.interactionsToday = interactionsToday;
  }
}

/**
 * Lock the horse row, re-check today's groom interactions, and return the
 * horse's current bond and stress.
 * @param {object} tx - Prisma interactive-transaction client
 * @param {number} horseId
 * @returns {Promise<{bondScore: number, stressLevel: number}>}
 * @throws {GroomDailyLimitReachedError} when the horse was already groomed today
 */
export async function lockHorseForGroomCare(tx, horseId) {
  await tx.$queryRaw`SELECT "id" FROM "horses" WHERE "id" = ${horseId} FOR UPDATE`;

  // "Today" is the Eastern game day (owner ruling 2026-10-09).
  const { start, end } = gameDayBounds();
  const todays = await tx.groomInteraction.findMany({
    where: { foalId: horseId, timestamp: { gte: start, lt: end } },
    orderBy: { timestamp: 'asc' },
  });
  if (todays.length > 0) {
    throw new GroomDailyLimitReachedError(todays[todays.length - 1], todays.length);
  }

  const current = await tx.horse.findUnique({
    where: { id: horseId },
    select: { bondScore: true, stressLevel: true },
  });
  if (!current) {
    throw new Error(`Horse with ID ${horseId} not found`);
  }
  return current;
}
