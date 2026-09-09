/**
 * Groom Free Agents — the grooms-for-hire pool.
 *
 * Equoria-ypb7d.2, implementing the owner's ruling of 2026-09-09 (Equoria-m0w8n):
 * "they are free agents ... If they fail to pay for a groom for a week, the groom
 * goes back to the Grooms for hire section of the marketplace and can be hired by
 * other players."
 *
 * WHY THIS EXISTS AT ALL — the thing the ruling needed that did not exist.
 *   `groom-marketplace` was NOT a pool. `generateMarketplace()` invents twelve
 *   procedural offers, stores them as JSON in that one player's
 *   `staffMarketplaceState.offers`, and `hireFromMarketplace` CREATES a brand-new
 *   `Groom` row from the chosen offer. Nobody else could ever see or hire that
 *   groom, and a released groom had nowhere to go: there was no shared pool for
 *   them to return to. So "released to the marketplace" needed a real pool of real
 *   groom rows, and re-engaging one needed a hire path that does NOT create a
 *   groom. That is these two handlers. The procedural offer generator is untouched
 *   and still works exactly as before — a player sees both: invented offers and
 *   real grooms other players have let go.
 *
 * NOT A PLAYER-FACING SURFACE. Equoria-ypb7d.5 owns the surfaces (grace warning,
 * release notice, fee visibility) and the PRODUCT.md visual-change gate. These are
 * the API the pool needs in order to exist; no frontend calls them yet, and this
 * story deliberately does not decide how the pool should look.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { withRetryableTxMapping } from '../../../utils/retryableTransaction.mjs';
import {
  recordTransactionTx,
  debitMoneyOrThrow,
  InsufficientFundsError,
  SYSTEM_ACCOUNT_BURN,
} from '../../economy/index.mjs';
import { MAX_GROOMS_PER_USER } from '../../../config/groomConfig.mjs';
import { CapExceededError } from '../groomErrors.mjs';
import { parsePaginationParams } from '../../../utils/paginationHelper.mjs';
import {
  FREE_AGENT_WHERE,
  listFreeAgents,
  openEngagementTx,
} from '../services/groomEngagementService.mjs';

/**
 * Thrown when the guarded claim did not win: the groom was hired by someone else,
 * retired, or is no longer a free agent. A separate type so the 409 it maps to
 * cannot be confused with the cap or funds rejections.
 */
class FreeAgentUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FreeAgentUnavailableError';
  }
}

/**
 * GET /api/v1/groom-marketplace/free-agents
 * The grooms-for-hire pool: grooms a player has released, available to anyone.
 */
export async function listFreeAgentGrooms(req, res) {
  try {
    const { limit, skip } = parsePaginationParams(req, { defaultLimit: 20, maxLimit: 100 });
    const { grooms, total } = await listFreeAgents(prisma, { limit, skip });

    res.status(200).json({
      success: true,
      message: `Retrieved ${grooms.length} grooms available for hire`,
      data: {
        grooms: grooms.map(groom => ({ ...groom, sessionRate: Number(groom.sessionRate) })),
        total,
        pagination: { total, limit, offset: skip, hasMore: skip + limit < total },
      },
    });
  } catch (error) {
    logger.error(`[groomFreeAgentController] Error listing free agents: ${error.message}`);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve grooms available for hire',
      data: null,
    });
  }
}

