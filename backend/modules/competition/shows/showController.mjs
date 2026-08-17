/**
 * ShowController (Epic BACKEND-A)
 *
 * Handles player-created shows with 7-day entry windows and overnight execution.
 *
 * BA-2: POST /api/v1/shows/create
 * BA-3: GET  /api/v1/shows        — browse open shows (paginated)
 * BA-3: POST /api/v1/shows/:id/enter — enter a horse in a show
 * BA-4: POST /api/v1/shows/execute — cron-triggered overnight execution
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { withRetryableTxMapping } from '../../../utils/retryableTransaction.mjs';
import { MS_PER_WEEK } from '../../../constants/time.mjs';
// Equoria-si69u: show money now routes through a named system-account escrow
// so creator account deletion can never sink entry fees mid-flight. See the
// si69u close note for the full design + the money-conservation sentinel.
import {
  SYSTEM_ACCOUNT_SHOW_ESCROW,
  creditSystemAccount,
  debitSystemAccountOrThrow,
} from '../../economy/index.mjs';
// Equoria-8pb6w: the two escrow-touching transactions live in a sibling module
// (extracted for deterministic testability + file-size discipline).
import { enterShowAtomicTx, settleShowFeeEscrow } from './showEscrowTx.mjs';
import { getHorseXpLevel } from '../../../utils/horseCompetitionLevel.mjs';
// Equoria-c7mx0: scoring extracted verbatim to the shared scoring service;
// readStagedOrdering implements the 2026-07-06 staged-ordering replay contract.
import { readStagedOrdering, scoreShowEntries } from '../services/competitionScoring.mjs';
import { awardRiderCompetitionXP } from '../../trainers/index.mjs';
// Equoria-oey96.4: horse XP / owner XP / stat gains — the executor's progression
// gap (it paid prize + rider XP but zero player/horse progression). Tx-aware helper
// so the awards run INSIDE the per-entry tx below without a nested transaction.
import { awardPlacementProgression } from '../services/competitionAwards.mjs';
// Equoria-o26xc: sibling-fix of Equoria-pi4nk for the cron-driven executor.
// executeClosedShows previously never wrote competition_placement
// notifications — owners of winning horses got zero UI signal that their
// horses had placed. Mirrors the pi4nk pattern from enterAndRunShow:
// fire-and-forget OUTSIDE the prize-payout tx (fail-soft).
import { createNotification } from '../../../utils/notificationService.mjs';

const VALID_DISCIPLINES = [
  'Western Pleasure',
  'Reining',
  'Cutting',
  'Barrel Racing',
  'Roping',
  'Team Penning',
  'Rodeo',
  'Hunter',
  'Saddleseat',
  'Endurance',
  'Eventing',
  'Dressage',
  'Show Jumping',
  'Vaulting',
  'Polo',
  'Cross Country',
  'Combined Driving',
  'Fine Harness',
  'Gaited',
  'Gymkhana',
  'Steeplechase',
  'Racing',
  'Harness Racing',
];

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
    if (!discipline || !VALID_DISCIPLINES.includes(discipline)) {
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
      if (!Number.isInteger(lvl) || lvl < 1 || lvl > 999) {
        return res
          .status(400)
          .json({ success: false, message: 'Level must be an integer between 1 and 999' });
      }
      levelMin = lvl;
      levelMax = lvl;
    }

    const openDate = new Date();
    const closeDate = new Date(openDate.getTime() + MS_PER_WEEK);

    // Equoria-nx8t1 R5 + Equoria-si69u: charge the FULL prize to the creator
    // atomically with the show row, AND route it through SystemAccount[show_escrow]
    // so the prize money has a real counterparty for the lifetime of the show.
    // Pre-si69u the prize was just deducted from User.money with no credit
    // anywhere — the system implicitly minted the prize at payout time.
    // Post-si69u: creator → SystemAccount[show_escrow] at creation; on
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
              category: 'show_create_prize_escrow',
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
              // SystemAccount[show_escrow].balance always reconciles against
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
      return res.status(503).json({ success: false, message: error.message });
    }
    if (error.code === 'P2002') {
      return res
        .status(409)
        .json({ success: false, message: 'A show with that name already exists' });
    }
    logger.error('showController.createShow error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create show' });
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
    return res.status(500).json({ success: false, message: 'Failed to fetch shows' });
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
      return res.status(400).json({ success: false, message: 'horseId is required' });
    }

    // Load show
    const show = await prisma.show.findUnique({
      where: { id: showId },
      select: {
        id: true,
        status: true,
        closeDate: true,
        entryFee: true,
        createdByUserId: true,
        // Equoria-g8qg0: the advertised level bracket, enforced at entry below.
        levelMin: true,
        levelMax: true,
      },
    });

    if (!show) {
      return res.status(404).json({ success: false, message: 'Show not found' });
    }
    if (show.status !== 'open') {
      return res
        .status(409)
        .json({ success: false, message: 'This show is no longer accepting entries' });
    }
    if (show.closeDate && new Date(show.closeDate) <= new Date()) {
      return res.status(409).json({ success: false, message: 'Entry period has closed' });
    }
    // Equoria-nx8t1 R3: entries are UNLIMITED — no maxEntries cap is enforced.

    // Verify horse ownership via WHERE-scoped findFirst — collapses
    // not-found and cross-user-owned into a single null result, returning
    // a byte-identical 404 in both cases (CWE-639 hardening, Equoria-bik1).
    const horse = await prisma.horse.findFirst({
      where: { id: horseId, userId },
      // Equoria-g8qg0: horseXp feeds the level-bracket check (floor(xp/100)+1).
      select: { id: true, name: true, userId: true, age: true, healthStatus: true, horseXp: true },
    });

    if (!horse) {
      return res.status(404).json({ success: false, message: 'Horse not found' });
    }
    if (horse.age < 3) {
      return res
        .status(400)
        .json({ success: false, message: 'Horse must be at least 3 years old to compete' });
    }
    if (String(horse.healthStatus).toLowerCase() === 'injured') {
      return res.status(400).json({ success: false, message: 'Injured horses cannot compete' });
    }

    // Equoria-g8qg0: compute the entrant's XP-bracket level (pinned mapping
    // floor(horseXp/100)+1). The bracket comparison itself happens INSIDE the
    // entry tx (enterShowAtomicTx) alongside the 8pb6w status predicate, so an
    // out-of-bracket entry rolls back with the wallet untouched and no entry.
    const horseLevel = getHorseXpLevel(horse.horseXp);

    // Equoria-nx8t1 R7: atomically debit the entrant the entryFee, CREDIT the
    // show escrow, and create the entry — all in one transaction so a fee can
    // never be debited without (a) the escrow being credited and (b) the entry
    // row existing. The conditional updateMany (money >= entryFee) is the
    // atomic insufficient-funds guard and also closes a concurrent-spend race.
    // Extracted to enterShowAtomicTx (Equoria-8pb6w) so the tx-internal
    // entry-window guard can be exercised deterministically.
    let entry;
    try {
      entry = await enterShowAtomicTx({ show, showId, horseId, userId, horseLevel });
    } catch (txError) {
      // Equoria-g8qg0: horse's level is outside the show's advertised bracket.
      // Nothing was debited and no entry was created (the guard runs first in
      // the tx, so this is a full rollback). Surface a clear 400 naming the
      // bracket and the horse's level.
      if (txError.message === 'OUT_OF_BRACKET') {
        return res.status(400).json({
          success: false,
          message: `This show is restricted to horses at level ${show.levelMin}${
            show.levelMax !== show.levelMin ? `–${show.levelMax}` : ''
          }. This horse is level ${horseLevel}.`,
        });
      }
      if (txError.message === 'INSUFFICIENT_FUNDS') {
        return res
          .status(402)
          .json({ success: false, message: 'Insufficient funds for entry fee' });
      }
      // Equoria-8pb6w: the show was claimed by the executor between the pre-tx
      // guard and the tx-internal status recheck — reject the late entry.
      if (txError.message === 'ENTRY_CLOSED') {
        return res
          .status(409)
          .json({ success: false, message: 'This show is no longer accepting entries' });
      }
      throw txError;
    }

    logger.info(`Horse ${horseId} entered show ${showId} by user ${userId}`);
    return res.status(201).json({ success: true, data: { entry, horseName: horse.name } });
  } catch (error) {
    // Equoria-7x9po: surface the retryable 503 from withRetryableTxMapping.
    if (error?.status === 503) {
      return res.status(503).json({ success: false, message: error.message });
    }
    if (error.code === 'P2002') {
      return res
        .status(409)
        .json({ success: false, message: 'Horse is already entered in this show' });
    }
    logger.error('showController.enterShow error:', error);
    return res.status(500).json({ success: false, message: 'Failed to enter show' });
  }
}

/**
 * Set shows.stagedOrdering to SQL NULL (Equoria-c7mx0). Raw parameterized SQL
 * rather than `data: { stagedOrdering: Prisma.DbNull }` because the DbNull
 * sentinel is identity-checked by the client and fails open under Jest's
 * experimental-vm-modules dual-registry interop (empirically serialized as
 * `{}` there, while plain node behaves) — raw SQL is unambiguous in both
 * runtimes. Id-scoped by construction.
 */
