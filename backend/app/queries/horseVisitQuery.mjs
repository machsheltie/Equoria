/**
 * A visit to any player's horse: the one horse page in visitor mode
 * (application query layer; Equoria-q4uem.9).
 *
 * Owner rulings (Stacey):
 *   2026-10-26 q90 — another player's horse opens the same horse page in a
 *     read-only visitor mode: public facts only, plus a "Standing at stud"
 *     plaque with the fee, Public or Private, and the owner.
 *   2026-10-27 q107 — a requesting mare is seen the same way: stats, revealed
 *     traits, lineage and health. Hidden traits stay hidden.
 *   2026-10-16 S-Q9 / 2026-10-19 — a revealed trait is public forever; an
 *     unrevealed hidden trait is seen by no player, the owner included.
 *
 * It composes Horses data with the Breeding projection (withoutUnrevealedTraits)
 * and the Marketplace sale fields, so it lives above the domain modules.
 *
 * The view is an allow-list: nothing from the horse row reaches the response
 * unless it is named below. No owner id, no money, no genotype, no hidden
 * trait (not even a count), no care or training state.
 */
import prisma from '../../../packages/database/prismaClient.mjs';
import { studStatuses } from '../../constants/schema.mjs';
import { getDisplayedHealth } from '../../utils/horseHealth.mjs';
import { getHorseAgeYears } from '../../utils/horseAge.mjs';
import { asFlagObject } from '../../utils/jsonbArrayGuard.mjs';
import { withoutUnrevealedTraits } from '../../modules/breeding/index.mjs';

const studModeByStatus = Object.freeze({
  [studStatuses.public]: 'public',
  [studStatuses.private]: 'private',
});

/** The horse's stats a visitor sees: the same seven as a sale or stud listing. */
function publicStats(horse) {
  return {
    speed: horse.speed ?? 0,
    stamina: horse.stamina ?? 0,
    agility: horse.agility ?? 0,
    precision: horse.precision ?? 0,
    strength: horse.strength ?? 0,
    intelligence: horse.intelligence ?? 0,
    boldness: horse.boldness ?? 0,
  };
}

function parentOf(row) {
  return row ? { id: row.id, name: row.name } : null;
}

/**
 * The visitor view of a horse, or null when there is no such horse.
 *
 * @param {number} horseId
 * @param {string} viewerId
 */
export async function getHorseVisit(horseId, viewerId) {
  const row = await prisma.horse.findUnique({
    where: { id: horseId },
    include: {
      breed: { select: { name: true } },
      user: { select: { username: true } },
      sire: { select: { id: true, name: true } },
      dam: { select: { id: true, name: true } },
    },
  });
  if (!row) {
    return null;
  }
  const view = withoutUnrevealedTraits(row);
  const traits = asFlagObject(view.epigeneticModifiers);
  const phenotype = asFlagObject(row.phenotype);
  const studMode = studModeByStatus[row.studStatus] ?? null;

  return {
    id: row.id,
    name: row.name,
    breed: row.breed?.name ?? null,
    sex: row.sex,
    age: row.dateOfBirth ? getHorseAgeYears(row.dateOfBirth) : null,
    colorName: typeof phenotype.colorName === 'string' ? phenotype.colorName : null,
    imageUrl: row.imageUrl ?? null,
    stats: publicStats(row),
    revealedTraits: {
      positive: Array.isArray(traits.positive) ? traits.positive : [],
      negative: Array.isArray(traits.negative) ? traits.negative : [],
    },
    displayedHealth: getDisplayedHealth(row),
    sire: parentOf(row.sire),
    dam: parentOf(row.dam),
    owner: row.user ? { username: row.user.username } : null,
    isOwn: row.userId === viewerId,
    stud: studMode ? { mode: studMode, fee: row.studFee ?? 0 } : null,
    forSale: row.forSale === true,
    salePrice: row.forSale === true ? row.salePrice : null,
  };
}
