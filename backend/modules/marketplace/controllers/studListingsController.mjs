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
import { birthDateForAge } from '../../../utils/horseAge.mjs';
import { getDisplayedHealth } from '../../../utils/horseHealth.mjs';
import { toPredictionView } from '../../breeding/index.mjs';

const STUD_MODES = Object.freeze({ public: 'At Public Stud', private: 'At Private Stud' });
const MODE_BY_STATUS = Object.freeze({ 'At Public Stud': 'public', 'At Private Stud': 'private' });

// A null studFee is a legacy 0, so it sorts with the cheapest.
const ORDER_BY = Object.freeze({
  fee_asc: { studFee: { sort: 'asc', nulls: 'first' } },
  fee_desc: { studFee: { sort: 'desc', nulls: 'last' } },
  youngest: { age: 'asc' },
  newest: { createdAt: 'desc' },
});

function intParam(value) {
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : undefined;
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
    // As this viewer may see them: revealed traits; `hidden` is always empty
    // after the projection (S-Q9).
    traits: {
      positive: traits.positive ?? [],
      negative: traits.negative ?? [],
      hidden: traits.hidden ?? [],
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
    const {
      name,
      breed,
      breedId,
      minAge,
      maxAge,
      minFee,
      maxFee,
      mode = 'all',
      sort = 'newest',
    } = req.query;

    const statuses = mode === 'all' ? Object.values(STUD_MODES) : [STUD_MODES[mode]];
    if (statuses.includes(undefined)) {
      return res
        .status(400)
        .json({ success: false, message: "mode must be 'public', 'private' or 'all'" });
    }

    const pageNum = Math.max(1, intParam(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, intParam(req.query.limit) || 20));

    // Listed stallions of OTHER players only; an ownerless (erased) horse is never listed.
    const where = {
      studStatus: { in: statuses },
      sex: 'Stallion',
      AND: [{ userId: { not: null } }, { userId: { not: viewerId } }],
    };
    if (name) {
      where.name = { contains: name, mode: 'insensitive' };
    }
    if (intParam(breedId) !== undefined) {
      where.breedId = intParam(breedId);
    } else if (breed) {
      where.breed = { name: { contains: breed, mode: 'insensitive' } };
    }
    // Same game-year age convention as the sale browse (birthDateForAge).
    if (intParam(minAge) !== undefined) {
      where.dateOfBirth = { ...where.dateOfBirth, lte: birthDateForAge(intParam(minAge)) };
    }
    if (intParam(maxAge) !== undefined) {
      where.dateOfBirth = { ...where.dateOfBirth, gte: birthDateForAge(intParam(maxAge)) };
    }
    // A null studFee is a legacy row meaning 0 (design R5).
    const feeRange = {
      ...(intParam(minFee) !== undefined ? { gte: intParam(minFee) } : {}),
      ...(intParam(maxFee) !== undefined ? { lte: intParam(maxFee) } : {}),
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
        orderBy: ORDER_BY[sort] ?? ORDER_BY.newest,
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
