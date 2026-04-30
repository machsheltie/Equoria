/**
 * Marketplace Controller — Epic 21
 *
 * Handles horse listing, delisting, browsing, purchasing, and sale history.
 * All purchase operations use Prisma $transaction for atomicity.
 *
 * Also handles the Horse Trader store (buyStoreHorse) — Epic 21 extension.
 */

import prisma from '../../../db/index.mjs';
import logger from '../../../utils/logger.mjs';
import { createHorse } from '../../../models/horseModel.mjs';
import { recordTransaction } from '../../../services/financialLedgerService.mjs';
// Shared horse starter-stats service. The same module is used by the perf
// seed so test data has the same distribution as real store-purchased
// horses. Random-stat seed paths are forbidden — see service module header.
import { generateStoreStats } from '../../../services/horseStarterStats.mjs';

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
    // Filter by dateOfBirth for accurate computed age (avoids stale stored age field)
    if (minAge !== undefined) {
      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - parseInt(minAge, 10));
      where.dateOfBirth = { ...where.dateOfBirth, lte: cutoff };
    }
    if (maxAge !== undefined) {
      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - parseInt(maxAge, 10));
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
    const userId = req.user.id;
    const { horseId, price } = req.body;

    if (!horseId || price === undefined) {
      return res.status(400).json({ success: false, message: 'horseId and price are required' });
    }

    const parsedPrice = parseInt(price, 10);
    if (isNaN(parsedPrice) || parsedPrice < 100 || parsedPrice > 9_999_999) {
      return res.status(400).json({
        success: false,
        message: 'Price must be between 100 and 9,999,999 coins',
      });
    }

    const horse = await prisma.horse.findUnique({ where: { id: parseInt(horseId, 10) } });

    if (!horse) {
      return res.status(404).json({ success: false, message: 'Horse not found' });
    }
    if (horse.userId !== userId) {
      return res.status(403).json({ success: false, message: 'You do not own this horse' });
    }
    if (horse.forSale) {
      return res.status(400).json({ success: false, message: 'Horse is already listed for sale' });
    }

    const updated = await prisma.horse.update({
      where: { id: horse.id },
      data: { forSale: true, salePrice: parsedPrice },
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
    const userId = req.user.id;
    const horseId = parseInt(req.params.horseId, 10);

    if (isNaN(horseId)) {
      return res.status(400).json({ success: false, message: 'Invalid horseId' });
    }

    const horse = await prisma.horse.findUnique({ where: { id: horseId } });

    if (!horse) {
      return res.status(404).json({ success: false, message: 'Horse not found' });
    }
    if (horse.userId !== userId) {
      return res.status(403).json({ success: false, message: 'You do not own this horse' });
    }
    if (!horse.forSale) {
      return res.status(400).json({ success: false, message: 'Horse is not listed for sale' });
    }

    await prisma.horse.update({
      where: { id: horseId },
      data: { forSale: false, salePrice: 0 },
    });

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

    const result = await prisma.$transaction(async tx => {
      // Lock the horse row by fetching inside the transaction
      const horse = await tx.horse.findUnique({
        where: { id: horseId },
        include: { user: { select: { id: true, username: true } } },
      });

      if (!horse) {
        throw Object.assign(new Error('Horse not found'), { statusCode: 404 });
      }
      if (!horse.forSale) {
        throw Object.assign(new Error('Horse is not for sale'), { statusCode: 400 });
      }
      if (horse.userId === buyerId) {
        throw Object.assign(new Error('You already own this horse'), { statusCode: 400 });
      }

      const salePrice = horse.salePrice;
      const sellerId = horse.userId;

      // Check buyer balance
      const buyer = await tx.user.findUnique({ where: { id: buyerId } });
      if (!buyer) {
        throw Object.assign(new Error('Buyer not found'), { statusCode: 404 });
      }
      if (buyer.money < salePrice) {
        throw Object.assign(new Error('Insufficient funds'), { statusCode: 400 });
      }

      // Deduct from buyer
      const updatedBuyer = await tx.user.update({
        where: { id: buyerId },
        data: { money: { decrement: salePrice } },
        select: { money: true },
      });

      // Credit seller
      const updatedSeller = await tx.user.update({
        where: { id: sellerId },
        data: { money: { increment: salePrice } },
        select: { money: true },
      });

      // Transfer horse ownership
      await tx.horse.update({
        where: { id: horseId },
        data: { userId: buyerId, forSale: false, salePrice: 0 },
      });

      // Create sale record
      const saleRecord = await tx.horseSale.create({
        data: {
          horseId,
          sellerId,
          buyerId,
          salePrice,
          horseName: horse.name,
        },
      });

      await recordTransaction(
        {
          userId: buyerId,
          type: 'debit',
          amount: salePrice,
          category: 'marketplace_purchase',
          description: `Purchased ${horse.name}`,
          balanceAfter: updatedBuyer.money,
          metadata: { horseId, saleId: saleRecord.id, sellerId },
        },
        tx,
      );
      await recordTransaction(
        {
          userId: sellerId,
          type: 'credit',
          amount: salePrice,
          category: 'marketplace_sale',
          description: `Sold ${horse.name}`,
          balanceAfter: updatedSeller.money,
          metadata: { horseId, saleId: saleRecord.id, buyerId },
        },
        tx,
      );

      // Re-fetch buyer balance from within the transaction for an accurate post-purchase value
      const postPurchaseBuyer = await tx.user.findUnique({
        where: { id: buyerId },
        select: { money: true },
      });

      return {
        horseName: horse.name,
        salePrice,
        sellerUsername: horse.user?.username ?? 'Unknown',
        saleId: saleRecord.id,
        newBalance: postPurchaseBuyer.money,
      };
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
 * Body: { breedId: number, sex: 'mare' | 'stallion' }
 */
export async function buyStoreHorse(req, res) {
  const buyerId = req.user.id;
  const { breedId, sex } = req.body;

  // Validate inputs before hitting the DB
  const parsedBreedId = parseInt(breedId, 10);
  if (!parsedBreedId || parsedBreedId < 1) {
    return res.status(400).json({ success: false, message: 'Valid breedId is required' });
  }
  if (!['mare', 'stallion'].includes(sex)) {
    return res.status(400).json({ success: false, message: 'sex must be mare or stallion' });
  }

  // Track whether coins were deducted so the catch block can issue a refund (F1)
  let coinDeducted = false;

  try {
    // F3 fix: breed lookup is inside the transaction — eliminates TOCTOU gap between
    // breed verification and coin deduction.
    const { updatedUser, breed } = await prisma.$transaction(async tx => {
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
      await recordTransaction(
        {
          userId: buyerId,
          type: 'debit',
          amount: STORE_PRICE,
          category: 'horse_trader_purchase',
          description: `Purchased ${breedRecord.name} from Horse Trader`,
          balanceAfter: updated.money,
          metadata: { breedId: parsedBreedId, sex },
        },
        tx,
      );
      return { updatedUser: updated, breed: breedRecord };
    });

    // Coins are now deducted — any error after this line triggers a refund attempt (F1)
    coinDeducted = true;

    // Generate horse name and stats. Stats route through the
    // breed-name-keyed profile in breedStarterStats.json — every breed
    // follows the same system, no hardcoded exceptions.
    const horseName = `${breed.name} #${String(Math.floor(100000 + Math.random() * 900000))}`;
    const stats = generateStoreStats(breed.name);
    const dateOfBirth = new Date();
    dateOfBirth.setFullYear(dateOfBirth.getFullYear() - 3);

    const createdHorse = await createHorse({
      name: horseName,
      breedId: parsedBreedId,
      sex,
      age: 3,
      dateOfBirth: dateOfBirth.toISOString(),
      userId: buyerId,
      healthStatus: 'Excellent',
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

    // F1 fix: createHorse failed after coins were deducted — attempt compensating refund
    if (coinDeducted) {
      try {
        await prisma.user.update({
          where: { id: buyerId },
          data: { money: { increment: STORE_PRICE } },
        });
        logger.warn(
          `[marketplace] Refunded ${STORE_PRICE} coins to user ${buyerId} after horse creation failure`,
        );
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
