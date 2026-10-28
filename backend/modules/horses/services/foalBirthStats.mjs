/**
 * A foal's 12 stats at birth (Equoria-fq9ob).
 *
 * Owner rulings 2026-10-28:
 *   - q204: foals are never born with every stat at 0; their stats come from
 *     their parents.
 *   - q247: for each stat, the base is the average of the sire's and dam's
 *     value, varied by a random amount between -10% and +10% of that average
 *     (each stat rolled on its own), then the lineage bonus
 *     (foalLineageStatBonus.mjs) is added when 3 ancestors share a discipline.
 *   - q248: half rounds up, as built.
 *   - Stats are never capped (2026-10-07); a stat is never below 0.
 *
 * inheritedBaseStats is pure: the caller passes the random source (`rng`,
 * returns [0, 1)) so tests can seed it.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import { horseStatNames, resolveFoalLineageStatBonus } from './foalLineageStatBonus.mjs';

/** The largest share of the parents' average a base stat is varied by (q247). */
export const birthStatVariation = 0.1;

const statOf = (horse, stat) => {
  const value = horse?.[stat];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};

/**
 * Each stat: the parents' average times a factor drawn uniformly from
 * [0.9, 1.1), rounded to the nearest whole number (half up), never below 0.
 * A missing parent stat counts as 0. One rng draw per stat, in horseStatNames
 * order.
 *
 * @param {Record<string, unknown>} sireStats
 * @param {Record<string, unknown>} damStats
 * @param {() => number} [rng] - random source in [0, 1); Math.random by default
 * @returns {Record<string, number>} one entry for each of the 12 stats
 */
export function inheritedBaseStats(sireStats, damStats, rng = Math.random) {
  return Object.fromEntries(
    horseStatNames.map(stat => {
      const average = (statOf(sireStats, stat) + statOf(damStats, stat)) / 2;
      const factor = 1 + (rng() * 2 - 1) * birthStatVariation;
      return [stat, Math.max(0, Math.round(average * factor))];
    }),
  );
}

const statSelect = Object.fromEntries(horseStatNames.map(stat => [stat, true]));

/**
 * The foal's 12 birth stats: inherited base plus the lineage bonus when the
 * lineage qualifies.
 *
 * @param {object} input
 * @param {number} input.sireId
 * @param {number} input.damId
 * @param {Array<{ id: number }>} input.lineage - ancestors within 3 generations
 * @param {() => number} [input.rng] - random source in [0, 1)
 * @param {object} [client] - Prisma client or transaction
 * @returns {Promise<Record<string, number>>}
 */
export async function resolveFoalBirthStats({ sireId, damId, lineage, rng }, client = prisma) {
  const parents = await client.horse.findMany({
    where: { id: { in: [sireId, damId] } },
    select: { id: true, ...statSelect },
  });
  const parent = id => parents.find(horse => horse.id === id) ?? null;
  const base = inheritedBaseStats(parent(sireId), parent(damId), rng);
  const bonus = await resolveFoalLineageStatBonus({ sireId, damId, lineage }, client);
  if (!bonus) {
    return base;
  }
  return Object.fromEntries(horseStatNames.map(stat => [stat, base[stat] + bonus[stat]]));
}
