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
 *   2026-10-28 q205 / q215 / q174 / q213 — visitors see everything on a
 *     horse's page, read-only: the show record (Win/Place/Show, Winnings,
 *     Points), the Horse Details (breed, age, birth, colour with shade,
 *     markings, temperament), the Care Team, and Trait Discovery: every
 *     revealed and dormant trait by name and a COUNT of hidden ones (players
 *     may know how many traits a horse carries, never a hidden name).
 *
 * It composes Horses data with the Breeding projection (withoutUnrevealedTraits)
 * and the Marketplace sale fields, so it lives above the domain modules.
 *
 * Coordinator directive 2026-10-28 (q205): the visitor page is the owner's
 * horse page, read-only, so this read also carries what each of that page's
 * visitor tabs shows (Overview, Disciplines, Genetics, Conformation, Gaits,
 * Show Results, Pedigree, Stud/Sale): all twelve stats, discipline scores,
 * conformation, gaits, health bands and bond, conformation title, offspring.
 * The show results ledger pages through GET /horses/:id/visit/show-results.
 *
 * The view is an allow-list: nothing from the horse row reaches the response
 * unless it is named below. No owner id, no balance, no genotype, no hidden
 * trait name.
 */
import prisma from '../../../packages/database/prismaClient.mjs';
import { studStatuses } from '../../constants/schema.mjs';
import { withHealth } from '../../utils/horseHealth.mjs';
import { getHorseAgeYears } from '../../utils/horseAge.mjs';
import { asFlagObject } from '../../utils/jsonbArrayGuard.mjs';
import { withoutUnrevealedTraits } from '../../modules/breeding/index.mjs';
import { dormantTraitKeys, publicTraitModifiers } from '../../utils/publicTraitView.mjs';
import { playerTraitDefinition } from '../../utils/epigeneticTraits.mjs';
import { calculateOverallConformation } from '../../modules/horses/index.mjs';

const studModeByStatus = Object.freeze({
  [studStatuses.public]: 'public',
  [studStatuses.private]: 'private',
});

const statNames = Object.freeze([
  'precision',
  'strength',
  'speed',
  'agility',
  'endurance',
  'intelligence',
  'stamina',
  'balance',
  'boldness',
  'flexibility',
  'obedience',
  'focus',
]);

/** All twelve stats, as the owner's page shows them (q205: visitors see everything). */
function publicStats(horse) {
  return Object.fromEntries(statNames.map(name => [name, horse[name] ?? 0]));
}

/** A JSON column's numeric entries, or null when the column holds no object. */
function numbersOf(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, entry]) => typeof entry === 'number' && Number.isFinite(entry),
    ),
  );
}

/** Conformation as the owner's Conformation tab reads it; null for a horse without scores. */
function conformationOf(row) {
  const scores = numbersOf(row.conformationScores);
  if (!scores || Object.keys(scores).length === 0) {
    return null;
  }
  return {
    ...scores,
    overallConformation:
      scores.overallConformation ?? calculateOverallConformation(row.conformationScores),
  };
}

/** Gait scores as the owner's Gaits tab reads them; null for a horse without them. */
function gaitsOf(row) {
  const gaits = row.gaitScores;
  return gaits !== null && typeof gaits === 'object' && !Array.isArray(gaits) ? gaits : null;
}

function parentOf(row) {
  return row ? { id: row.id, name: row.name } : null;
}

