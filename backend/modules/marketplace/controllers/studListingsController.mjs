/**
 * Stud listings in the Marketplace horse search (Equoria-q4uem.9 slice 5).
 *
 * Owner rulings (Stacey): 2026-10-15 — the stallion owner chooses Public Stud
 * or Private Stud and sets the fee; players browse studs inside the
 * MARKETPLACE horse search page. 2026-10-16 S-Q9 — a revealed trait is public;
 * an unrevealed hidden trait stays hidden. Design §0 default — other players'
 * competition records are not shown until the owner rules.
 *
 * Every row goes through the breeding projection (toPredictionView) before the
 * DTO is built, and the DTO carries only the sale-listing field set plus the
 * stud terms: no other stats, no competition records, no owner id, no money.
 * The sale listing (GET /marketplace) is untouched.
 */
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { STUD_STATUS } from '../../../constants/schema.mjs';
import { birthDateForAge } from '../../../utils/horseAge.mjs';
import { getDisplayedHealth } from '../../../utils/horseHealth.mjs';
import { toPredictionView } from '../../breeding/index.mjs';
import {
  INT4_MAX,
  MAX_AGE_YEARS,
  boundedInt,
  ownValue,
  parseOr400,
  single,
} from '../services/listingQueryParams.mjs';

const STUD_MODES = Object.freeze({ public: STUD_STATUS.PUBLIC, private: STUD_STATUS.PRIVATE });
const MODE_BY_STATUS = Object.freeze({
  [STUD_STATUS.PUBLIC]: 'public',
  [STUD_STATUS.PRIVATE]: 'private',
});

// A null studFee is a legacy 0, so it sorts with the cheapest. Every order ends
// on `id` so ties (common: every unpriced stud reads as 0) page deterministically.
const ORDER_BY = Object.freeze({
  fee_asc: [{ studFee: { sort: 'asc', nulls: 'first' } }, { id: 'asc' }],
  fee_desc: [{ studFee: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }],
  youngest: [{ age: 'asc' }, { id: 'asc' }],
  newest: [{ createdAt: 'desc' }, { id: 'asc' }],
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
    orderBy: ownValue(ORDER_BY, sort, 'sort'),
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
    const { name, breed, breedId, minAge, maxAge, minFee, maxFee, statuses, orderBy } = params;

    const pageNum = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.limit || 20));

    // Listed stallions of OTHER players only; an ownerless (erased) horse is never listed.
    const where = {
      studStatus: { in: statuses },
      sex: 'Stallion',
      AND: [{ userId: { not: null } }, { userId: { not: viewerId } }],
    };
    if (name) {
      where.name = { contains: name, mode: 'insensitive' };
    }
    if (breedId !== undefined) {
      where.breedId = breedId;
    } else if (breed) {
      where.breed = { name: { contains: breed, mode: 'insensitive' } };
    }
    // Same game-year age convention as the sale browse (birthDateForAge).
    if (minAge !== undefined) {
      where.dateOfBirth = { ...where.dateOfBirth, lte: birthDateForAge(minAge) };
    }
    if (maxAge !== undefined) {
      where.dateOfBirth = { ...where.dateOfBirth, gte: birthDateForAge(maxAge) };
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

    const [horses, total] = await Promise.all([
      prisma.horse.findMany({
        where,
        orderBy,
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
        include: {
          breed: { select: { name: true } },
          user: { select: { username: true } },
        },
      }),
      prisma.horse.count({ where }),
    ]);

    const studs = horses.map(h => toStudListing(toPredictionView(h, { viewerId })));

    return res.json({
      success: true,
      data: {
        studs,
        pagination: {
          page: pageNum,
          limit: pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (err) {
    logger.error(`[studListings] browseStudListings failed: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
