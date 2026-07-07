/**
 * Rider Marketplace Controller
 * Handles GET /marketplace, POST /marketplace/hire, POST /marketplace/refresh.
 *
 * State is persisted in the database (staff_marketplace_state table, staffType='rider').
 */

import {
  generateRiderMarketplace,
  riderMarketplaceNeedsRefresh,
  getRiderRefreshCost,
  RIDER_MARKETPLACE_CONFIG,
} from '../services/riderMarketplace.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { withRetryableTxMapping } from '../../../utils/retryableTransaction.mjs';
import {
  recordTransactionTx,
  debitMoneyOrThrow,
  InsufficientFundsError,
  SYSTEM_ACCOUNT_BURN,
} from '../../economy/index.mjs';
// Equoria-oey96.8: roster-cap enforcement. Same-module config deep import;
// getStableLevel via the users barrel (cross-module); shared roster-cap error.
import { getRiderRosterCap } from '../config/riderConfig.mjs';
import { getStableLevel } from '../../users/index.mjs';
import { RosterCapExceededError } from '../../../errors/index.mjs';

const STAFF_TYPE = 'rider';

/**
 * Load (or auto-generate) the persisted marketplace state for a user.
 */
async function loadOrCreateMarketplace(userId) {
  const record = await prisma.staffMarketplaceState.findUnique({
    where: { userId_staffType: { userId, staffType: STAFF_TYPE } },
  });

  if (!record || riderMarketplaceNeedsRefresh(record.lastRefresh)) {
    const riders = generateRiderMarketplace();
    const refreshCount = (record?.refreshCount ?? 0) + 1;
    const updated = await prisma.staffMarketplaceState.upsert({
      where: { userId_staffType: { userId, staffType: STAFF_TYPE } },
      create: { userId, staffType: STAFF_TYPE, offers: riders, refreshCount },
      update: { offers: riders, lastRefresh: new Date(), refreshCount },
    });
    logger.info(
      `[riderMarketplace] Generated new marketplace for user ${userId} with ${riders.length} riders`,
    );
    return {
      offers: updated.offers,
      lastRefresh: updated.lastRefresh,
      refreshCount: updated.refreshCount,
    };
  }

  return {
    offers: record.offers,
    lastRefresh: record.lastRefresh,
    refreshCount: record.refreshCount,
  };
}

/**
 * GET /api/riders/marketplace
 */
export async function getRiderMarketplace(req, res) {
  try {
    const userId = req.user.id;
    const { offers, lastRefresh, refreshCount } = await loadOrCreateMarketplace(userId);

    const nextFreeRefresh = new Date(lastRefresh);
    nextFreeRefresh.setHours(
      nextFreeRefresh.getHours() + RIDER_MARKETPLACE_CONFIG.REFRESH_INTERVAL_HOURS,
    );
    const refreshCost = getRiderRefreshCost(lastRefresh);

    res.status(200).json({
      success: true,
      message: 'Rider marketplace retrieved successfully',
      data: {
        riders: offers,
        lastRefresh,
        nextFreeRefresh,
        refreshCost,
        canRefreshFree: refreshCost === 0,
        refreshCount,
      },
    });
  } catch (error) {
    logger.error(`[riderMarketplace] Error getting marketplace: ${error.message}`);
    res
      .status(500)
      .json({ success: false, message: 'Failed to get rider marketplace', data: null });
  }
}

/**
 * POST /api/riders/marketplace/refresh
 */
