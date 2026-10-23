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
 *
 * It is also the home of the module's by-id read, getHorseById (Equoria-q4uem.7
 * S2), the query half of the former horseModelService.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { findKeysetPage } from '../../../utils/paginationHelper.mjs';

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
  hungerSince: true,
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
  // Equoria-9spb2 (owner ruling 2026-10-23): the stable list view's Shod chip,
  // Cooldown column and row portrait read these.
  lastShod: true,
  trainingCooldown: true,
  imageUrl: true,
  // Equoria-q4uem.9 slice 6: the player's stud listing and the breeding state
  // the list derives breedingCooldownEndsAt / inFoal from.
  studStatus: true,
  studFee: true,
  lastBredDate: true,
  inFoalSinceDate: true,
  breed: { select: { id: true, name: true } },
  user: { select: { id: true, username: true } },
});

/**
 * Paginated horse-list query for `GET /api/horses`, on the keyset convention
 * (Equoria-cmw85.19): newest first, ties broken by id so two horses created in
 * the same instant keep their places between requests. A `cursor` continues
 * after the last row of the previous page; without one, `skip` is the legacy offset.
 *
 * @param {object} where - prisma where filter (userId / breedId built by route)
 * @param {{ limit: number, skip: number, cursor?: string|null }} pagination
 * @returns {Promise<{ items: Array<object>, pageInfo: { nextCursor: string|null, hasMore: boolean } }>}
 * @throws {InvalidCursorError} on a cursor that cannot be decoded
 */
export function listHorses(where, { limit, skip, cursor }) {
  return findKeysetPage(args => prisma.horse.findMany(args), {
    where,
    sort: [
      { key: 'createdAt', dir: 'desc', type: 'date' },
      { key: 'id', dir: 'desc', type: 'int' },
    ],
    limit,
    skip,
    cursor,
    extra: { select: HORSE_LIST_SELECT },
  });
}

/**
 * The PENDING private stud request holding each of these mares (at most one
 * per mare: the partial unique index), keyed by dam id. Equoria-q4uem.9 slice 6.
 *
 * @param {number[]} damIds
 * @returns {Promise<Map<number, { id: number, damId: number, sireId: number|null, sireName: string }>>}
 */
export async function getPendingStudRequestsForDams(damIds) {
  if (damIds.length === 0) {
    return new Map();
  }
  const rows = await prisma.breedingRecord.findMany({
    where: { damId: { in: damIds }, status: 'PENDING' },
    select: { id: true, damId: true, sireId: true, sireName: true },
  });
  return new Map(rows.map(r => [r.damId, r]));
}

/**
 * Batch fetch the recent-results stream for a page of horse ids
 * (Equoria-55bo.5/.6: one query feeds both latestEvent + firstPlaceWins
 * — no N+1).
 *
 * @param {number[]} horseIds
 * @returns {Promise<Array<{ horseId: number, showName: string|null, discipline: string|null, placement: number|null, runDate: Date|null }>>}
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
 * @returns {Promise<Array<{ placement: number|null, prizeWon: number|null }>>}
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

/**
 * A horse's offspring for the pedigree tab (Equoria-oey96.55, owner ruling
 * 2026-10-23): every horse whose sire or dam it is, oldest first, whoever owns
 * it now. One query, and only `id` and `name` leave it — offspring sold to other
 * players are listed by name and nothing else (no owner, stats, genetics or
 * traits, hidden or revealed).
 *
 * @param {number} horseId
 * @returns {Promise<Array<{ id: number, name: string }>>}
 */
export function listOffspring(horseId) {
  return prisma.horse.findMany({
    where: { OR: [{ sireId: horseId }, { damId: horseId }] },
    select: { id: true, name: true },
    orderBy: [{ dateOfBirth: 'asc' }, { id: 'asc' }],
  });
}

/**
 * The horses module's by-id read (Equoria-q4uem.7 S2: moved here from the former
 * horseModelService, the query half of its command/query split). Returns the horse
 * with its breed and stable, or null. The owner's user row (password hash, MFA
 * secret) is never loaded; no caller reads it.
 *
 * @param {number|string} id
 * @returns {Promise<object|null>}
 */
export async function getHorseById(id) {
  try {
    // Validate ID
    const numericId = parseInt(id, 10);
    if (isNaN(numericId) || numericId <= 0) {
      throw new Error('Invalid horse ID provided');
    } // Refactored to use Prisma client with relations
    const horse = await prisma.horse.findUnique({
      where: { id: numericId },
      include: {
        breed: true,
        stable: true,
      },
    });

    if (horse) {
      logger.info(
        `[horseModel.getHorseById] Successfully found horse: ${horse.name} (ID: ${horse.id})`,
      );
    }

    return horse; // Returns null if not found, which is Prisma's default
  } catch (error) {
    logger.error('[horseModel.getHorseById] Database error: %o', error);
    throw new Error(`Database error in getHorseById: ${error.message}`, { cause: error });
  }
}
