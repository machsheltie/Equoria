/**
 * The bounded database work of a conformation show settlement
 * (Equoria-cmw85.11), run on executeConformationShow's transaction.
 *
 * Settlement used to load whole horse rows (every JSONB column) to score five
 * fields, look up each legacy entry's active groom with its own query, and
 * write each entrant's rewards with two to four statements of its own, all
 * inside one transaction holding a connection of the three-connection
 * production pool. Here the reads are scoped and the writes are grouped by
 * reward tier, so the statement count depends on the reward table, not on the
 * number of entrants. What is awarded is unchanged: the reward table, the
 * capped boost and the titles live in ./conformationShowScoring.mjs.
 */

import { resolveTitle } from './conformationShowScoring.mjs';

/** The horse fields conformation scoring reads (calculateConformationShowScore). */
export const conformationScoringHorseSelect = {
  id: true,
  name: true,
  conformationScores: true,
  bondScore: true,
  temperament: true,
};

/** The groom fields a handler is scored on — the same fields an entry snapshots. */
export const handlerSelect = {
  id: true,
  name: true,
  showHandlingSkill: true,
  personality: true,
};

/** Group items' ids by a tier key, keeping first-seen order. */
function idsByTier(items, keyOf, idOf) {
  const tiers = new Map();
  for (const item of items) {
    const key = keyOf(item);
    if (!tiers.has(key)) {
      tiers.set(key, []);
    }
    tiers.get(key).push(idOf(item));
  }
  return tiers;
}

/**
 * The active groom of every LEGACY entry's horse — an entry from before entries
 * recorded their groom (no groom row and no snapshot), which the owner ruled
 * (2026-10-20) is presented by the horse's current active groom. One query for
 * all of them. A horse with more than one active assignment takes the oldest
 * (lowest id), a fixed choice where the single lookup it replaces had no order.
 *
 * @param {object} tx - the settlement transaction
 * @param {Array<{ groom: object|null, groomSnapshot: unknown, horse: { id: number } }>} entries
 * @returns {Promise<Map<number, object>>} horseId -> groom (handlerSelect)
 */
export async function activeGroomsForLegacyEntries(tx, entries) {
  const legacyHorseIds = entries
    .filter(entry => !entry.groom && entry.groomSnapshot === null)
    .map(entry => entry.horse.id);
  const byHorseId = new Map();
  if (legacyHorseIds.length === 0) {
    return byHorseId;
  }
  const assignments = await tx.groomAssignment.findMany({
    where: { foalId: { in: legacyHorseIds }, isActive: true },
    select: { foalId: true, groom: { select: handlerSelect } },
    orderBy: { id: 'asc' },
  });
  for (const assignment of assignments) {
    if (!byHorseId.has(assignment.foalId)) {
      byHorseId.set(assignment.foalId, assignment.groom);
    }
  }
  return byHorseId;
}

/**
 * Award every placed entrant its title points and breeding-value boost, and
 * write any title newly reached.
 *
 * - The entrants' rows are locked first, in ascending id order (the repository
 *   lock order), so two settlements sharing a horse queue instead of
 *   deadlocking on the grouped updates.
 * - Equoria-mwjst: breedingValueBoost is a capped increment evaluated by the
 *   database on the row as it is now (the rule applyBreedingValueBoost states),
 *   never an absolute value from a row read earlier. One UPDATE per boost tier.
 * - Equoria-bvddn.21: titlePoints is incremented IN the database, one UPDATE
 *   per points tier, and each title follows the points the database then holds
 *   (read back on this transaction, whose locks keep any other settlement out),
 *   so two settlements sharing a horse cannot clobber each other's points.
 *
 * @param {object} tx - the settlement transaction
 * @param {Array<{ horse: { id: number }, reward: { titlePoints: number, breedingBoostDelta: number } }>} placed
 * @param {{ boostCap: number }} rules - the breeding-value boost cap (owned by
 *   conformationShowScoring.mjs)
 * @returns {Promise<Map<number, { newTitle: string|null, breedingValueBoost: number }>>}
 */
export async function applyConformationRewards(tx, placed, { boostCap }) {
  const horseIds = placed.map(p => p.horse.id);
  const ascending = [...horseIds].sort((a, b) => a - b);
  await tx.$queryRaw`SELECT "id" FROM "horses" WHERE "id" = ANY(${ascending}) ORDER BY "id" FOR UPDATE`;

  const boosted = placed.filter(p => p.reward.breedingBoostDelta > 0);
  for (const [delta, ids] of idsByTier(
    boosted,
    p => p.reward.breedingBoostDelta,
    p => p.horse.id,
  )) {
    await tx.$executeRaw`
      UPDATE "horses"
      SET "breedingValueBoost" = LEAST("breedingValueBoost" + ${delta}, ${boostCap})
      WHERE "id" = ANY(${ids})`;
  }

  for (const [points, ids] of idsByTier(
    placed,
    p => p.reward.titlePoints,
    p => p.horse.id,
  )) {
    await tx.horse.updateMany({
      where: { id: { in: ids } },
      data: { titlePoints: { increment: points } },
    });
  }

  const after = await tx.horse.findMany({
    where: { id: { in: horseIds } },
    select: { id: true, titlePoints: true, currentTitle: true, breedingValueBoost: true },
  });
  const rewarded = new Map();
  const retitled = [];
  for (const horse of after) {
    const newTitle = resolveTitle(horse.titlePoints);
    rewarded.set(horse.id, { newTitle, breedingValueBoost: horse.breedingValueBoost });
    if (newTitle !== horse.currentTitle) {
      retitled.push({ id: horse.id, newTitle });
    }
  }
  for (const [title, ids] of idsByTier(
    retitled,
    r => r.newTitle,
    r => r.id,
  )) {
    await tx.horse.updateMany({ where: { id: { in: ids } }, data: { currentTitle: title } });
  }
  return rewarded;
}
