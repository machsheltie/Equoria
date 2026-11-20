/**
 * Monthly leaderboard totals (Equoria-y3nia, owner ruling q42).
 *
 * One row per player (player_monthly_totals) or horse (horse_monthly_totals),
 * per Eastern game month ('YYYY-MM', gameTime.gameMonthKey), per category. The
 * Monthly boards read these rows; the Overall boards are counted live.
 *
 * Every write is a relative `INSERT ... ON CONFLICT DO UPDATE SET value =
 * value + n` on the caller's transaction client, so:
 *   - concurrent awards add up (the row lock serialises them, none is lost);
 *   - a rolled-back settlement leaves no trace;
 *   - a settlement that is replayed is refused by the competition result's
 *     [showId, horseId] unique BEFORE these writes run (the result is the
 *     first write of the settlement transaction), so nothing counts twice.
 *
 * Lock order: player rows, then horse rows, each in ascending id order, so two
 * settlements that touch the same owners and horses cannot deadlock. A show
 * settlement writes them LAST, once it holds every coin row it moves (the show
 * escrow and burn accounts, User money), and its results' totals once for the
 * whole transaction (Equoria-mwjst.4): written before the escrow account, a conformation
 * settlement held an owner's row while it waited for the account a ridden
 * payout held while it waited for that row; written placing by placing, Run
 * Show took two owners' rows crosswise to a conformation settlement.
 *
 * Categories — player: xp, earnings, wins, shows.
 *              horse: points, earnings, wins, shows, disciplineWins:<discipline>.
 */

import { Prisma } from '../../packages/database/prismaClient.mjs';
import { gameMonthKey } from './gameTime.mjs';

/** Category name of a horse's first places in one discipline. */
export const disciplineWinsCategory = discipline => `disciplineWins:${discipline}`;

/** The positive increments, sorted by category so concurrent writers lock in one order. */
function positiveEntries(increments) {
  return Object.entries(increments)
    .map(([category, value]) => [category, Math.round(Number(value))])
    .filter(([, value]) => Number.isFinite(value) && value > 0)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * Add `increments` ({ category: amount }) to a player's totals for the game
 * month of `at`. Zero and negative amounts are ignored.
 */
export async function addPlayerMonthlyTotals(db, playerId, increments, at = new Date()) {
  const entries = positiveEntries(increments);
  if (entries.length === 0) {
    return;
  }
  const month = gameMonthKey(at);
  const values = entries.map(
    ([category, value]) => Prisma.sql`(${month}, ${category}, ${playerId}, ${value})`,
  );
  await db.$executeRaw(Prisma.sql`
    INSERT INTO "player_monthly_totals" ("month", "category", "playerId", "value")
    VALUES ${Prisma.join(values)}
    ON CONFLICT ("month", "category", "playerId")
    DO UPDATE SET "value" = "player_monthly_totals"."value" + EXCLUDED."value"`);
}

/** The horse side of {@link addPlayerMonthlyTotals}. */
export async function addHorseMonthlyTotals(db, horseId, increments, at = new Date()) {
  const entries = positiveEntries(increments);
  if (entries.length === 0) {
    return;
  }
  const month = gameMonthKey(at);
  const values = entries.map(
    ([category, value]) => Prisma.sql`(${month}, ${category}, ${horseId}, ${value})`,
  );
  await db.$executeRaw(Prisma.sql`
    INSERT INTO "horse_monthly_totals" ("month", "category", "horseId", "value")
    VALUES ${Prisma.join(values)}
    ON CONFLICT ("month", "category", "horseId")
    DO UPDATE SET "value" = "horse_monthly_totals"."value" + EXCLUDED."value"`);
}

/**
 * Count settled show results into the monthly totals, on the settlement's own
 * transaction client. Call it AFTER the results are created, so a duplicate
 * settlement has already been refused.
 *
 * @param {object} db - the settlement `$transaction` client.
 * @param {Array<{ horseId: number, ownerId: string|null, placement: number,
 *   prize: number, discipline: string }>} results - one per settled entry.
 * @param {Date} at - the results' run date (picks the game month).
 */
export async function recordSettledResultTotals(db, results, at) {
  const players = new Map();
  const horses = new Map();
  const add = (map, id, increments) => {
    const sum = map.get(id) ?? {};
    for (const [category, value] of Object.entries(increments)) {
      sum[category] = (sum[category] ?? 0) + value;
    }
    map.set(id, sum);
  };
  for (const { horseId, ownerId, placement, prize, discipline } of results) {
    const win = placement === 1 ? 1 : 0;
    const earned = Number(prize) > 0 ? Number(prize) : 0;
    add(horses, horseId, {
      shows: 1,
      wins: win,
      earnings: earned,
      [disciplineWinsCategory(discipline)]: win,
    });
    if (ownerId) {
      add(players, ownerId, { shows: 1, wins: win, earnings: earned });
    }
  }
  for (const playerId of [...players.keys()].sort()) {
    await addPlayerMonthlyTotals(db, playerId, players.get(playerId), at);
  }
  for (const horseId of [...horses.keys()].sort((a, b) => a - b)) {
    await addHorseMonthlyTotals(db, horseId, horses.get(horseId), at);
  }
}

/**
 * {@link recordSettledResultTotals} for one settled ridden entry: `staged` is the
 * staged placement ({ horseId, userId, placement }), `show` the settled show.
 * With `deferTo` (an array), the result is added to it instead, for a caller
 * that settles several placings in one transaction and records them all at
 * once, at its end (Run Show, Equoria-mwjst.4).
 */
export async function recordRiddenResultTotals(db, { show, staged, prize, now }, deferTo = null) {
  const { horseId, userId: ownerId, placement } = staged;
  const result = { horseId, ownerId, placement, prize, discipline: show.discipline };
  if (deferTo) {
    deferTo.push(result);
    return;
  }
  await recordSettledResultTotals(db, [result], now);
}
