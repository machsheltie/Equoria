/**
 * Bank Controller — Weekly Reward Claim
 *
 * Handles the weekly coin reward system. Users can claim 5,000 coins once per week
 * (2026-07-07 economy ruling; previously 500), resetting every Sunday at midnight Eastern (the game clock).
 * Missed weeks do not roll over, with one exception: a bank week an outage took
 * whole, which the owner's outage time-back owes back (owner ruling 2026-10-12,
 * Equoria-puj1e.5). Owed claims wait in User.settings.owedWeeklyClaims and are
 * paid by the next claim, on top of that week's own reward, each its own ledger row.
 *
 * Uses atomic SQL (jsonb_set) to prevent TOCTOU race conditions and JSONB clobber.
 * Stores last claim date in User.settings.lastWeeklyClaimDate (ISO string).
 */

import prisma, { Prisma } from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { InvalidCursorError } from '../../../utils/paginationHelper.mjs';
import { gameDayIndex, startOfGameDayIndex, startOfGameWeek } from '../../../utils/gameTime.mjs';
import { withRetryableTxMapping } from '../../../utils/retryableTransaction.mjs';
import { getTransactionsForUser, recordTransactionTx } from '../../economy/index.mjs';
import { owedWeeklyClaimsKey } from '../../staff/index.mjs';

/** Amount of coins awarded per weekly claim (2026-07-07 economy ruling) */
const weeklyRewardAmount = 5_000;

/**
 * Get the most recent Sunday at 00:00 Eastern (the game clock).
 * If today is Sunday, returns today at 00:00 Eastern.
 * Weekly rewards reset every Sunday.
 */
export function getCurrentWeekStart() {
  return startOfGameWeek(new Date(), 0);
}

/** How many owed claims a settings document holds (a time-back's lost weeks). */
function owedClaimCount(settings) {
  const owed = settings[owedWeeklyClaimsKey];
  return Array.isArray(owed) ? owed.length : 0;
}

/**
 * Pay every owed claim, one at a time, inside the claim transaction: each pops
 * the oldest from the list under the row's own write lock and adds one weekly
 * reward, and is recorded in the ledger against the week it gives back.
 * @returns {Promise<number[]>} the balance after each payment
 */
async function payOwedClaimsTx(tx, userId) {
  const balances = [];
  const key = Prisma.sql`${owedWeeklyClaimsKey}::text`;
  for (;;) {
    const rows = await tx.$queryRaw`
      WITH cur AS (
        SELECT "id", "settings" -> ${key} -> 0 AS claim FROM "User"
        WHERE "id" = ${userId}
          AND jsonb_typeof("settings" -> ${key}) = 'array'
          AND jsonb_array_length("settings" -> ${key}) > 0
        FOR UPDATE
      )
      UPDATE "User" u
      SET money = u.money + ${weeklyRewardAmount},
          settings = CASE WHEN jsonb_array_length(u.settings -> ${key}) <= 1
            THEN u.settings - ${key}
            ELSE jsonb_set(u.settings, ARRAY[${key}], (u.settings -> ${key}) - 0) END,
          "updatedAt" = NOW()
      FROM cur WHERE u."id" = cur."id"
      RETURNING u.money, cur.claim`;
    if (rows.length === 0) {
      return balances;
    }
    const claim = rows[0].claim !== null && typeof rows[0].claim === 'object' ? rows[0].claim : {};
    await recordTransactionTx(tx, {
      userId,
      type: 'credit',
      amount: weeklyRewardAmount,
      category: 'weeklyReward',
      description: 'Weekly reward for a week lost to an outage',
      metadata: { weekStart: claim.weekStart ?? null, owed: true },
    });
    balances.push(rows[0].money);
  }
}

/** 00:00 Eastern on the Sunday after `weekStart` (7 game days, DST-safe). */
function nextWeekStart(weekStart) {
  return startOfGameDayIndex(gameDayIndex(weekStart) + 7);
}

