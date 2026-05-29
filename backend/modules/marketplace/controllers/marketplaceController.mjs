/**
 * Marketplace Controller — Epic 21
 *
 * Handles horse listing, delisting, browsing, purchasing, and sale history.
 * All purchase operations use Prisma $transaction for atomicity.
 *
 * Also handles the Horse Trader store (buyStoreHorse) — Epic 21 extension.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { createNotification } from '../../../utils/notificationService.mjs';
import { MS_PER_GAME_YEAR } from '../../../constants/time.mjs';
import { createHorse } from '../../../models/horseModel.mjs';
import { recordTransactionTx } from '../../../services/financialLedgerService.mjs';

// Shared horse starter-stats service. The same module is used by the perf
// seed so test data has the same distribution as real store-purchased
// horses. Random-stat seed paths are forbidden — see service module header.
import { generateStoreStats } from '../../../services/horseStarterStats.mjs';
import { canonicalizeHorseSex } from '../../../../packages/database/horseSexCanonical.mjs';
// 31E color genetics (Equoria-kiep): store-bought horses must arrive with a
// populated colorGenotype + phenotype, the same as foals and starter horses.
import { generateGenotype } from '../../horses/services/genotypeGenerationService.mjs';
import { calculatePhenotype } from '../../horses/services/phenotypeCalculationService.mjs';
import { generateMarkings } from '../../horses/services/markingGenerationService.mjs';
// Equoria-f5372: store-bought horses must arrive with a temperament populated,
// the same as foals and POST /horses. Without this the column is NULL and the
// frontend shows 'not recorded'.
import { generateTemperamentWithDefault } from '../../horses/services/temperamentService.mjs';

// ── Horse Trader store constants ──────────────────────────────────────────────

const STORE_PRICE = 1000;

/**
 * GET /api/v1/marketplace
 * Browse horses listed for sale (excludes requester's own horses).
 * Supports filters: breed, minAge, maxAge, minPrice, maxPrice, discipline, sort, page, limit
 */