async function clearStagedOrdering(showId) {
  await prisma.$executeRaw`UPDATE "shows" SET "stagedOrdering" = NULL WHERE "id" = ${showId}`;
}

// ── BA-4: Overnight show execution ────────────────────────────────────────────

/**
 * Executes all shows where closeDate <= now && status === 'open'.
 * Sets status = 'completed', executedAt = now.
 * Awards prizes and XP for each entry.
 * Sets firstEverWin milestone flag if applicable.
 *
 * Called by the scheduled task or POST /api/v1/shows/execute (admin).
 *
 * Equoria-rsss0 (test-isolation): the HTTP path accepts an OPTIONAL
 * `req.body.showIds` array. When supplied, the closeable-show scan is
 * narrowed to those specific ids (still gated on `status:'open'` AND
 * `closeDate <= now`, so a non-due or non-open id in the list is a no-op).
 * This lets a test scope its execute call to ONLY the shows it created, so
 * parallel competition suites no longer claim/score each other's open shows.
 * When `showIds` is omitted (every production caller — the cron and the
 * scheduler pass `null`/`undefined` req, so `req?.body?.showIds` is
 * `undefined`) the scan is the original unfiltered global scan — production
 * behaviour is byte-for-byte unchanged.
 */
export async function executeClosedShows(req, res) {
  try {
    const now = new Date();

    // Optional, test-only scoping filter (see fn doc). A valid array of
    // numeric ids narrows the scan; anything else (undefined, null, empty,
    // non-array, no numeric members) leaves the scan global — identical to
    // the pre-existing production behaviour.
    const rawShowIds = req?.body?.showIds;
    const scopedShowIds = Array.isArray(rawShowIds)
      ? rawShowIds.filter(id => Number.isInteger(id))
      : null;

    const where = { status: 'open', closeDate: { lte: now } };
    if (scopedShowIds && scopedShowIds.length > 0) {
      where.id = { in: scopedShowIds };
    }

    // Find all shows ready to execute
    const shows = await prisma.show.findMany({
      where,
      include: {
        entries: {
          include: {
            horse: {
              select: {
                id: true,
                name: true,
                userId: true,
                speed: true,
                stamina: true,
                agility: true,
                balance: true,
                precision: true,
                boldness: true,
                // Equoria-grys6: needed for rider flag-compatibility bias below.
                epigeneticFlags: true,
              },
            },
          },
        },
      },
    });

    let totalExecuted = 0;

    for (const show of shows) {
      const entries = show.entries;

      // Equoria-c7mx0 (2026-07-06 approved decision): determine the ordering
      // to execute BEFORE claiming. A crashed prior claim leaves its scored
      // ordering persisted on the row (the reaper's release preserves it) and
      // it is replayed VERBATIM below — recovery pays exactly the placements
      // scored at the original claim, never a re-roll. NULL/invalid staging
      // (fresh show, or a stranding predating the staging migration) scores
      // fresh; readStagedOrdering carries the JSONB shape guards.
      let stagedOrdering = readStagedOrdering(show, entries);
      if (stagedOrdering === null) {
        // Resolve active RiderAssignment per entry BEFORE scoring
        // (Equoria-5bkh): the assignment drives both the score's rider
        // modifier and — via the staged riderId — post-payout stat tracking,
        // with a single query.
        const horseIds = entries.map(e => e.horseId);
        const riderAssignments = horseIds.length
          ? await prisma.riderAssignment.findMany({
              where: { horseId: { in: horseIds }, isActive: true },
              include: { rider: true },
            })
          : [];
        const assignmentByHorseId = new Map(riderAssignments.map(ra => [ra.horseId, ra]));

        // Score (extracted verbatim to competitionScoring.mjs) + rank.
        const scored = scoreShowEntries({ show, entries, assignmentByHorseId });
        scored.sort((a, b) => b.score - a.score);
        stagedOrdering = scored.map(({ entry, score, assignment }, i) => ({
          horseId: entry.horseId,
          userId: entry.userId,
          horseName: entry.horse?.name ?? null,
          score,
          placement: i + 1,
          riderId: assignment?.riderId ?? null,
        }));
      }

      // Equoria-dyj3y: ATOMICALLY claim the show. A conditional updateMany
      // scoped to the still-open status performs read-and-claim in a single
      // atomic DB statement: the first caller flips 'open' → 'executing'
      // (count === 1) and proceeds; a concurrent loser sees count === 0 and
      // skips (its wasted scoring pass is discarded with its claim) — this is
      // what prevents duplicate results / double pay. Equoria-c7mx0: the SAME
      // statement persists claimedAt + the scored ordering, so a persisted
      // 'executing' always carries the ordering its recovery must replay.
      const claimed = await prisma.show.updateMany({
        where: { id: show.id, status: 'open' },
        data: { status: 'executing', claimedAt: now, stagedOrdering },
      });
      if (claimed.count !== 1) {
        logger.info(
          `Skipping show ${show.id} (${show.name}) — already claimed by a concurrent executor`,
        );
        continue;
      }

      if (entries.length === 0) {
        await prisma.show.update({
          where: { id: show.id },
          data: { status: 'completed', executedAt: now, claimedAt: null },
        });
        await clearStagedOrdering(show.id);
        continue;
      }

      const totalPrize = Math.max(0, show.prize);
      const prizeSlots = [0.5, 0.3, 0.2]; // 1st/2nd/3rd shares

      // Equoria-koodu: CLAIM-THEN-PROCESS pattern. Mark the show 'completed'
      // BEFORE processing entries. If any entry's writes fail, the cron tick
      // (which filters on status) will NOT pick this show up again, so the
      // worst case is a partial-but-bounded set of result/money writes — never
      // a double-pay. The @@unique([showId, horseId]) constraint on
      // CompetitionResult backstops any case where this ordering is bypassed
      // by raising P2002 on duplicate writes. (stagedOrdering deliberately
      // NOT cleared here — it outlives the payout phase so a mid-payout crash
      // leaves the ordering available for deterministic re-drive; cleared
      // after full settlement below.)
      await prisma.show.update({
        where: { id: show.id },
        data: { status: 'completed', executedAt: now, claimedAt: null },
      });

      // Per-entry processing — a pure REPLAY of the staged ordering persisted
      // at claim time (Equoria-c7mx0): identity, score, and placement come
      // from the staging, and the prize is derived from the staged placement
      // through the untouched 50/30/20 slots. Each winner's
      // competitionResult.create + user.update + (if 1st) firstWin milestone +
      // rider.update are wrapped in a single $transaction (Equoria-koodu AC).
      // If user.update fails (deadlock, connection drop, server crash), the
      // result.create is rolled back so we never have "result recorded but
      // money not paid." awardRiderCompetitionXP stays OUTSIDE the tx because
      // it is fail-soft (existing contract — XP failure must not block show
      // execution).
      const resultOps = stagedOrdering.map(async staged => {
        const { horseId, userId, horseName, score, placement, riderId } = staged;
        const prizeShare = prizeSlots[placement - 1] ?? 0;
        const prize = Math.floor(totalPrize * prizeShare);

        await prisma.$transaction(async tx => {
          // Create competition result
          await tx.competitionResult.create({
            data: {
              score,
              placement: `${placement}`,
              discipline: show.discipline,
              runDate: now,
              showName: show.name,
              prizeWon: prize,
              horseId,
              showId: show.id,
            },
          });

          // Equoria-si69u: pay the winner from SystemAccount[show_escrow]
          // (which was credited at createShow), decrement Show.prizeEscrow
          // by the same amount, and credit the winner's User.money. All in
          // the same tx so a failure in any leg rolls back the whole prize
          // payout and the competitionResult.create above.
          //
          // Backwards compat for the cohort of shows created BEFORE the
          // si69u migration (or for test fixtures that build a Show row
          // directly via prisma.show.create rather than through createShow):
          // those rows have prizeEscrow = 0 even though the prize was
          // notionally funded under the legacy "system implicitly mints
          // at payout" model. Detect that case via `show.prizeEscrow >=
          // prize` and skip the escrow debit. The winner is still paid
          // under the legacy path so in-flight shows can drain. New shows
          // always go through the escrow path.
          if (prize > 0) {
            if (show.prizeEscrow >= prize) {
              await debitSystemAccountOrThrow(tx, SYSTEM_ACCOUNT_SHOW_ESCROW, prize, {
                category: 'show_payout_prize',
                description: `Prize payout for show ${show.id}, placement ${placement}`,
                linkedUserId: userId,
                metadata: { showId: show.id, placement },
              });
              await tx.show.update({
                where: { id: show.id },
                data: { prizeEscrow: { decrement: prize } },
              });
            }
            await tx.user.update({
              where: { id: userId },
              data: { money: { increment: prize } },
            });
          }

          // Set firstEverWin milestone if 1st place
          if (placement === 1) {
            const user = await tx.user.findUnique({
              where: { id: userId },
              select: { settings: true },
            });
            const settings = user?.settings ?? {};
            const milestones = settings.milestones ?? {};
            if (!milestones.firstWin) {
              await tx.user.update({
                where: { id: userId },
                data: {
                  settings: {
                    ...settings,
                    milestones: { ...milestones, firstWin: now.toISOString() },
                  },
                },
              });
            }
          }

          // Increment rider competition stats using the staged riderId (the
          // active assignment resolved at claim time — Equoria-5bkh).
          if (riderId) {
            await tx.rider.update({
              where: { id: riderId },
              data: {
                totalCompetitions: { increment: 1 },
                ...(placement === 1 ? { totalWins: { increment: 1 } } : {}),
              },
            });
          }

          // Equoria-oey96.4: award horse XP (ALL entrants) + owner XP & a
          // chance-gated stat gain (top-3) via tx-aware cores, INSIDE this tx — a
          // crash mid-award rolls back result+prize+XP together (AC5).
          // competitionResult.create stays the FIRST write so [showId,horseId]
          // uniqueness is the idempotency token; placement-at-END keeps lock order.
          await awardPlacementProgression(tx, {
            horseId,
            ownerId: userId,
            placementNumber: placement,
            discipline: show.discipline,
            horseName,
          });
        });

        // Equoria-r1nr: award XP + prestige OUTSIDE the transaction
        // (fail-soft — XP failure must not block show execution or roll back
        // the prize payment).
        if (riderId) {
          try {
            await awardRiderCompetitionXP(riderId, placement);
          } catch (xpErr) {
            logger.error(
              `[showController] Failed to award rider XP for rider ${riderId}: ${xpErr.message}`,
            );
          }
        }

        // Equoria-o26xc / sibling-fix of Equoria-pi4nk: fire a
        // competition_placement notification on every top-3 finish for the
        // cron-driven executor (the canonical post-toqet path). OUTSIDE the
        // tx and wrapped in try/catch — a notification-subsystem failure
        // must NEVER roll back the prize payout or block show execution.
        // Ordinal labels match the enterAndRunShow convention (`1st`/`2nd`/
        // `3rd`) so the frontend renders the same payload shape regardless
        // of which executor path produced the row.
        if (placement <= 3) {
          try {
            const placementLabel = placement === 1 ? '1st' : placement === 2 ? '2nd' : '3rd';
            await createNotification(userId, 'competition_placement', {
              horseName,
              placement: placementLabel,
              discipline: show.discipline,
              showName: show.name,
              prizeWon: prize,
            });
          } catch (notifErr) {
            logger.error(
              `[showController] Failed to create competition_placement notification for user ${userId} (horse ${horseId}): ${notifErr.message}`,
            );
          }
        }
      });

      await Promise.all(resultOps);

      // Equoria-si69u: settle the fee escrow AFTER all winners have been paid
      // from the prize escrow. Extracted to settleShowFeeEscrow (Equoria-8pb6w)
      // so the read-then-write decrement semantics can be exercised
      // deterministically against a concurrent feeEscrow increment.
      await settleShowFeeEscrow(show.id);

      // Equoria-c7mx0: the show has fully settled — only now is the staged
      // ordering discarded. (Kept through the payout phase so a mid-payout
      // crash leaves it available for deterministic re-drive.)
      await clearStagedOrdering(show.id);

      totalExecuted++;
      logger.info(`Executed show: ${show.name} (id=${show.id}), ${entries.length} entries`);
    }

    const message = `Executed ${totalExecuted} show(s)`;
    logger.info(message);

    if (res) {
      return res.status(200).json({ success: true, data: { executed: totalExecuted, message } });
    }
  } catch (error) {
    logger.error('showController.executeClosedShows error:', error);
    if (res) {
      return res.status(500).json({ success: false, message: 'Execution failed' });
    }
  }
}
