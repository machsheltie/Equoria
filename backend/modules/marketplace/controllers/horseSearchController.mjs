/**
 * GET /api/v1/marketplace/search: the Marketplace all-horses search
 * (Equoria-q4uem.9.1, owner ruling 2026-10-27 q104).
 *
 * Every row goes through withoutUnrevealedTraits before the DTO is built, and the
 * DTO carries only public facts: no owner id, no money, no hidden trait. It replaced
 * the sale browse (GET /marketplace) and the stud browse (GET /marketplace/studs), which are removed.
 */
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import {
  InvalidCursorError,
  clampLimit,
  findKeysetPage,
} from '../../../utils/paginationHelper.mjs';
import { studStatuses } from '../../../constants/schema.mjs';
import { birthDateForAge } from '../../../utils/horseAge.mjs';
import { getDisplayedHealth } from '../../../utils/horseHealth.mjs';
import { withoutUnrevealedTraits } from '../../breeding/index.mjs';
import { minBreedingAgeYears, maxBreedingAgeYears } from '../../horses/index.mjs';
import { parseOr400 } from '../services/listingQueryParams.mjs';
import { horseSearchWhere, parseHorseSearch } from '../services/horseSearchQuery.mjs';

const modeByStatus = Object.freeze({
  [studStatuses.public]: 'public',
  [studStatuses.private]: 'private',
});

/** A stallion stands at stud only from 3 to 20, whatever his stored status says. */
function standsAtStud(row) {
  const born = new Date(row.dateOfBirth);
  return (
    row.sex === 'Stallion' &&
    modeByStatus[row.studStatus] !== undefined &&
    born <= birthDateForAge(minBreedingAgeYears) &&
    born > birthDateForAge(maxBreedingAgeYears + 1)
  );
}

function toSearchRow(view) {
  const traits = view.epigeneticModifiers ?? {};
  return {
    id: view.id,
    name: view.name,
    breed: view.breed?.name ?? 'Unknown',
    age: view.age,
    sex: view.sex,
    color: view.phenotype?.colorName ?? null,
    owner: { username: view.user?.username ?? 'Unknown' },
    stats: {
      speed: view.speed ?? 0,
      stamina: view.stamina ?? 0,
      agility: view.agility ?? 0,
      precision: view.precision ?? 0,
      strength: view.strength ?? 0,
      intelligence: view.intelligence ?? 0,
      boldness: view.boldness ?? 0,
    },
    // Revealed traits are public; the projection has already removed every unrevealed one.
    revealedTraits: { positive: traits.positive ?? [], negative: traits.negative ?? [] },
    displayedHealth: getDisplayedHealth(view),
    imageUrl: view.imageUrl,
    sale: view.forSale === true ? { price: view.salePrice ?? 0 } : null,
    stud: standsAtStud(view)
      ? { mode: modeByStatus[view.studStatus], fee: view.studFee ?? 0 }
      : null,
  };
}

export async function searchHorses(req, res) {
  try {
    const { params, sent } = parseOr400(res, parseHorseSearch, req.query);
    if (sent) {
      return undefined;
    }
    const pageNum = Math.max(1, params.page || 1);
    const pageSize = clampLimit(params.limit);
    const where = horseSearchWhere(params, req.user.id);

    const [{ items, pageInfo }, total] = await Promise.all([
      findKeysetPage(args => prisma.horse.findMany(args), {
        where,
        sort: params.sort,
        limit: pageSize,
        cursor: params.cursor,
        skip: (pageNum - 1) * pageSize,
        extra: {
          include: { breed: { select: { name: true } }, user: { select: { username: true } } },
        },
      }),
      params.cursor ? Promise.resolve(undefined) : prisma.horse.count({ where }),
    ]);

    return res.json({
      success: true,
      data: {
        horses: items.map(h => toSearchRow(withoutUnrevealedTraits(h))),
        pagination: {
          page: pageNum,
          limit: pageSize,
          total,
          totalPages: total === undefined ? undefined : Math.ceil(total / pageSize),
        },
        pageInfo,
      },
    });
  } catch (err) {
    if (err instanceof InvalidCursorError) {
      return res.status(400).json({ success: false, message: err.message });
    }
    logger.error(`[horseSearch] searchHorses failed: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