export async function browseListings(req, res) {
  try {
    const userId = req.user.id;
    const {
      breed,
      minAge,
      maxAge,
      minPrice,
      maxPrice,
      sort = 'newest',
      page = '1',
      limit = '20',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * pageSize;

    const where = {
      forSale: true,
      userId: { not: userId },
    };

    if (breed) {
      where.breed = { name: { contains: breed, mode: 'insensitive' } };
    }
    // Filter by dateOfBirth for accurate computed age (avoids stale stored age field).
    // Equoria game-year convention: 1 game-year = 7 real days. A horse that is at
    // least minAge game-years old was born on or before now - minAge*7 days; at most
    // maxAge old means born on or after now - maxAge*7 days. (Using calendar years
    // here would exclude every correctly-aged horse, whose dob is only weeks ago.)
    if (minAge !== undefined) {
      const cutoff = new Date(Date.now() - parseInt(minAge, 10) * MS_PER_GAME_YEAR);
      where.dateOfBirth = { ...where.dateOfBirth, lte: cutoff };
    }
    if (maxAge !== undefined) {
      const cutoff = new Date(Date.now() - parseInt(maxAge, 10) * MS_PER_GAME_YEAR);
      where.dateOfBirth = { ...where.dateOfBirth, gte: cutoff };
    }
    if (minPrice !== undefined) {
      where.salePrice = { ...where.salePrice, gte: parseInt(minPrice, 10) };
    }
    if (maxPrice !== undefined) {
      where.salePrice = { ...where.salePrice, lte: parseInt(maxPrice, 10) };
    }

    let orderBy;
    switch (sort) {
      case 'price_asc':
        orderBy = { salePrice: 'asc' };
        break;
      case 'price_desc':
        orderBy = { salePrice: 'desc' };
        break;
      case 'youngest':
        orderBy = { age: 'asc' };
        break;
      case 'newest':
      default:
        orderBy = { createdAt: 'desc' };
    }

    const [horses, total] = await Promise.all([
      prisma.horse.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        include: {
          breed: { select: { name: true } },
          user: { select: { username: true } },
        },
      }),
      prisma.horse.count({ where }),
    ]);

    const listings = horses.map(h => ({
      id: h.id,
      name: h.name,
      breed: h.breed?.name ?? 'Unknown',
      age: h.age,
      sex: h.sex,
      salePrice: h.salePrice,
      seller: h.user?.username ?? 'Unknown',
      stats: {
        speed: h.speed ?? 0,
        stamina: h.stamina ?? 0,
        agility: h.agility ?? 0,
        precision: h.precision ?? 0,
        strength: h.strength ?? 0,
        intelligence: h.intelligence ?? 0,
        boldness: h.boldness ?? 0,
      },
      imageUrl: h.imageUrl,
    }));

    return res.json({
      success: true,
      data: {
        listings,
        pagination: {
          page: pageNum,
          limit: pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (err) {
    logger.error('browseListings error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * POST /api/v1/marketplace/list
 * List a horse for sale. Body: { horseId, price }
 */
export async function listHorse(req, res) {
  try {
    const { price } = req.body;
    const horse = req.horse;

    if (!horse) {
      return res.status(500).json({ success: false, message: 'Ownership middleware not applied' });
    }

    if (price === undefined) {
      return res.status(400).json({ success: false, message: 'price is required' });
    }

    const parsedPrice = parseInt(price, 10);
    if (isNaN(parsedPrice) || parsedPrice < 100 || parsedPrice > 9_999_999) {
      return res.status(400).json({
        success: false,
        message: 'Price must be between 100 and 9,999,999 coins',
      });
    }

    if (horse.forSale) {
      return res.status(400).json({ success: false, message: 'Horse is already listed for sale' });
    }

    // Equoria-kj4g7 (sibling of Equoria-alei5): conditional updateMany so two
    // concurrent listHorse calls cannot both win. The where-clause enforces
    // "still not for sale AND still owned by req.user" — if either has been
    // changed by a racing buyHorse / listHorse / delistHorse since the
    // middleware read, count===0 and we 409 instead of corrupting state.
    const claim = await prisma.horse.updateMany({
      where: { id: horse.id, userId: req.user.id, forSale: false },
      data: { forSale: true, salePrice: parsedPrice },
    });
    if (claim.count === 0) {
      return res.status(409).json({
        success: false,
        message: 'Horse state changed (already listed or sold)',
      });
    }
    const updated = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { id: true, name: true, salePrice: true },
    });

    return res.json({
      success: true,
      message: `${updated.name} is now listed for ${parsedPrice} coins`,
      data: { horseId: updated.id, salePrice: updated.salePrice },
    });
  } catch (err) {
    logger.error('listHorse error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * DELETE /api/v1/marketplace/list/:horseId
 * Delist a horse from the marketplace (owner only).
 */
export async function delistHorse(req, res) {
  try {
    // Ownership validated by requireOwnership('horse') middleware on the route.
    // req.horse is the validated, owned record.
    const horse = req.horse;

    if (!horse.forSale) {
      return res.status(400).json({ success: false, message: 'Horse is not listed for sale' });
    }

    // Equoria-kj4g7: conditional updateMany so a concurrent buyHorse cannot
    // race a delist and end up transferring ownership to a buyer for a
    // listing the owner just removed. count===0 means buyHorse already
    // cleared forSale (and transferred userId) — surface as 409.
    const claim = await prisma.horse.updateMany({
      where: { id: horse.id, userId: req.user.id, forSale: true },
      data: { forSale: false, salePrice: 0 },
    });
    if (claim.count === 0) {
      return res.status(409).json({
        success: false,
        message: 'Horse state changed (already sold or delisted)',
      });
    }

    return res.json({ success: true, message: 'Listing removed' });
  } catch (err) {
    logger.error('delistHorse error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * POST /api/v1/marketplace/buy/:horseId
 * Purchase a horse atomically: deduct buyer coins, credit seller, transfer ownership.
 */
export async function buyHorse(req, res) {
  try {
    const buyerId = req.user.id;
    const horseId = parseInt(req.params.horseId, 10);

    if (isNaN(horseId)) {
      return res.status(400).json({ success: false, message: 'Invalid horseId' });
    }

    const result = await prisma.$transaction(
      async tx => {
        // Equoria-alei5 TOCTOU fix: previously, this code did
        //   findUnique → check !forSale → decrement money → update horse,
        // which under READ COMMITTED let two concurrent buyers both pass
        // the forSale check, both get debited, and only one actually
        // owned the horse. The loser was silently charged for nothing.
        //
        // Fix: do the ownership transfer as a conditional updateMany
        // with WHERE forSale=true AND userId != buyerId. The DB
        // enforces "exactly one winner" by row-locking on UPDATE. If
        // affected rows != 1 we abort the transaction BEFORE touching
        // money, so the loser is never debited. The eligible-buyer/
        // seller validation (404/400) still runs first against the
        // pre-transfer snapshot to preserve existing error semantics
        // for the obvious failure modes; the conditional update is the
        // actual TOCTOU-safe commit point.
        const horseSnapshot = await tx.horse.findUnique({
          where: { id: horseId },
          include: { user: { select: { id: true, username: true } } },
        });

        if (!horseSnapshot) {
          throw Object.assign(new Error('Horse not found'), { statusCode: 404 });
        }
        if (!horseSnapshot.forSale) {
          throw Object.assign(new Error('Horse is not for sale'), { statusCode: 400 });
        }
        if (horseSnapshot.userId === buyerId) {
          throw Object.assign(new Error('You already own this horse'), { statusCode: 400 });
        }

        const salePrice = horseSnapshot.salePrice;
        const sellerId = horseSnapshot.userId;

        // Existence check (404) for the buyer — the conditional debit below
        // is the actual TOCTOU-safe insufficient-funds guard.
        const buyer = await tx.user.findUnique({ where: { id: buyerId } });
        if (!buyer) {
          throw Object.assign(new Error('Buyer not found'), { statusCode: 404 });
        }

        // ── Atomic ownership transfer (TOCTOU-safe) ─────────────────
        // updateMany with the strict WHERE clause guarantees at most one
        // concurrent buyer wins this row. The DB takes a row-lock on the
        // matching row; the losing transaction sees count=0 and aborts
        // BEFORE any money.decrement runs.
        const transferResult = await tx.horse.updateMany({
          where: { id: horseId, forSale: true, userId: { not: buyerId } },
          data: { userId: buyerId, forSale: false, salePrice: 0 },
        });

        if (transferResult.count !== 1) {
          // Another buyer won the race. Throw 409 (Conflict) BEFORE any
          // money movement — the rollback ensures the loser is untouched.
          throw Object.assign(new Error('Horse was purchased by another buyer'), {
            statusCode: 409,
          });
        }

        // Equoria-zz1ii: conditional buyer debit. Replaces the previous
        // user.update({decrement}) which would TOCTOU under concurrent same-
        // buyer activity (e.g., the buyer making parallel purchases on two
        // markets). The DB enforces "money >= salePrice" atomically: if the
        // buyer's balance dropped below salePrice between the existence check
        // and now, updateMany returns count=0 and we throw INSUFFICIENT_FUNDS,
        // rolling back the horse transfer in this transaction. The buyer's
        // money column is guaranteed never to go negative via this path.
        const debitResult = await tx.user.updateMany({
          where: { id: buyerId, money: { gte: salePrice } },
          data: { money: { decrement: salePrice } },
        });

        if (debitResult.count === 0) {
          throw Object.assign(new Error('Insufficient funds'), { statusCode: 400 });
        }

        // Equoria-9hja2: dropped the post-debit `tx.user.findUnique({...money})`
        // re-read — recordTransactionTx reads the authoritative balance inside
        // the same tx itself, so the caller no longer needs to surface it.

        // Credit seller
        await tx.user.update({
          where: { id: sellerId },
          data: { money: { increment: salePrice } },
        });

        // Create sale record
        const saleRecord = await tx.horseSale.create({
          data: {
            horseId,
            sellerId,
            buyerId,
            salePrice,
            horseName: horseSnapshot.name,
          },
        });

        // Equoria-9hja2: migrated to recordTransactionTx(tx, opts). tx is now
        // structurally required (first arg); balanceAfter is read inside the
        // service from the same tx (caller no longer supplies it), so the
        // post-debit/credit money mutations above and the ledger rows below
        // share rollback semantics.
        await recordTransactionTx(tx, {
          userId: buyerId,
          type: 'debit',
          amount: salePrice,
          category: 'marketplace_purchase',
          description: `Purchased ${horseSnapshot.name}`,
          metadata: { horseId, saleId: saleRecord.id, sellerId },
        });
        await recordTransactionTx(tx, {
          userId: sellerId,
          type: 'credit',
          amount: salePrice,
          category: 'marketplace_sale',
          description: `Sold ${horseSnapshot.name}`,
          metadata: { horseId, saleId: saleRecord.id, buyerId },
        });

        // Re-fetch buyer balance from within the transaction for an accurate post-purchase value
        const postPurchaseBuyer = await tx.user.findUnique({
          where: { id: buyerId },
          select: { money: true },
        });

        return {
          horseName: horseSnapshot.name,
          salePrice,
          sellerId,
          sellerUsername: horseSnapshot.user?.username ?? 'Unknown',
          saleId: saleRecord.id,
          newBalance: postPurchaseBuyer.money,
        };
      },
      { timeout: 30000 },
    ); // 30s — 7+ DB ops can exceed 5s default under full-suite load

    await createNotification(buyerId, 'horse_purchased', {
      horseName: result.horseName,
      salePrice: result.salePrice,
      sellerUsername: result.sellerUsername,
    });
    await createNotification(result.sellerId, 'horse_sold', {
      horseName: result.horseName,
      salePrice: result.salePrice,
    });

    return res.json({
      success: true,
      message: `You purchased ${result.horseName} for ${result.salePrice} coins!`,
      data: result,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    logger.error('buyHorse error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * GET /api/v1/marketplace/my-listings
 * Return the current user's active listings.
 */
export async function myListings(req, res) {
  try {
    const userId = req.user.id;

    const horses = await prisma.horse.findMany({
      where: { userId, forSale: true },
      include: { breed: { select: { name: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    const listings = horses.map(h => ({
      id: h.id,
      name: h.name,
      breed: h.breed?.name ?? 'Unknown',
      age: h.age,
      sex: h.sex,
      salePrice: h.salePrice,
      imageUrl: h.imageUrl,
    }));

    return res.json({ success: true, data: listings });
  } catch (err) {
    logger.error('myListings error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * POST /api/v1/marketplace/store/buy
 * Buy a horse from the game store. Atomically deducts STORE_PRICE coins from the
 * buyer and creates a 3-year-old horse of the chosen breed and sex.
 *
 * Body: { breedId: number, sex: 'Mare' | 'Stallion' (case-insensitive) }
 *
 * Sex is canonicalized to Title Case before persistence. Only adult
 * breeding-eligible animals (Stallion/Mare) are sold by the store.
 */
export async function buyStoreHorse(req, res) {
  const buyerId = req.user.id;
  const { breedId, sex } = req.body;

  // Validate inputs before hitting the DB
  const parsedBreedId = parseInt(breedId, 10);
  if (!parsedBreedId || parsedBreedId < 1) {
    return res.status(400).json({ success: false, message: 'Valid breedId is required' });
  }
  let canonicalSex;
  try {
    canonicalSex = canonicalizeHorseSex(sex);
  } catch {
    return res.status(400).json({ success: false, message: 'sex must be Mare or Stallion' });
  }
  if (canonicalSex !== 'Mare' && canonicalSex !== 'Stallion') {
    return res.status(400).json({ success: false, message: 'sex must be Mare or Stallion' });
  }

  // Track whether coins were deducted so the catch block can issue a refund (F1)
  let coinDeducted = false;

  try {
    // F3 fix: breed lookup is inside the transaction — eliminates TOCTOU gap between
    // breed verification and coin deduction.
    const { updatedUser, breed } = await prisma.$transaction(
      async tx => {
        const breedRecord = await tx.breed.findUnique({ where: { id: parsedBreedId } });
        if (!breedRecord) {
          throw Object.assign(new Error('Breed not found'), { statusCode: 404 });
        }

        const buyer = await tx.user.findUnique({ where: { id: buyerId } });
        if (!buyer) {
          throw Object.assign(new Error('User not found'), { statusCode: 404 });
        }
        if (buyer.money < STORE_PRICE) {
          throw Object.assign(new Error(`Insufficient funds. You need ${STORE_PRICE} coins.`), {
            statusCode: 400,
          });
        }

        const updated = await tx.user.update({
          where: { id: buyerId },
          data: { money: { decrement: STORE_PRICE } },
          select: { money: true },
        });
        // Equoria-9hja2: migrated to recordTransactionTx(tx, opts).
        await recordTransactionTx(tx, {
          userId: buyerId,
          type: 'debit',
          amount: STORE_PRICE,
          category: 'horse_trader_purchase',
          description: `Purchased ${breedRecord.name} from Horse Trader`,
          metadata: { breedId: parsedBreedId, sex: canonicalSex },
        });
        return { updatedUser: updated, breed: breedRecord };
      },
      { timeout: 30000 },
    ); // 30s — guard against 5s default under full-suite load

    // Coins are now deducted — any error after this line triggers a refund attempt (F1)
    coinDeducted = true;

    // Generate horse name and stats. Stats route through the
    // breed-name-keyed profile in breedStarterStats.json — every breed
    // follows the same system, no hardcoded exceptions.
    //
    // Names are generated with a retry loop (up to 5 attempts) to guard
    // against unlikely but possible collisions as horse population grows.
    // Each attempt picks a fresh 6-digit random suffix; if all 5 collide,
    // the purchase is aborted with a 409 so the client can retry.
    const MAX_NAME_RETRIES = 5;
    let horseName = null;
    for (let attempt = 0; attempt < MAX_NAME_RETRIES; attempt++) {
      const candidate = `${breed.name} #${String(Math.floor(100000 + Math.random() * 900000))}`;

      const existing = await prisma.horse.findFirst({
        where: { name: candidate },
        select: { id: true },
      });
      if (!existing) {
        horseName = candidate;
        break;
      }
      logger.warn(
        `[marketplace.buyStoreHorse] Name collision on attempt ${attempt + 1}: "${candidate}" — retrying`,
      );
    }
    if (!horseName) {
      throw Object.assign(
        new Error('Could not generate a unique horse name after multiple attempts'),
        {
          statusCode: 409,
        },
      );
    }
    const stats = generateStoreStats(breed.name);
    // Equoria game-year convention: 1 game-year = 7 real days. A 3-game-year
    // store horse is born 3*7 = 21 real days ago, NOT 3 calendar years ago
    // (which the canonical age helper would read as ~156 game-years).
    const STORE_HORSE_AGE_GAME_YEARS = 3;
    const dateOfBirth = new Date(Date.now() - STORE_HORSE_AGE_GAME_YEARS * MS_PER_GAME_YEAR);

    // 31E color genetics (Equoria-kiep): generate colorGenotype + phenotype the
    // same way the starter-horse (authController) and POST /api/v1/horses
    // (horseRoutes) paths do. Without this, store-bought horses ship with
    // NULL coat data and break the 31E invariant.
    //
    // Raw SQL on breedGeneticProfile mirrors horseRoutes.mjs / foalingService —
    // the JSONB column isn't always reachable via the Prisma client depending
    // on schema-drift between the app and the generated client.
    const breedProfileRows = await prisma.$queryRaw`
      SELECT "breedGeneticProfile"
      FROM breeds
      WHERE id = ${parsedBreedId}
    `;
    const breedGeneticProfile = breedProfileRows[0]?.breedGeneticProfile ?? null;
    const colorGenotype = generateGenotype(breedGeneticProfile);
    const baseColor = calculatePhenotype(colorGenotype, breedGeneticProfile?.shade_bias ?? null);
    const markings = generateMarkings(breedGeneticProfile, baseColor.colorName);
    const phenotype = { ...baseColor, ...markings };

    // Equoria-f5372: assign a permanent temperament from the breed's weights.
    const temperament = generateTemperamentWithDefault(breed.name);

    const createdHorse = await createHorse({
      name: horseName,
      breedId: parsedBreedId,
      sex: canonicalSex,
      age: 3,
      dateOfBirth: dateOfBirth.toISOString(),
      userId: buyerId,
      healthStatus: 'Excellent',
      colorGenotype,
      phenotype,
      temperament,
      ...stats,
    });

    // Store-bought horses arrive unvetted — the player must book a vet
    // check before the "Vetted" care chip turns green.
    //
    // The horse schema defaults `lastVettedDate` to `now()` and
    // createHorse() filters out falsy inputs (`...(lastVettedDate && ...)`),
    // so passing `lastVettedDate: null` to createHorse is silently a
    // no-op. Explicit follow-up update is the clean fix that doesn't
    // touch the shared createHorse contract.
    const newHorse = await prisma.horse.update({
      where: { id: createdHorse.id },
      data: { lastVettedDate: null },
    });

    logger.info(
      `[marketplace] User ${buyerId} bought store horse "${horseName}" (breed ${parsedBreedId}) for ${STORE_PRICE} coins`,
    );

    return res.status(201).json({
      success: true,
      message: `${horseName} has been added to your stable!`,
      data: {
        horse: newHorse,
        pricePaid: STORE_PRICE,
        newBalance: updatedUser.money,
      },
    });
  } catch (err) {
    // Known client errors (validation, insufficient funds, breed/user not found)
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }

    // Log the original error before branching — ensures root cause is always captured
    logger.error('[marketplace] buyStoreHorse unexpected error:', err);

    // F1 fix: createHorse (or name generation) failed after coins were deducted — refund first
    if (coinDeducted) {
      try {
        await prisma.user.update({
          where: { id: buyerId },
          data: { money: { increment: STORE_PRICE } },
        });
        logger.warn(
          `[marketplace] Refunded ${STORE_PRICE} coins to user ${buyerId} after horse creation failure`,
        );
        // Name-collision errors: refund succeeded, report 409 so client can retry
        if (err.nameCollision) {
          return res.status(409).json({
            success: false,
            message:
              'Could not generate a unique horse name. Your coins have been refunded — please try again.',
          });
        }
        return res.status(500).json({
          success: false,
          message: 'Horse creation failed. Your coins have been refunded.',
        });
      } catch (refundErr) {
        logger.error(
          `[marketplace] CRITICAL: Failed to refund ${STORE_PRICE} coins to user ${buyerId}:`,
          refundErr,
        );
        return res.status(500).json({
          success: false,
          message:
            'Horse creation failed. Please contact support — your account may need adjustment.',
        });
      }
    }

    logger.error('buyStoreHorse error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * GET /api/v1/marketplace/history
 * Return the current user's buy + sell transaction history.
 */
export async function saleHistory(req, res) {
  try {
    const userId = req.user.id;

    const sales = await prisma.horseSale.findMany({
      where: {
        OR: [{ sellerId: userId }, { buyerId: userId }],
      },
      include: {
        seller: { select: { username: true } },
        buyer: { select: { username: true } },
      },
      orderBy: { soldAt: 'desc' },
    });

    const history = sales.map(s => ({
      id: s.id,
      horseName: s.horseName,
      salePrice: s.salePrice,
      soldAt: s.soldAt,
      type: s.sellerId === userId ? 'sold' : 'bought',
      // buyer/seller may be null if the account was deleted after the transaction
      counterparty:
        s.sellerId === userId
          ? (s.buyer?.username ?? '[deleted user]')
          : (s.seller?.username ?? '[deleted user]'),
    }));

    return res.json({ success: true, data: history });
  } catch (err) {
    logger.error('saleHistory error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
