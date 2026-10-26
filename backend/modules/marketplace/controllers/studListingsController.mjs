/**
 * Stud listings in the Marketplace horse search (Equoria-q4uem.9 slice 5).
 *
 * Owner rulings (Stacey): 2026-10-15 — the stallion owner chooses Public Stud
 * or Private Stud and sets the fee; players browse studs inside the
 * MARKETPLACE horse search page. 2026-10-16 S-Q9 — a revealed trait is public;
 * an unrevealed hidden trait stays hidden.
 *
 * Every row goes through the breeding projection (withoutUnrevealedTraits) before
 * the DTO is built, and the DTO carries only the sale-listing field set plus the
 * stud terms: no other stats, no competition records, no owner id, no money.
 * The sale listing (GET /marketplace) is untouched.
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
import {
  INT4_MAX,
  MAX_AGE_YEARS,
  boundedInt,
  ownValue,
  parseOr400,
  single,
} from '../services/listingQueryParams.mjs';

const STUD_MODES = Object.freeze({ public: studStatuses.public, private: studStatuses.private });
const MODE_BY_STATUS = Object.freeze({
  [studStatuses.public]: 'public',
  [studStatuses.private]: 'private',
});

// A null studFee is a legacy 0, so it sorts with the cheapest. Every order ends
// on `id` so ties (common: every unpriced stud reads as 0) page deterministically.
// The keyset spec (Equoria-cmw85.21) carries each column's cursor type and where its NULLs go.
const idAsc = { key: 'id', dir: 'asc', type: 'int' };
const STUD_SORT = Object.freeze({
  fee_asc: [{ key: 'studFee', dir: 'asc', type: 'int', nullable: true, nulls: 'first' }, idAsc],
  fee_desc: [{ key: 'studFee', dir: 'desc', type: 'int', nullable: true, nulls: 'last' }, idAsc],
  youngest: [{ key: 'age', dir: 'asc', type: 'int', nullable: true }, idAsc],
  newest: [{ key: 'createdAt', dir: 'desc', type: 'date', nullable: true }, idAsc],
});

/** Validate the whole query up front; every refusal is a 400 with the standard body. */
function parseStudQuery(query) {
  const mode = single(query, 'mode') ?? 'all';
  const sort = single(query, 'sort') ?? 'newest';
  return {
    name: single(query, 'name'),
    breed: single(query, 'breed'),
    breedId: boundedInt(query, 'breedId', INT4_MAX),
    minAge: boundedInt(query, 'minAge', MAX_AGE_YEARS),
    maxAge: boundedInt(query, 'maxAge', MAX_AGE_YEARS),
    minFee: boundedInt(query, 'minFee', INT4_MAX),
    maxFee: boundedInt(query, 'maxFee', INT4_MAX),
    page: boundedInt(query, 'page', INT4_MAX),
    limit: boundedInt(query, 'limit', INT4_MAX),
    statuses: mode === 'all' ? Object.values(STUD_MODES) : [ownValue(STUD_MODES, mode, 'mode')],
    cursor: single(query, 'cursor'),
    sort: ownValue(STUD_SORT, sort, 'sort'),
  };
}

/** The public stud entry. `view` is already projected. */
function toStudListing(view) {
  const traits = view.epigeneticModifiers ?? {};
  return {
    id: view.id,
    name: view.name,
    breed: view.breed?.name ?? 'Unknown',
    age: view.age,
    sex: view.sex,
    studMode: MODE_BY_STATUS[view.studStatus],
    studFee: view.studFee ?? 0,
    owner: { username: view.user?.username ?? 'Unknown' },
    // The sale-listing stat set, exactly (marketplaceController.browseListings).
    stats: {
      speed: view.speed ?? 0,
      stamina: view.stamina ?? 0,
      agility: view.agility ?? 0,
      precision: view.precision ?? 0,
      strength: view.strength ?? 0,
      intelligence: view.intelligence ?? 0,
      boldness: view.boldness ?? 0,
    },
    // Revealed traits are public (S-Q9); the projection has already removed
    // every unrevealed one.
    revealedTraits: {
      positive: traits.positive ?? [],
      negative: traits.negative ?? [],
    },
    displayedHealth: getDisplayedHealth(view),
    imageUrl: view.imageUrl,
    alsoForSale: view.forSale === true,
    salePrice: view.forSale === true ? view.salePrice : null,
  };
}

