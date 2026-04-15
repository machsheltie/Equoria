/**
 * Bank Controller — Weekly Reward Claim
 *
 * Handles the weekly coin reward system. Users can claim 500 coins once per week,
 * resetting every Sunday at midnight UTC. Missed weeks do not roll over.
 *
 * Uses atomic SQL (jsonb_set) to prevent TOCTOU race conditions and JSONB clobber.
 * Stores last claim date in User.settings.lastWeeklyClaimDate (ISO string).
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import {
  getTransactionsForUser,
  recordTransaction,
} from '../../../services/financialLedgerService.mjs';

/** Amount of coins awarded per weekly claim */
const WEEKLY_REWARD_AMOUNT = 500;

/**
 * Get the most recent Sunday at 00:00 UTC.
 * If today is Sunday, returns today at 00:00 UTC.
 * Weekly rewards reset every Sunday.
 */
export function getCurrentWeekStart() {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
  const sunday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day, 0, 0, 0, 0),
  );
  return sunday;
}

/**
 * POST /api/v1/bank/claim
 *
 * Claim the weekly 500-coin reward. Resets every Sunday at midnight UTC.
 * Uses atomic SQL to prevent double-claim race conditions.
 * Returns { success, newBalance, nextClaimDate }.
 */
export async function claimWeeklyReward(req, res) {
  try {
    const userId = req.user?.id || req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    const weekStart = getCurrentWeekStart();
    const weekStartISO = weekStart.toISOString();
    const nowISO = new Date().toISOString();

    const updatedRows = await prisma.$transaction(async tx => {
      // Atomic check-and-update: only succeeds if not already claimed this week.
      // Uses jsonb_set to avoid clobbering other settings fields.
      const rows = await tx.$queryRawUnsafe(
        `UPDATE "User"
         SET money = money + $1,
             settings = jsonb_set(
               COALESCE(settings, '{}'::jsonb),
               '{lastWeeklyClaimDate}',
               to_jsonb($2::text)
             ),
             "updatedAt" = NOW()
         WHERE id = $3
           AND (
             settings->>'lastWeeklyClaimDate' IS NULL
             OR (settings->>'lastWeeklyClaimDate')::timestamptz < $4::timestamptz
           )
         RETURNING money`,
        WEEKLY_REWARD_AMOUNT,
        nowISO,
        userId,
        weekStartISO,
      );

      if (rows.length > 0) {
        await recordTransaction(
          {
            userId,
            type: 'credit',
            amount: WEEKLY_REWARD_AMOUNT,
            category: 'weekly_reward',
            description: 'Weekly reward claim',
            balanceAfter: rows[0].money,
            metadata: { weekStart: weekStartISO },
          },
          tx,
        );
      }

      return rows;
    });

    if (updatedRows.length === 0) {
      // Either user not found or already claimed
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found.',
        });
      }

      const nextSunday = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      return res.status(400).json({
        success: false,
        message: 'Weekly reward already claimed. Come back next week!',
        nextClaimDate: nextSunday.toISOString(),
      });
    }

    const nextSunday = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const newBalance = updatedRows[0].money;

    logger.info(
      `Weekly reward claimed: userId=${userId}, amount=${WEEKLY_REWARD_AMOUNT}, newBalance=${newBalance}`,
    );

    return res.status(200).json({
      success: true,
      message: `Claimed ${WEEKLY_REWARD_AMOUNT} coins!`,
      data: {
        amount: WEEKLY_REWARD_AMOUNT,
        newBalance,
        nextClaimDate: nextSunday.toISOString(),
      },
    });
  } catch (error) {
    logger.error('Weekly reward claim failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to claim weekly reward.',
    });
  }
}

/**
 * GET /api/v1/users/transactions
 *
 * Return the authenticated user's persisted transaction ledger.
 */
export async function getTransactionHistory(req, res) {
  try {
    const userId = req.user?.id || req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    const history = await getTransactionsForUser(userId, {
      page: req.query.page,
      pageSize: req.query.pageSize,
    });

    return res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    logger.error('Transaction history lookup failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load transaction history.',
    });
  }
}

/**
 * GET /api/v1/bank/claim-status
 *
 * Check if the user can claim their weekly reward.
 * Returns { canClaim, nextClaimDate }.
 */
export async function getClaimStatus(req, res) {
  try {
    const userId = req.user?.id || req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    const settings =
      typeof user.settings === 'object' && user.settings !== null ? user.settings : {};
    const lastClaim = settings.lastWeeklyClaimDate ? new Date(settings.lastWeeklyClaimDate) : null;
    const weekStart = getCurrentWeekStart();
    const canClaim = !lastClaim || lastClaim < weekStart;
    const nextSunday = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    return res.status(200).json({
      success: true,
      data: {
        canClaim,
        nextClaimDate: canClaim ? null : nextSunday.toISOString(),
        rewardAmount: WEEKLY_REWARD_AMOUNT,
      },
    });
  } catch (error) {
    logger.error('Claim status check failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check claim status.',
    });
  }
}