/** "4", "1st" or 4 -> 4; anything else -> 0 (the horse page's rule). */
function placementNumber(placement) {
  if (typeof placement === 'number') {
    return placement;
  }
  const match = String(placement ?? '').match(/^(\d+)/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

/**
 * Win/Place/Show (1st, 2nd, 3rd finishes, q224), Winnings (prize money of
 * every result) and Points (cumulative Horse Points): the line under the
 * horse's name (q225), the same counts the owner's competition history reads.
 */
async function showRecordOf(row) {
  const groups = await prisma.competitionResult.groupBy({
    by: ['placement'],
    where: { horseId: row.id },
    _count: { _all: true },
    _sum: { prizeWon: true },
  });
  const record = {
    wins: 0,
    secondPlaces: 0,
    thirdPlaces: 0,
    winnings: 0,
    points: row.horseXp ?? 0,
  };
  for (const group of groups) {
    const place = placementNumber(group.placement);
    if (place === 1) {
      record.wins += group._count._all;
    } else if (place === 2) {
      record.secondPlaces += group._count._all;
    } else if (place === 3) {
      record.thirdPlaces += group._count._all;
    }
    record.winnings += Number(group._sum.prizeWon ?? 0);
  }
  return record;
}

const staffSelect = { firstName: true, lastName: true, starLevel: true };
const staffName = staff => `${staff.firstName} ${staff.lastName}`.trim();

/**
 * The horse's Care Team as a visitor sees it (q205): each assigned staff
 * member's name and star level, or null. Only staff on the horse owner's own
 * books count, as on the owner's page.
 */
async function careTeamOf(row) {
  const ownerId = row.userId;
  if (!ownerId) {
    return { trainer: null, groom: null, rider: null };
  }
  const [trainer, groom, rider] = await Promise.all([
    prisma.trainerAssignment.findFirst({
      where: { horseId: row.id, isActive: true, trainer: { userId: ownerId } },
      orderBy: { id: 'asc' },
      select: { trainer: { select: staffSelect } },
    }),
    prisma.groomAssignment.findFirst({
      where: { foalId: row.id, isActive: true, groom: { userId: ownerId } },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      select: { groom: { select: { name: true, starLevel: true } } },
    }),
    prisma.riderAssignment.findFirst({
      where: { horseId: row.id, isActive: true, rider: { userId: ownerId } },
      orderBy: { id: 'asc' },
      select: { rider: { select: staffSelect } },
    }),
  ]);
  return {
    trainer: trainer
      ? { name: staffName(trainer.trainer), starLevel: trainer.trainer.starLevel }
      : null,
    groom: groom ? { name: groom.groom.name, starLevel: groom.groom.starLevel } : null,
    rider: rider ? { name: staffName(rider.rider), starLevel: rider.rider.starLevel } : null,
  };
}

/** One named trait as a player may see it: authored label, never the rarity. */
function namedTrait(key) {
  const definition = playerTraitDefinition(key);
  return {
    key,
    label: definition?.label ?? null,
    type: definition?.type ?? null,
    description: definition?.description ?? null,
  };
}

/**
 * Trait Discovery (q174 / q213): revealed and dormant traits by name, hidden
 * traits as a count only.
 */
function traitDiscoveryOf(row) {
  const view = publicTraitModifiers(row.epigeneticModifiers);
  return {
    positive: view.positive.map(namedTrait),
    negative: view.negative.map(namedTrait),
    dormant: dormantTraitKeys(row.epigeneticModifiers).map(namedTrait),
    hiddenCount: view.hiddenCount,
  };
}

/** The visible phenotype: colour, shade and markings (never the genotype). */
function coatOf(phenotype) {
  const text = value => (typeof value === 'string' && value.length > 0 ? value : null);
  return {
    shade: text(phenotype.shade),
    faceMarking: text(phenotype.faceMarking),
    legMarkings:
      phenotype.legMarkings &&
      typeof phenotype.legMarkings === 'object' &&
      !Array.isArray(phenotype.legMarkings)
        ? phenotype.legMarkings
        : null,
  };
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
  const health = withHealth(row);
  const [showRecord, careTeam, offspring] = await Promise.all([
    showRecordOf(row),
    careTeamOf(row),
    prisma.horse.findMany({
      where: { OR: [{ sireId: row.id }, { damId: row.id }] },
      select: { id: true, name: true },
      orderBy: [{ dateOfBirth: 'asc' }, { id: 'asc' }],
    }),
  ]);

  return {
    id: row.id,
    name: row.name,
    breed: row.breed?.name ?? null,
    sex: row.sex,
    age: row.dateOfBirth ? getHorseAgeYears(row.dateOfBirth) : null,
    colorName: typeof phenotype.colorName === 'string' ? phenotype.colorName : null,
    ...coatOf(phenotype),
    dateOfBirth: row.dateOfBirth ?? null,
    temperament: row.temperament ?? null,
    showRecord,
    careTeam,
    traitDiscovery: traitDiscoveryOf(row),
    imageUrl: row.imageUrl ?? null,
    stats: publicStats(row),
    revealedTraits: {
      positive: Array.isArray(traits.positive) ? traits.positive : [],
      negative: Array.isArray(traits.negative) ? traits.negative : [],
    },
    displayedHealth: health.displayedHealth,
    feedHealth: health.feedHealth,
    bondScore: typeof row.bondScore === 'number' ? row.bondScore : null,
    breedId: row.breedId ?? null,
    disciplineScores: numbersOf(row.disciplineScores) ?? {},
    conformation: conformationOf(row),
    gaitScores: gaitsOf(row),
    currentTitle: row.currentTitle ?? null,
    titlePoints: row.titlePoints ?? 0,
    breedingValueBoost: row.breedingValueBoost ?? 0,
    offspring,
    sire: parentOf(row.sire),
    dam: parentOf(row.dam),
    owner: row.user ? { username: row.user.username } : null,
    isOwn: row.userId === viewerId,
    stud: studMode ? { mode: studMode, fee: row.studFee ?? 0 } : null,
    forSale: row.forSale === true,
    salePrice: row.forSale === true ? row.salePrice : null,
  };
}