/**
 * POST /api/v1/groom-marketplace/free-agents/hire
 * Engage an existing free-agent groom. Body: { groomId }.
 *
 * This does NOT create a groom — that is the whole point. The groom already
 * exists, with their accumulated experience, level, bond history and interaction
 * record intact, and this opens a NEW engagement on them.
 *
 * ONE PREDICATE, USED BY BOTH PATHS (Equoria-ypb7d.3 fix round 1, finding F1).
 *   `FREE_AGENT_WHERE` — imported from groomEngagementService, the same frozen object
 *   `listFreeAgents` filters the pool with — is spread into BOTH the 404 pre-read and
 *   the guarded claim below. It is deliberately not restated, because the first
 *   version restated it and the two copies drifted: the listing required a closed
 *   engagement while the hire required only `userId: null, retired: false,
 *   isActive: true`. Measured in the shared development database at the time,
 *   **65 grooms satisfied the hire predicate and 0 satisfied the pool predicate** —
 *   leftover fixtures and legacy rows no player ever hired, engageable by anyone who
 *   supplied an id. "Not in any listing" is not an authorization boundary. Two
 *   predicates that must agree will drift; one predicate cannot.
 *
 * ORDER OF WRITES, AND WHY:
 *   1. `debitMoneyOrThrow` — the User row first, per the campaign's lock-ordering
 *      rule (User rows, then Horse rows, then staff rows). It also serializes
 *      concurrent same-user hires, which is what makes step 3's re-count
 *      authoritative.
 *   2. The GUARDED CLAIM on the groom — `updateMany` whose `where` carries the whole
 *      pool predicate and whose affected-row count must be 1. This is the only thing
 *      standing between two players and the same groom, and it is sufficient: the
 *      loser's `where` no longer matches, it sees count 0, throws, and its debit
 *      rolls back with it. Mechanism (2) of the concurrency rule; no
 *      `SELECT ... FOR UPDATE`, because the precondition fits in the WHERE clause —
 *      including the relation clause, which Prisma 6.8.2 genuinely APPLIES in
 *      `updateMany` rather than ignoring. That is worth stating precisely, because fix
 *      round 1 asserted it from an observation that could not establish it (`count: 0`
 *      against a non-existent id, which is what you get whether or not the filter is
 *      applied — consistent with the conclusion, but not evidence for it). The
 *      discriminating probe needs rows differing ONLY in the relation clause: inside a
 *      rolled-back transaction, three free agents gave never-engaged 0, closed
 *      engagement 1, open-engagement-only 0, and the pre-fix narrow predicate 1 against
 *      the never-engaged groom — the hole itself, at the SQL level. The
 *      closed-engagement half is monotone anyway: engagement rows are never deleted, so
 *      it cannot become false under a race.
 *   3. The authoritative roster-cap re-count, mirroring `hireGroom` and
 *      `hireFromMarketplace` (Equoria-n4m5j / hduc5). The claim ran first, so the
 *      count INCLUDES this hire.
 *   4. The engagement row, and the ledger row.
 */
