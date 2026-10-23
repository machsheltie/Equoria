/**
 * ShowController (Epic BACKEND-A)
 *
 * Handles player-created shows with 7-day entry windows and overnight execution.
 *
 * BA-2: POST /api/v1/shows/create
 * BA-3: GET  /api/v1/shows        — browse open shows (paginated)
 * BA-3: POST /api/v1/shows/:id/enter — enter a horse in a show
 * BA-4: POST /api/v1/shows/execute — handled by executeClosedShows, which lives in
 *       ./showExecutionService.mjs since Equoria-q4uem.4 (WS4 S4, review M2)
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { MAX_HORSE_LEVEL } from '../../../utils/competitionLogic.mjs';
import { withRetryableTxMapping } from '../../../utils/retryableTransaction.mjs';
import { MS_PER_WEEK } from '../../../constants/time.mjs';
// Equoria-si69u: show money now routes through a named system-account escrow
// so creator account deletion can never sink entry fees mid-flight. See the
// si69u close note for the full design + the money-conservation sentinel.
import { SYSTEM_ACCOUNT_SHOW_ESCROW, creditSystemAccount } from '../../economy/index.mjs';
// Equoria-8pb6w: the two escrow-touching transactions live in a sibling module
// (extracted for deterministic testability + file-size discipline).
import { enterShowAtomicTx } from './showEscrowTx.mjs';
import {
  getShowForEntry,
  CONFORMATION_ENTRY_ONLY_MESSAGE,
} from '../services/competitionRouteQueries.mjs';
import { sendEntryRefusal } from '../services/entryEligibility.mjs';
// The 24 competition disciplines, from the one bible table (Equoria-576c0 B3 review).
import { isKnownDiscipline } from '../rules/disciplineRules.mjs';

// ── BA-2 / Equoria-nx8t1: Create a 7-day deferred-window show ──────────────────
//
// User spec (2026-05-18): the creating player chooses discipline + level, sets
// the entryFee and prize, and is debited the FULL prize at creation. The show
// auto-runs exactly 7 days after createdAt (the nightly cron picks up
// closeDate <= now AND status='open'). Entries are UNLIMITED (no cap). Entry
// fees flow to the creator's balance as horses are entered (see enterShow).
//
// Constraints enforced here:
//   - prize >= 10 * entryFee (e.g. entryFee 10 → prize >= 100)
//   - creator must be able to afford the full prize (else 400, no debit)

export async function createShow(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { name, discipline, level, entryFee = 0, prize = 0, description } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res
        .status(400)
        .json({ success: false, message: 'Show name must be at least 2 characters' });
    }
    if (!discipline || !isKnownDiscipline(discipline)) {
      return res.status(400).json({ success: false, message: 'Invalid discipline' });
    }
    if (
      typeof entryFee !== 'number' ||
      !Number.isInteger(entryFee) ||
      entryFee < 0 ||
      entryFee > 100_000
    ) {
      return res.status(400).json({ success: false, message: 'Entry fee must be 0–100,000' });
    }
    if (typeof prize !== 'number' || !Number.isInteger(prize) || prize < 0 || prize > 10_000_000) {
      return res.status(400).json({ success: false, message: 'Prize must be 0–10,000,000' });
    }
    // Equoria-nx8t1 R6: prize must be at least 10x the entry fee.
    if (prize < 10 * entryFee) {
      return res.status(400).json({
        success: false,
        message: `Prize must be at least 10x the entry fee (entry fee ${entryFee} requires a prize of at least ${10 * entryFee})`,
      });
    }

    // Equoria-nx8t1 R1: the creator chooses a competition level. We persist it
    // as a single-level bracket (levelMin == levelMax == chosen level). When no
    // level is supplied we keep the legacy open bracket so older clients still
    // work without a breaking change.
    let levelMin = 1;
    let levelMax = 999;
    if (level !== undefined && level !== null) {
      const lvl = Number(level);
      if (!Number.isInteger(lvl) || lvl < 1 || lvl > MAX_HORSE_LEVEL) {
        return res
          .status(400)
          .json({ success: false, message: 'Level must be an integer between 1 and 20' });
      }
      levelMin = lvl;
      levelMax = lvl;
    }

    const openDate = new Date();
    const closeDate = new Date(openDate.getTime() + MS_PER_WEEK);

    // Equoria-nx8t1 R5 + Equoria-si69u: charge the FULL prize to the creator
    // atomically with the show row, AND route it through SystemAccount[showEscrow]
    // so the prize money has a real counterparty for the lifetime of the show.
    // Pre-si69u the prize was just deducted from User.money with no credit
    // anywhere — the system implicitly minted the prize at payout time.
    // Post-si69u: creator → SystemAccount[showEscrow] at creation; on
    // execute we move escrow → winner. Money is conserved end-to-end and the
    // show.prizeEscrow column holds the per-show accounting view.
    let show;
    try {
      show = await withRetryableTxMapping(
        prisma.$transaction(async tx => {
          if (prize > 0) {
            const debited = await tx.user.updateMany({
              where: { id: userId, money: { gte: prize } },
              data: { money: { decrement: prize } },
            });
            if (debited.count === 0) {
              throw new Error('INSUFFICIENT_FUNDS');
            }
            // Credit the escrow account by the same amount in the same tx.
            await creditSystemAccount(tx, SYSTEM_ACCOUNT_SHOW_ESCROW, prize, {
              category: 'showCreatePrizeEscrow',
              description: `Prize escrow for show "${name.trim()}"`,
              linkedUserId: userId,
            });
          }
          return tx.show.create({
            data: {
              name: name.trim(),
              discipline,
              entryFee,
              // Equoria-nx8t1 R3: unlimited entries — no maxEntries cap.
              maxEntries: null,
              description: description ?? null,
              levelMin,
              levelMax,
              prize,
              runDate: closeDate,
              status: 'open',
              openDate,
              closeDate,
              createdByUserId: userId,
              // Equoria-si69u: per-show accounting view of the escrow.
              // SystemAccount[showEscrow].balance always reconciles against
              // SUM(prizeEscrow + feeEscrow) for open shows.
              prizeEscrow: prize,
              feeEscrow: 0,
            },
          });
        }),
        { message: 'Show service is busy right now, please retry in a moment.' },
      );
    } catch (txError) {
      if (txError.message === 'INSUFFICIENT_FUNDS') {
        return res
          .status(400)
          .json({ success: false, message: 'Insufficient funds to fund the prize pool' });
      }
      throw txError;
    }

    logger.info(
      `Show created: ${show.name} (id=${show.id}) by user ${userId} — prize ${prize} debited, executes ${closeDate.toISOString()}`,
    );
    return res.status(201).json({ success: true, data: { show } });
  } catch (error) {
    // Equoria-7x9po: surface the retryable 503 from withRetryableTxMapping.
    if (error?.status === 503) {
      return res.status(503).json({ success: false, code: 'SERVICE_BUSY', message: error.message });
    }
    if (error.code === 'P2002') {
      return res
        .status(409)
        .json({ success: false, message: 'A show with that name already exists' });
    }
    logger.error('showController.createShow error:', error);
    return res
      .status(500)
      .json({ success: false, code: 'INTERNAL_ERROR', message: 'Failed to create show' });
  }
}

// ── BA-3: Browse shows ─────────────────────────────────────────────────────────

export async function getShows(req, res) {
  try {
    const { status = 'open', discipline, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where = {};
    if (status) {
      where.status = status;
    }
    if (discipline) {
      where.discipline = discipline;
    }

    const [shows, total] = await Promise.all([
      prisma.show.findMany({
        where,
        orderBy: { closeDate: 'asc' },
        skip,
        take: limitNum,
        include: {
          _count: { select: { entries: true } },
        },
      }),
      prisma.show.count({ where }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        shows: shows.map(s => ({
          ...s,
          entryCount: s._count.entries,
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    logger.error('showController.getShows error:', error);
    return res
      .status(500)
      .json({ success: false, code: 'INTERNAL_ERROR', message: 'Failed to fetch shows' });
  }
}

// ── BA-3: Enter a show ─────────────────────────────────────────────────────────

export async function enterShow(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const showId = parseInt(req.params.id, 10);
    const { horseId } = req.body;

    if (!horseId || typeof horseId !== 'number') {
      return res
        .status(400)
        .json({ success: false, code: 'HORSE_ID_REQUIRED', message: 'horseId is required' });
    }

    // Same select as POST /competition/enter.
    const show = await getShowForEntry(showId);

    if (!show) {
      return res
        .status(404)
        .json({ success: false, code: 'SHOW_NOT_FOUND', message: 'Show not found' });
    }
    if (show.showType === 'conformation') {
      return res.status(400).json({
        success: false,
        code: 'CONFORMATION_ENTRY_ONLY',
        message: CONFORMATION_ENTRY_ONLY_MESSAGE,
      });
    }
    if (show.status !== 'open') {
      return res.status(409).json({
        success: false,
        code: 'SHOW_NOT_OPEN',
        message: 'This show is no longer accepting entries',
      });
    }
    if (show.closeDate && new Date(show.closeDate) <= new Date()) {
      return res
        .status(409)
        .json({ success: false, code: 'ENTRY_PERIOD_CLOSED', message: 'Entry period has closed' });
    }
    // Equoria-nx8t1 R3: entries are UNLIMITED — no maxEntries cap is enforced.

    // Verify horse ownership via WHERE-scoped findFirst — collapses
    // not-found and cross-user-owned into a single null result, returning
    // a byte-identical 404 in both cases (CWE-639 hardening, Equoria-bik1).
    const horse = await prisma.horse.findFirst({
      where: { id: horseId, userId },
      select: { id: true, name: true, userId: true },
    });

    if (!horse) {
      return res
        .status(404)
        .json({ success: false, code: 'HORSE_NOT_FOUND', message: 'Horse not found' });
    }
    // Equoria-576c0 B9: the horse's entry rules (age 3-20, rider, Gaited, double
    // entry, injured) run inside enterShowAtomicTx through the shared
    // checkEntryEligibility, the same check as POST /competition/enter.

    // Equoria-nx8t1 R7: atomically debit the entrant the entryFee, CREDIT the
    // show escrow, and create the entry — all in one transaction so a fee can
    // never be debited without (a) the escrow being credited and (b) the entry
    // row existing. The conditional updateMany (money >= entryFee) is the
    // atomic insufficient-funds guard and also closes a concurrent-spend race.
    // Extracted to enterShowAtomicTx (Equoria-8pb6w) so the tx-internal
    // entry-window guard can be exercised deterministically.
    let entry;
    try {
      entry = await enterShowAtomicTx({ show, showId, horseId, userId });
    } catch (txError) {
      // A refused entry rolled back in full (the rules run first in the tx).
      if (sendEntryRefusal(res, txError)) {
        return res;
      }
      if (txError.message === 'INSUFFICIENT_FUNDS') {
        return res.status(402).json({
          success: false,
          code: 'INSUFFICIENT_FUNDS',
          message: 'Insufficient funds for entry fee',
        });
      }
      // Equoria-8pb6w: the show was claimed by the executor between the pre-tx
      // guard and the tx-internal status recheck — reject the late entry.
      if (txError.message === 'ENTRY_CLOSED') {
        return res.status(409).json({
          success: false,
          code: 'SHOW_NOT_OPEN',
          message: 'This show is no longer accepting entries',
        });
      }
      throw txError;
    }

    logger.info(`Horse ${horseId} entered show ${showId} by user ${userId}`);
    return res.status(201).json({ success: true, data: { entry, horseName: horse.name } });
  } catch (error) {
    // Equoria-7x9po: surface the retryable 503 from withRetryableTxMapping.
    if (error?.status === 503) {
      return res.status(503).json({ success: false, code: 'SERVICE_BUSY', message: error.message });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        code: 'ALREADY_ENTERED',
        message: 'Horse is already entered in this show',
      });
    }
    logger.error('showController.enterShow error:', error);
    return res
      .status(500)
      .json({ success: false, code: 'INTERNAL_ERROR', message: 'Failed to enter show' });
  }
}