/**
 * POST /api/v1/bank/claim
 *
 * Claim the weekly 500-coin reward. Resets every Sunday at midnight Eastern.
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

    // Equoria-7x9po: a transient P2028 tx-timeout maps to a retryable 503
    // (not 500) via the shared wrapper; the catch below honours error.status.
    const { updatedRows, owedBalances } = await withRetryableTxMapping(
      prisma.$transaction(async tx => {
        // Atomic check-and-update: only succeeds if not already claimed this week.
        // Uses jsonb_set to avoid clobbering other settings fields.
        //
        // Equoria-jzu4l: parameterized $queryRaw tagged template replaces the
        // prior $queryRawUnsafe(sql, ...params) form. Each ${interpolation} is
        // bound by the driver (never string-spliced into the SQL text), so the
        // SQL-injection surface is closed at the driver layer. SQL casts/operators
        // (jsonb_set, ::text, ::timestamptz, NOW(), '{lastWeeklyClaimDate}') stay
        // as literal template text outside the bindings. Behaviour is identical to
        // the positional-param form ($1..$4 → the four bound values, same order).
        const rows = await tx.$queryRaw`
        UPDATE "User"
        SET money = money + ${weeklyRewardAmount},
            settings = jsonb_set(
              COALESCE(settings, '{}'::jsonb),
              '{lastWeeklyClaimDate}',
              to_jsonb(${nowISO}::text)
            ),
            "updatedAt" = NOW()
        WHERE id = ${userId}
          AND (
            settings->>'lastWeeklyClaimDate' IS NULL
            OR (settings->>'lastWeeklyClaimDate')::timestamptz < ${weekStartISO}::timestamptz
          )
        RETURNING money`;

        if (rows.length > 0) {
          // Equoria-hw3c8: migrated to recordTransactionTx(tx, opts). tx is
          // structurally required (first arg); the service reads the
          // authoritative balanceAfter inside the same tx, so the caller no
          // longer supplies it. The weeklyReward credit happens after the
          // atomic UPDATE bumped money by weeklyRewardAmount in the same
          // tx, so the service's balanceAfter read will observe the new
          // post-credit balance.
          await recordTransactionTx(tx, {
            userId,
            type: 'credit',
            amount: weeklyRewardAmount,
            category: 'weeklyReward',
            description: 'Weekly reward claim',
            metadata: { weekStart: weekStartISO },
          });
        }

        // Any weeks an outage took whole, paid on top of this week's reward.
        return { updatedRows: rows, owedBalances: await payOwedClaimsTx(tx, userId) };
      }),
      { message: 'Reward service is busy right now, please retry in a moment.' },
    );

    const claims = updatedRows.length + owedBalances.length;
    if (claims === 0) {
      // Either user not found or already claimed (and nothing owed)
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

      const nextSunday = nextWeekStart(weekStart);
      return res.status(400).json({
        success: false,
        message: 'Weekly reward already claimed. Come back next week!',
        nextClaimDate: nextSunday.toISOString(),
      });
    }

    const nextSunday = nextWeekStart(weekStart);
    const newBalance = owedBalances.length > 0 ? owedBalances.at(-1) : updatedRows[0].money;
    const amount = weeklyRewardAmount * claims;

    logger.info(
      `Weekly reward claimed: userId=${userId}, amount=${amount}, owedWeeks=${owedBalances.length}, newBalance=${newBalance}`,
    );

    return res.status(200).json({
      success: true,
      message: `Claimed ${amount} coins!`,
      data: {
        amount,
        newBalance,
        nextClaimDate: nextSunday.toISOString(),
      },
    });
  } catch (error) {
    // Equoria-7x9po: surface the retryable 503 from withRetryableTxMapping;
    // everything else stays a 500.
    if (error?.status === 503) {
      return res.status(503).json({ success: false, message: error.message });
    }
    logger.error('Weekly reward claim failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to claim weekly reward.',
    });
  }
}

/**
 * GET /api/v1/users/transactions (bankUserTransactionsRoutes.mjs)
 *
 * Return the authenticated user's persisted transaction ledger. The duplicate
 * GET /api/v1/bank/transactions mount was removed (Equoria-a7f1p, q151).
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
      cursor: req.query.cursor || null,
    });

    return res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    if (error instanceof InvalidCursorError) {
      return res.status(400).json({ success: false, message: error.message });
    }
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
    const weekOpen = !lastClaim || lastClaim < weekStart;
    const owedClaims = owedClaimCount(settings);
    const canClaim = weekOpen || owedClaims > 0;
    const nextSunday = nextWeekStart(weekStart);

    return res.status(200).json({
      success: true,
      data: {
        canClaim,
        nextClaimDate: canClaim ? null : nextSunday.toISOString(),
        rewardAmount: weeklyRewardAmount,
        // Weeks an outage took whole, paid with the next claim (Equoria-puj1e.5).
        owedClaims,
        claimAmount: weeklyRewardAmount * ((weekOpen ? 1 : 0) + owedClaims),
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
