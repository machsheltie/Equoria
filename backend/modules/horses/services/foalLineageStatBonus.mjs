/**
 * Lineage stat bonus at birth (Equoria-fq9ob).
 *
 * Owner rulings 2026-10-20 (Q1), 2026-10-21 (Q6) and 2026-10-28: when at least 3
 * distinct ancestors within 3 generations (parents, grandparents,
 * great-grandparents) share the same most-competed discipline, the foal gets, on
 * each of its 12 stats, 2% of its parents' average for that stat, rounded to the
 * nearest whole number, added at birth. It applies once per foal, however many
 * disciplines qualify.
 *
 *   - An ancestor's most-competed discipline is the one with the most
 *     CompetitionResult rows for that horse; an ancestor with no results does not
 *     count. Each ancestor counts once, even if it repeats in the pedigree.
 *   - Tied top disciplines: the ancestor contributes each tied discipline
 *     (controller ruling, not the owner's).
 *   - Rounding: Math.round, so an exact half rounds up (2% of an average of 25 is
 *     0.5, which gives +1). The owner has not ruled on the half case.
 *   - No trait is attached to lineage.
 *
 * The bonus is added on top of the foal's base stats. The base inheritance
 * formula is not decided (the bible has none), so foalingService passes 0 as the
 * base today; see the module doc there.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
/** The 12 horse stats (the same names as constants/schema.mjs HORSE_STATS). */
export const horseStatNames = Object.freeze([
  'speed',
  'stamina',
  'agility',
  'endurance',
  'strength',
  'precision',
  'balance',
  'intelligence',
  'focus',
  'obedience',
  'boldness',
  'flexibility',
]);
const horseStats = horseStatNames;

/** Distinct ancestors that must share a most-competed discipline. */
export const lineageAncestorsNeeded = 3;

/** Share of the parents' average each stat gains when the lineage qualifies. */
export const lineageStatShare = 0.02;

/**
 * The tied top disciplines in one horse's result counts.
 *
 * @param {Record<string, number>} countsByDiscipline - results per discipline
 * @returns {string[]} every discipline with the highest count (empty when no results)
 */
export function topCompetedDisciplines(countsByDiscipline) {
  let best = 0;
  let top = [];
  for (const [discipline, count] of Object.entries(countsByDiscipline ?? {})) {
    if (!Number.isInteger(count) || count <= 0) {
      continue;
    }
    if (count > best) {
      best = count;
      top = [discipline];
    } else if (count === best) {
      top.push(discipline);
    }
  }
  return top.sort();
}

/**
 * Whether a lineage qualifies: some discipline is the most-competed one of at
 * least 3 distinct ancestors.
 *
 * @param {Array<{ id: number, countsByDiscipline: Record<string, number> }>} ancestors
 * @returns {boolean}
 */
export function lineageQualifies(ancestors) {
  const ancestorsByDiscipline = new Map();
  for (const ancestor of ancestors ?? []) {
    for (const discipline of topCompetedDisciplines(ancestor?.countsByDiscipline)) {
      const ids = ancestorsByDiscipline.get(discipline) ?? new Set();
      ids.add(ancestor.id);
      ancestorsByDiscipline.set(discipline, ids);
    }
  }
  return [...ancestorsByDiscipline.values()].some(ids => ids.size >= lineageAncestorsNeeded);
}

/**
 * The per-stat bonus: 2% of the parents' average, rounded to the nearest whole
 * number. A missing parent stat counts as 0.
 *
 * @param {Record<string, unknown>} sireStats
 * @param {Record<string, unknown>} damStats
 * @returns {Record<string, number>} one entry for each of the 12 stats
 */
export function lineageStatBonus(sireStats, damStats) {
  const statOf = (horse, stat) => {
    const value = horse?.[stat];
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  };
  return Object.fromEntries(
    horseStats.map(stat => {
      const average = (statOf(sireStats, stat) + statOf(damStats, stat)) / 2;
      return [stat, Math.round(average * lineageStatShare)];
    }),
  );
}

const statSelect = Object.fromEntries(horseStats.map(stat => [stat, true]));

/**
 * The lineage stat bonus for a foal of `sireId` x `damId`, or null when the
 * lineage does not qualify.
 *
 * @param {object} input
 * @param {number} input.sireId
 * @param {number} input.damId
 * @param {Array<{ id: number }>} input.lineage - ancestors within 3 generations,
 *   each horse once (gatherLineage)
 * @param {object} [client] - Prisma client or transaction
 * @returns {Promise<Record<string, number>|null>}
 */
export async function resolveFoalLineageStatBonus({ sireId, damId, lineage }, client = prisma) {
  const ancestorIds = [
    ...new Set((lineage ?? []).map(ancestor => ancestor?.id).filter(Number.isInteger)),
  ];
  if (ancestorIds.length < lineageAncestorsNeeded) {
    return null;
  }
  const rows = await client.competitionResult.groupBy({
    by: ['horseId', 'discipline'],
    where: { horseId: { in: ancestorIds } },
    _count: { _all: true },
  });
  const countsById = new Map();
  for (const row of rows) {
    const counts = countsById.get(row.horseId) ?? {};
    counts[row.discipline] = row._count._all;
    countsById.set(row.horseId, counts);
  }
  const ancestors = [...countsById.entries()].map(([id, countsByDiscipline]) => ({
    id,
    countsByDiscipline,
  }));
  if (!lineageQualifies(ancestors)) {
    return null;
  }
  const parents = await client.horse.findMany({
    where: { id: { in: [sireId, damId] } },
    select: { id: true, ...statSelect },
  });
  const parent = id => parents.find(horse => horse.id === id) ?? null;
  return lineageStatBonus(parent(sireId), parent(damId));
}