export async function refreshRiderMarketplace(req, res) {
  try {
    const userId = req.user.id;
    const { force = false } = req.body;

    const record = await prisma.staffMarketplaceState.findUnique({
      where: { userId_staffType: { userId, staffType: STAFF_TYPE } },
    });
    const refreshCost = getRiderRefreshCost(record?.lastRefresh ?? null);

    if (refreshCost > 0 && !force) {
      return res.status(400).json({
        success: false,
        message: `Marketplace refresh costs $${refreshCost}. Set force=true to pay for refresh.`,
        data: { cost: refreshCost },
      });
    }

    if (refreshCost > 0 && force) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { money: true } });
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found', data: null });
      }
      if (user.money < refreshCost) {
        return res.status(400).json({
          success: false,
          message: `Insufficient funds. Refresh costs $${refreshCost}`,
          data: { required: refreshCost, available: user.money },
        });
      }
    }

    // Equoria-t65fh (hjtys follow-up #4): wrap the paid-refresh debit AND
    // the staffMarketplaceState.upsert in a single $transaction so the two
    // writes share rollback semantics. Pre-fix: a debit succeeded against
    // bare prisma (autocommit), and then an upsert failure left the user
    // charged with NO refreshed offer list persisted. The conditional
    // debit moves inside the tx with debitMoneyOrThrow(tx, ...) for
    // concurrency safety; InsufficientFundsError surfaces as a 400.
    const riders = generateRiderMarketplace();
    const refreshCount = (record?.refreshCount ?? 0) + 1;
    let updated;
    try {
      updated = await withRetryableTxMapping(
        prisma.$transaction(async tx => {
          if (refreshCost > 0 && force) {
            // Equoria-kl16c: paired SystemAccount burn credit (money conservation).
            await debitMoneyOrThrow(tx, {
              userId,
              amount: refreshCost,
              systemAccount: SYSTEM_ACCOUNT_BURN,
              category: 'rider_marketplace_refresh_burn',
              description: 'Rider marketplace refresh fee',
              metadata: { staffType: STAFF_TYPE },
            });
          }
          return tx.staffMarketplaceState.upsert({
            where: { userId_staffType: { userId, staffType: STAFF_TYPE } },
            create: { userId, staffType: STAFF_TYPE, offers: riders, refreshCount },
            update: { offers: riders, lastRefresh: new Date(), refreshCount },
          });
        }),
        { message: 'The marketplace is busy right now, please retry in a moment.' },
      );
    } catch (txErr) {
      if (txErr instanceof InsufficientFundsError) {
        return res.status(400).json({
          success: false,
          message: `Insufficient funds. Refresh costs $${refreshCost}`,
          data: { required: refreshCost },
        });
      }
      throw txErr;
    }

    const nextFreeRefresh = new Date(updated.lastRefresh);
    nextFreeRefresh.setHours(
      nextFreeRefresh.getHours() + RIDER_MARKETPLACE_CONFIG.REFRESH_INTERVAL_HOURS,
    );

    res.status(200).json({
      success: true,
      message: 'Rider marketplace refreshed successfully',
      data: {
        riders: updated.offers,
        lastRefresh: updated.lastRefresh,
        nextFreeRefresh,
        refreshCost: 0,
        canRefreshFree: true,
        refreshCount: updated.refreshCount,
      },
    });
  } catch (error) {
    // Equoria-7x9po: surface the retryable 503 from withRetryableTxMapping.
    if (error?.status === 503) {
      return res.status(503).json({ success: false, message: error.message, data: null });
    }
    logger.error(`[riderMarketplace] Error refreshing marketplace: ${error.message}`);
    res
      .status(500)
      .json({ success: false, message: 'Failed to refresh rider marketplace', data: null });
  }
}

/**
 * POST /api/riders/marketplace/hire
 */