/**
 * GET /api/v1/marketplace/studs
 * Query: name, breed, breedId, minAge, maxAge, minFee, maxFee,
 *        mode = public | private | all (default all),
 *        sort = fee_asc | fee_desc | youngest | newest (default newest), page, limit (<= 100)
 */
export async function browseStudListings(req, res) {
  try {
    const viewerId = req.user.id;
    const { params, sent } = parseOr400(res, parseStudQuery, req.query);
    if (sent) {
      return undefined;
    }
    const { name, breed, breedId, minAge, maxAge, minFee, maxFee, statuses, sort, cursor } = params;

    const pageNum = Math.max(1, params.page || 1);
    const pageSize = clampLimit(params.limit);

    // Listed stallions of OTHER players only; an ownerless (erased) horse is never listed.
    const where = {
      studStatus: { in: statuses },
      sex: 'Stallion',
      AND: [
        { userId: { not: null } },
        { userId: { not: viewerId } },
        // A stallion too young to breed is never offered, even if he was
        // listed before the listing guard existed (owner ruling 2026-10-23,
        // Equoria-e7tgc.2). Same game-year convention as minAge below.
        { dateOfBirth: { lte: birthDateForAge(minBreedingAgeYears) } },
        // A retired stallion (21+) cannot breed, so he is never offered
        // (owner ruling 2026-10-23, Equoria-znpxc). A game-year is 7 days, so a
        // stallion is still 20 until the day he turns 21: born after that date.
        { dateOfBirth: { gt: birthDateForAge(maxBreedingAgeYears + 1) } },
      ],
    };
    if (name) {
      where.name = { contains: name, mode: 'insensitive' };
    }
    if (breedId !== undefined) {
      where.breedId = breedId;
    } else if (breed) {
      where.breed = { name: { contains: breed, mode: 'insensitive' } };
    }
    // Same game-year age convention as the sale browse (birthDateForAge): a
    // stallion is still maxAge until he turns maxAge + 1 (Equoria-k724f).
    if (minAge !== undefined) {
      where.dateOfBirth = { ...where.dateOfBirth, lte: birthDateForAge(minAge) };
    }
    if (maxAge !== undefined) {
      where.dateOfBirth = { ...where.dateOfBirth, gt: birthDateForAge(maxAge + 1) };
    }
    // A null studFee is a legacy row meaning 0 (design R5).
    const feeRange = {
      ...(minFee !== undefined ? { gte: minFee } : {}),
      ...(maxFee !== undefined ? { lte: maxFee } : {}),
    };
    if (Object.keys(feeRange).length > 0) {
      const zeroInRange = (feeRange.gte ?? 0) <= 0 && (feeRange.lte ?? 0) >= 0;
      where.AND.push(
        zeroInRange ? { OR: [{ studFee: feeRange }, { studFee: null }] } : { studFee: feeRange },
      );
    }

    // Keyset page (Equoria-cmw85.21): `cursor` continues a list, `page` still works
    // without one; only a request that is not a cursor continuation pays for the count.
    const [{ items: horses, pageInfo }, total] = await Promise.all([
      findKeysetPage(args => prisma.horse.findMany(args), {
        where,
        sort,
        limit: pageSize,
        cursor,
        skip: (pageNum - 1) * pageSize,
        extra: {
          include: {
            breed: { select: { name: true } },
            user: { select: { username: true } },
          },
        },
      }),
      cursor ? Promise.resolve(undefined) : prisma.horse.count({ where }),
    ]);

    const studs = horses.map(h => toStudListing(withoutUnrevealedTraits(h)));

    return res.json({
      success: true,
      data: {
        studs,
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
    logger.error(`[studListings] browseStudListings failed: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
