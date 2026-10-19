/**
 * Trait history a client may see (Equoria-6dace).
 *
 * TraitHistoryLog rows are written for every trait a horse gains, hidden ones
 * included (the nightly foal job logs them with no "hidden" mark). Owner
 * ruling 2026-10-16: an unrevealed hidden trait is hidden from everyone, the
 * owner included. So every READ of history that feeds a response leaves out
 * rows naming a trait that is hidden on the horse NOW.
 *
 * Read-time, not write-time: it also covers rows written before this fix,
 * and a row comes back by itself the moment its trait is revealed, with no
 * second write to keep in step.
 */
import prisma from '../../../../packages/database/prismaClient.mjs';
import { hiddenTraitSet, withoutHiddenTraitHistory } from '../../../utils/publicTraitView.mjs';

/**
 * A TraitHistoryLog `where` for one horse that also excludes the traits
 * currently hidden on that horse. `where.horseId` must be the horse's id
 * (a number); anything else throws rather than return an unfiltered query.
 *
 * @param {{ horseId: number } & object} where
 * @returns {Promise<object>}
 */
export async function visibleTraitHistoryWhere(where) {
  const horseId = where?.horseId;
  if (!Number.isInteger(horseId)) {
    throw new TypeError('visibleTraitHistoryWhere: where.horseId must be an integer');
  }
  const horse = await prisma.horse.findUnique({
    where: { id: horseId },
    select: { epigeneticModifiers: true },
  });
  const hidden = [...hiddenTraitSet(horse?.epigeneticModifiers)];
  return hidden.length > 0 ? { AND: [where, { traitName: { notIn: hidden } }] } : where;
}

/**
 * A horse row loaded with `traitHistoryLogs`, minus the logs naming a trait
 * hidden on that horse. Null-safe; other fields untouched.
 *
 * @param {object | null} horse
 * @returns {object | null}
 */
export function withVisibleTraitHistoryLogs(horse) {
  if (!horse || !Array.isArray(horse.traitHistoryLogs)) {
    return horse;
  }
  return {
    ...horse,
    traitHistoryLogs: withoutHiddenTraitHistory(
      horse.traitHistoryLogs,
      () => horse.epigeneticModifiers,
    ),
  };
}