export async function hireRiderFromMarketplace(req, res) {
  try {
    const userId = req.user.id;
    const { marketplaceId } = req.body;

    if (!marketplaceId) {
      return res
        .status(400)
        .json({ success: false, message: 'marketplaceId is required', data: null });
    }

    const record = await prisma.staffMarketplaceState.findUnique({
      where: { userId_staffType: { userId, staffType: STAFF_TYPE } },
    });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'No marketplace found. Please refresh marketplace first.',
        data: null,
      });
    }

    const offers = Array.isArray(record.offers) ? record.offers : [];
    const riderIndex = offers.findIndex(r => r.marketplaceId === marketplaceId);
    if (riderIndex === -1) {
      return res
        .status(404)
        .json({ success: false, message: 'Rider not found in marketplace', data: null });
    }

    const riderData = offers[riderIndex];
    const hiringCost = riderData.weeklyRate; // One week upfront

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { money: true, level: true },
    });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found', data: null });
    }

    // Equoria-oey96.8: roster cap scales by stable level (getStableLevel derives
    // it from User.level). Fast-path reject for an already-full user so we don't
    // open a tx for a hire that can't land. This read is TOCTOU on its own, so
    // it is NOT the authoritative guard (the in-tx post-lock re-count below is);
    // it only avoids the tx for the common sequential at-cap case.
    const rosterCap = getRiderRosterCap(getStableLevel(user));
    const activeRiderCount = await prisma.rider.count({ where: { userId, retired: false } });
    if (activeRiderCount >= rosterCap) {
      return res.status(400).json({
        success: false,
        message: `You have reached your rider roster cap of ${rosterCap}. Retire a rider or raise your stable level before hiring another.`,
        data: { currentCount: activeRiderCount, maxAllowed: rosterCap },
      });
    }

    if (user.money < hiringCost) {
      return res.status(400).json({
        success: false,
        message: `Insufficient funds. Hiring costs $${hiringCost} (one week upfront)`,
        data: { required: hiringCost, available: user.money },
      });
    }

    // Equoria-kyrqo: wrap rider.create + conditional money debit in a single
    // transaction. Previously the two writes were unrelated calls — if the
    // debit failed after the create succeeded, the rider existed with no
    // money charged. The conditional updateMany (money>=hiringCost) also
    // closes the TOCTOU between the pre-tx check (line 193) and the debit:
    // concurrent hires that both pass the pre-check race here, and only the
    // first satisfies the predicate; the second sees count===0 and throws,
    // rolling back the rider.create.
    //
    // Equoria-vp393: the ledger row (previously a separate best-effort
    // recordTransaction() AFTER the tx committed — Equoria-jmn75) is now
    // pulled INSIDE the same tx via recordTransactionTx. Rollback parity:
    // a ledger insert failure now rolls the rider create + money debit
    // back, eliminating the "rider exists with no ledger trail" defect
    // class. balanceAfter is dropped from the caller payload —
    // recordTransactionTx reads it via tx so the recorded balance cannot
    // lag the actual post-debit value.
    let newRider;
    let updatedUser;
    try {
      ({ newRider, updatedUser } = await withRetryableTxMapping(
        prisma.$transaction(async tx => {
          const rider = await tx.rider.create({
            data: {
              userId,
              firstName: riderData.firstName,
              lastName: riderData.lastName,
              personality: riderData.personality,
              skillLevel: riderData.skillLevel,
              speciality: riderData.speciality,
              weeklyRate: riderData.weeklyRate,
              experience: riderData.experience,
              bio: riderData.bio,
            },
          });
          // Equoria-hjzwt: shared atomic debit helper.
          // Equoria-kl16c: paired SystemAccount burn credit (money conservation).
          const moneyAfter = await debitMoneyOrThrow(tx, {
            userId,
            amount: hiringCost,
            systemAccount: SYSTEM_ACCOUNT_BURN,
            category: 'rider_hire_burn',
            description: `Rider hire fee — ${rider.firstName} ${rider.lastName}`,
            metadata: { riderId: rider.id, marketplaceId },
          });
          // Equoria-oey96.8: authoritative roster-cap re-count (mirrors the groom
          // Equoria-n4m5j / hduc5 pattern). debitMoneyOrThrow above row-locked the
          // User row, so concurrent same-user hires serialize through here and this
          // count observes every committed sibling. rider.create ran first, so the
          // count INCLUDES this hire — if it now exceeds the cap the last slot was
          // already taken by a racing sibling; throw so the create + debit + ledger
          // roll back together (no over-cap rider, no charge, no ledger row). Only
          // NON-retired riders count. rosterCap is read from the pre-tx User.level
          // (monotonic; a concurrent level-up only RAISES the cap, so the stale
          // value is the conservative choice — never permits over-cap).
          const rosterCountInTx = await tx.rider.count({ where: { userId, retired: false } });
          if (rosterCountInTx > rosterCap) {
            throw new RosterCapExceededError(
              `You have reached your rider roster cap of ${rosterCap}. Retire a rider or raise your stable level before hiring another.`,
            );
          }
          // Equoria-vp393: ledger inside the same tx — caller-supplied
          // balanceAfter dropped (recordTransactionTx reads it via tx).
          await recordTransactionTx(tx, {
            userId,
            type: 'debit',
            amount: hiringCost,
            category: 'rider_hire',
            description: `Hired rider ${rider.firstName} ${rider.lastName}`,
            metadata: { riderId: rider.id, marketplaceId },
          });
          const userAfter = { money: moneyAfter };
          return { newRider: rider, updatedUser: userAfter };
        }),
        { message: 'The marketplace is busy right now, please retry in a moment.' },
      ));
    } catch (txErr) {
      // Equoria-oey96.8: the post-lock re-count rejected an over-cap racing hire.
      // rider.create + debit + ledger rolled back atomically (user left at exactly
      // the cap, not charged, no rider row, no ledger row).
      if (txErr instanceof RosterCapExceededError) {
        return res.status(400).json({
          success: false,
          message: txErr.message,
          data: { maxAllowed: rosterCap },
        });
      }
      if (txErr instanceof InsufficientFundsError) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient funds at debit time (concurrent hire?)',
          data: null,
        });
      }
      throw txErr;
    }

    // Remove hired rider from persisted offer list
    const updatedOffers = offers.filter((_, i) => i !== riderIndex);
    await prisma.staffMarketplaceState.update({
      where: { userId_staffType: { userId, staffType: STAFF_TYPE } },
      data: { offers: updatedOffers },
    });

    logger.info(`[riderMarketplace] User ${userId} hired rider ${newRider.id} for $${hiringCost}`);

    res.status(201).json({
      success: true,
      message: 'Rider hired successfully',
      data: {
        rider: { ...newRider, name: `${newRider.firstName} ${newRider.lastName}` },
        cost: hiringCost,
        remainingMoney: updatedUser.money,
      },
    });
  } catch (error) {
    // Equoria-7x9po: surface the retryable 503 from withRetryableTxMapping.
    if (error?.status === 503) {
      return res.status(503).json({ success: false, message: error.message, data: null });
    }
    logger.error(`[riderMarketplace] Error hiring rider: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to hire rider', data: null });
  }
}