export async function hireFreeAgent(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const groomId = Number.parseInt(req.body?.groomId, 10);
    if (!Number.isInteger(groomId) || groomId < 1) {
      return res.status(400).json({
        success: false,
        message: 'groomId is required and must be a positive integer',
        data: null,
      });
    }

    // Read the offer to price it and to 404 early. TOCTOU on its own — the
    // authoritative check is the guarded claim inside the transaction — so it is
    // only a friendly pre-reject, exactly like the sibling hire paths' cap
    // fast-path. The PREDICATE, however, is the pool's own and not a restatement
    // of it (F1).
    const offer = await prisma.groom.findFirst({
      where: { id: groomId, ...FREE_AGENT_WHERE },
      select: { id: true, name: true, sessionRate: true },
    });
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'That groom is not available for hire',
        data: null,
      });
    }

    // Same price as the procedural marketplace hire: one week of session rate,
    // upfront (groomMarketplaceController.hireFromMarketplace). No new number is
    // invented here — what a free agent costs to engage is deliberately the same
    // question as what a marketplace groom costs.
    const hiringCost = Math.round(Number(offer.sessionRate) * 7);

    // Fast-path cap reject, mirroring both existing hire paths.
    const existingGroomCount = await prisma.groom.count({ where: { userId } });
    if (existingGroomCount >= MAX_GROOMS_PER_USER) {
      return res.status(400).json({
        success: false,
        // Fix round 1 (F12): the sibling hire paths say "Please release a groom
        // before hiring a new one", and there is no player-initiated release
        // anywhere — the only way a groom leaves your staff is the game's own
        // (retirement, or a full pay week unpaid). Pointing a player at an action
        // that does not exist is worse than saying nothing, so this message states
        // the limit and stops. The two older messages are left alone: rewording a
        // string a player already reads is a copy change belonging to whoever owns
        // that surface (Equoria-ypb7d.5).
        message: `You already have the maximum of ${MAX_GROOMS_PER_USER} grooms on your staff.`,
        data: { currentCount: existingGroomCount, maxAllowed: MAX_GROOMS_PER_USER },
      });
    }

    let result;
    try {
      result = await withRetryableTxMapping(
        prisma.$transaction(async tx => {
          const moneyAfter = await debitMoneyOrThrow(tx, {
            userId,
            amount: hiringCost,
            systemAccount: SYSTEM_ACCOUNT_BURN,
            category: 'groom_hire_burn',
            description: `Groom hire fee — ${offer.name}`,
            metadata: { groomId, freeAgent: true },
          });

          const claimed = await tx.groom.updateMany({
            // The SAME predicate the pool lists with, spread from the same frozen
            // object (F1). Do not restate it here.
            where: { id: groomId, ...FREE_AGENT_WHERE },
            data: {
              userId,
              // A fresh engagement starts paid up, whatever the last one ended as.
              feeUnpaidSince: null,
              // `hiredDate` means the start of the CURRENT engagement. The previous
              // engagement's start survives on its own closed GroomEngagement row,
              // so nothing is lost by moving it.
              hiredDate: new Date(),
            },
          });
          if (claimed.count !== 1) {
            throw new FreeAgentUnavailableError(
              'That groom was hired by someone else a moment ago.',
            );
          }

          const rosterCount = await tx.groom.count({ where: { userId } });
          if (rosterCount > MAX_GROOMS_PER_USER) {
            throw new CapExceededError(
              `You have reached the maximum limit of ${MAX_GROOMS_PER_USER} grooms. Please release a groom before hiring a new one.`,
            );
          }

          await openEngagementTx(tx, groomId, userId);

          await recordTransactionTx(tx, {
            userId,
            type: 'debit',
            amount: hiringCost,
            category: 'groom_hire',
            description: `Hired groom ${offer.name}`,
            metadata: { groomId, freeAgent: true },
          });

          const groom = await tx.groom.findUnique({
            where: { id: groomId },
            // Explicit projection: this response is player-facing, and an explicit
            // select is what keeps a future column out of it by default.
            select: {
              id: true,
              name: true,
              speciality: true,
              skillLevel: true,
              personality: true,
              experience: true,
              level: true,
              sessionRate: true,
              bio: true,
              imageUrl: true,
              hiredDate: true,
              userId: true,
            },
          });

          return { groom, hiringCost, moneyAfter };
        }),
        { message: 'The marketplace is busy right now, please retry in a moment.' },
      );
    } catch (txErr) {
      if (txErr instanceof FreeAgentUnavailableError) {
        // 409, not 404: the groom exists and the request was well-formed; someone
        // else simply got there first. A retry against a refreshed pool is the
        // correct client behaviour, and 409 is what says so.
        return res.status(409).json({ success: false, message: txErr.message, data: null });
      }
      if (txErr instanceof CapExceededError) {
        return res.status(400).json({
          success: false,
          message: txErr.message,
          data: { currentCount: MAX_GROOMS_PER_USER, maxAllowed: MAX_GROOMS_PER_USER },
        });
      }
      if (txErr instanceof InsufficientFundsError) {
        return res.status(400).json({
          success: false,
          message: `Insufficient funds. Hiring costs $${hiringCost} (one week upfront)`,
          data: { required: hiringCost },
        });
      }
      throw txErr;
    }

    logger.info(
      `[groomFreeAgentController] User ${userId} hired free agent ${groomId} for $${hiringCost}`,
    );

    return res.status(201).json({
      success: true,
      message: `Successfully hired ${result.groom.name}`,
      data: {
        groom: { ...result.groom, sessionRate: Number(result.groom.sessionRate) },
        cost: result.hiringCost,
        remainingMoney: result.moneyAfter,
      },
    });
  } catch (error) {
    if (error?.status === 503) {
      return res.status(503).json({ success: false, message: error.message, data: null });
    }
    logger.error(`[groomFreeAgentController] Error hiring free agent: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to hire groom',
      data: null,
    });
  }
}

export default { listFreeAgentGrooms, hireFreeAgent };
