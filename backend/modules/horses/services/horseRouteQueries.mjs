/**
 * Horse-route data-access helpers
 *
 * Wraps the prisma calls used by `modules/horses/routes/horseRoutes.mjs`
 * so the routes layer no longer imports prisma directly (Equoria-becrm).
 *
 * Coordinated with Equoria-y8u2j (god-file split — sub-router extraction).
 * These helpers cover the inline prisma calls that remain in the parent
 * router (list, latest-event batch, update, prize-summary). Anything the
 * y8u2j agent moves into a sub-router takes its prisma calls with it via
 * follow-up commits; this service stays as the canonical place to add
 * future helpers for routes left in the parent.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';

/**
 * The horse-list select shape (Equoria-tkyx, Equoria-lvjy, Equoria-u7e6,
 * Equoria-55bo.5). Exported so the route handler can pass the cached
 * callback through `getCachedQuery()` without inlining the shape.
 *
 * Field selection EXCLUDES large JSONB (colorGenotype / epigeneticFlags)
 * but INCLUDES phenotype (~500 bytes/row) because HorseCard.tsx reads
 * `phenotype.colorName` to render the coat-color chip.
 */
export const HORSE_LIST_SELECT = Object.freeze({
  id: true,
  name: true,
  age: true,
  dateOfBirth: true,
  sex: true,
  healthStatus: true,
  lastFedDate: true,
  lastVettedDate: true,
  forSale: true,
  salePrice: true,
  breedId: true,
  userId: true,
  createdAt: true,
  speed: true,
  stamina: true,
  agility: true,
  balance: true,
  precision: true,
  intelligence: true,
  boldness: true,
  flexibility: true,
  obedience: true,
  focus: true,
  strength: true,
  endurance: true,
  totalEarnings: true,
  trait: true,
  temperament: true,
  titlePoints: true,
  currentTitle: true,
  breedingValueBoost: true,
  phenotype: true,
  breed: { select: { id: true, name: true } },
  user: { select: { id: true, username: true } },
});

/**
 * Paginated horse-list query for `GET /api/horses`.
 *
 * @param {object} where - prisma where filter (userId / breedId built by route)
 * @param {{ take: number, skip: number }} pagination
 * @returns {Promise<Array<object>>}
 */
export function listHorses(where, { take, skip }) {
  return prisma.horse.findMany({
    where,
    take,
    skip,
    select: HORSE_LIST_SELECT,
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Batch fetch the recent-results stream for a page of horse ids
 * (Equoria-55bo.5/.6: one query feeds both latestEvent + firstPlaceWins
 * — no N+1).
 *
 * @param {number[]} horseIds
 * @returns {Promise<Array<{ horseId: number, showName: string|null, discipline: string|null, placement: string|null, runDate: Date|null }>>}
 */
export function getRecentResultsForHorses(horseIds) {
  return prisma.competitionResult.findMany({
    where: { horseId: { in: horseIds } },
    orderBy: { runDate: 'desc' },
    select: {
      horseId: true,
      showName: true,
      discipline: true,
      placement: true,
      runDate: true,
    },
  });
}

/**
 * Update a horse with the validated payload and return the row with the
 * breed + owning user joined. Caller catches `error.code === 'P2025'`
 * (record not found) and validation errors (`PrismaClientValidationError`
 * / `Unknown argument` / the literal `Invalid \`prisma.horse.update()\``
 * substring).
 *
 * @param {number} horseId
 * @param {object} data - validated update payload
 * @returns {Promise<object>}
 */
export function updateHorse(horseId, data) {
  return prisma.horse.update({
    where: { id: horseId },
    data,
    include: {
      breed: true,
      user: { select: { id: true, username: true } },
    },
  });
}

/**
 * Fetch the per-result placement + prize rows for a horse's prize-summary
 * endpoint. Returns the minimal column subset the aggregator needs.
 *
 * @param {number} horseId
 * @returns {Promise<Array<{ placement: string|null, prizeWon: number|null }>>}
 */
export function getHorseCompetitionResultsForPrizeSummary(horseId) {
  return prisma.competitionResult.findMany({
    where: { horseId },
    select: {
      placement: true,
      prizeWon: true,
    },
  });
}
