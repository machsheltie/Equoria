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

import prisma from '../../../db/index.mjs';
import logger from '../../../utils/logger.mjs';
import { applyRiderModifiers, computeRiderModifiers } from '../../../utils/riderBonus.mjs';
import { calculateRiderFlagCompatibility } from '../../../utils/riderFlagCompatibility.mjs';
import { awardRiderCompetitionXP } from '../../../services/riderTrainerProgressionService.mjs';

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
      !Number.isFinite(entryFee) ||
      entryFee < 0 ||
      entryFee > 100_000
    ) {
      return res.status(400).json({ success: false, message: 'Entry fee must be 0–100,000' });
    }
    if (typeof prize !== 'number' || !Number.isFinite(prize) || prize < 0 || prize > 10_000_000) {
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
    const closeDate = new Date(openDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Equoria-nx8t1 R5: charge the FULL prize to the creator atomically with
    // the show row. A conditional updateMany (money >= prize) is the atomic
    // guard against insufficient funds AND a concurrent-spend race: if the
    // balance dropped between read and write the update affects 0 rows and we
    // throw INSUFFICIENT_FUNDS, rolling back the transaction so no show row
    // and no debit persist.
    let show;
    try {
      show = await prisma.$transaction(async tx => {
        if (prize > 0) {
          const debited = await tx.user.updateMany({
            where: { id: userId, money: { gte: prize } },
            data: { money: { decrement: prize } },
          });
          if (debited.count === 0) {
            throw new Error('INSUFFICIENT_FUNDS');
          }
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
          },
        });
      });
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
      select: { id: true, name: true, userId: true, age: true, healthStatus: true },
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

    // Equoria-nx8t1 R7: atomically debit the entrant the entryFee, CREDIT the
    // show creator the same amount, and create the entry — all in one
    // transaction so a fee can never be debited without (a) the creator being
    // credited and (b) the entry row existing. The conditional updateMany
    // (money >= entryFee) is the atomic insufficient-funds guard and also
    // closes a concurrent-spend race.
    let entry;
    try {
      entry = await prisma.$transaction(async tx => {
        if (show.entryFee > 0) {
          const debited = await tx.user.updateMany({
            where: { id: userId, money: { gte: show.entryFee } },
            data: { money: { decrement: show.entryFee } },
          });
          if (debited.count === 0) {
            throw new Error('INSUFFICIENT_FUNDS');
          }
          // Credit the creator the entry fee. Self-entry (entrant ===
          // creator) is intentionally NOT credited — crediting your own
          // balance the same amount you were just debited is a pure no-op
          // round-trip, so we skip both the extra write and the self-pay
          // optics; the net effect is the creator pays the fee like anyone
          // else for their own horse. createdByUserId can be null for
          // legacy/system shows; with no creator there is nobody to credit
          // and the fee is sunk (matches legacy behaviour).
          if (show.createdByUserId && show.createdByUserId !== userId) {
            await tx.user.update({
              where: { id: show.createdByUserId },
              data: { money: { increment: show.entryFee } },
            });
          }
        }
        return tx.showEntry.create({
          data: { showId, horseId, userId, feePaid: show.entryFee },
        });
      });
    } catch (txError) {
      if (txError.message === 'INSUFFICIENT_FUNDS') {
        return res
          .status(402)
          .json({ success: false, message: 'Insufficient funds for entry fee' });
      }
      throw txError;
    }

    logger.info(`Horse ${horseId} entered show ${showId} by user ${userId}`);
    return res.status(201).json({ success: true, data: { entry, horseName: horse.name } });
  } catch (error) {
    if (error.code === 'P2002') {
      return res
        .status(409)
        .json({ success: false, message: 'Horse is already entered in this show' });
    }
    logger.error('showController.enterShow error:', error);
    return res.status(500).json({ success: false, message: 'Failed to enter show' });
  }
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
      // Equoria-dyj3y: ATOMICALLY claim the show before scoring. The previous
      // findMany(status:'open') → update(status:'executing') was a non-atomic
      // check-then-set: two concurrent invocations (two cron ticks, or cron +
      // manual /shows/execute) both read the same show as 'open' and both
      // proceeded to score it, producing duplicate competitionResult rows and a
      // DOUBLE prize payout. A conditional updateMany scoped to the still-open
      // status performs the read-and-claim in a single atomic DB statement: the
      // first caller flips 'open' → 'executing' (count === 1) and proceeds; any
      // concurrent loser sees count === 0 (the row is no longer 'open') and
      // skips the show entirely. This is the same atomic-guard pattern used for
      // the insufficient-funds race in createShow/enterShow above.
      const claimed = await prisma.show.updateMany({
        where: { id: show.id, status: 'open' },
        data: { status: 'executing' },
      });
      if (claimed.count !== 1) {
        // Another concurrent executor already claimed this show; do not score it
        // again. Skipping here is what prevents the duplicate-result/double-pay.
        logger.info(
          `Skipping show ${show.id} (${show.name}) — already claimed by a concurrent executor`,
        );
        continue;
      }

      const entries = show.entries;
      if (entries.length === 0) {
        await prisma.show.update({
          where: { id: show.id },
          data: { status: 'completed', executedAt: now },
        });
        continue;
      }

      // Resolve active RiderAssignment per entry BEFORE scoring (Equoria-5bkh).
      // Prior code computed score with NO rider modifier and queried
      // RiderAssignment only post-hoc for stat tracking — hired riders had
      // ZERO impact on scoring. We now load each entry's active assignment
      // once and reuse it for both modifier application AND stat tracking
      // below, avoiding a duplicate DB query.
      const horseIds = entries.map(e => e.horseId);
      const riderAssignments = horseIds.length
        ? await prisma.riderAssignment.findMany({
            where: { horseId: { in: horseIds }, isActive: true },
            include: { rider: true },
          })
        : [];
      const assignmentByHorseId = new Map(riderAssignments.map(ra => [ra.horseId, ra]));

      // Score each entry
      const scored = entries.map(entry => {
        const h = entry.horse;
        const base =
          ((h.speed ?? 50) +
            (h.stamina ?? 50) +
            (h.agility ?? 50) +
            (h.precision ?? 50) +
            (h.boldness ?? 50)) /
          5;
        const luck = (Math.random() - 0.5) * 18; // ±9%
        const subtotal = Math.max(0, base + luck);

        // Apply rider modifiers if an active rider is assigned to this horse.
        // computeRiderModifiers returns 0/0 for missing/null/malformed input —
        // safe to call unconditionally.
        const assignment = assignmentByHorseId.get(entry.horseId);
        let { bonusPercent, penaltyPercent } = computeRiderModifiers({
          rider: assignment?.rider ?? null,
          discipline: show.discipline,
        });

        // Equoria-grys6: behavioral-flag rider compatibility (adjacent to
        // simulateCompetition.mjs yzqhj.6). ONLY when a rider is present, the
        // horse's behavioral epigenetic flags modulate HOW WELL that rider
        // performs with THIS horse: positive-valence flags raise the rider's
        // effective bonus / lower its penalty; negative flags do the reverse.
        // DISTINCT from the .1 base-score flag modifier — here we touch ONLY
        // the rider percents. Conservative (±2%/flag, ±10% cap) and clamped to
        // applyRiderModifiers' validated ranges so it can never throw or invert
        // the rider effect. Mirrors simulateCompetition.mjs exactly.
        if (assignment?.rider) {
          const compatFactor = calculateRiderFlagCompatibility(h.epigeneticFlags);
          if (compatFactor !== 1.0) {
            const RIDER_BONUS_CAP = 0.1; // mirrors riderBonus.mjs BONUS_CAP
            const RIDER_PENALTY_CAP = 0.08; // mirrors riderBonus.mjs PENALTY_CAP
            bonusPercent = Math.max(0, Math.min(RIDER_BONUS_CAP, bonusPercent * compatFactor));
            penaltyPercent = Math.max(
              0,
              Math.min(RIDER_PENALTY_CAP, penaltyPercent * (2 - compatFactor)),
            );
            logger.info(
              `[showController] Horse ${h.name}: Rider flag-compatibility factor ${compatFactor.toFixed(3)} applied (bonus -> ${(bonusPercent * 100).toFixed(2)}%, penalty -> ${(penaltyPercent * 100).toFixed(2)}%)`,
            );
          }
        }
        const scoreWithRider = applyRiderModifiers(subtotal, bonusPercent, penaltyPercent);

        return { entry, score: Math.max(0, Math.round(scoreWithRider)), assignment };
      });

      // Sort descending by score
      scored.sort((a, b) => b.score - a.score);

      const totalPrize = Math.max(0, show.prize);
      const prizeSlots = [0.5, 0.3, 0.2]; // 1st/2nd/3rd shares

      const resultOps = scored.map(async ({ entry, score, assignment }, i) => {
        const placement = i + 1;
        const prizeShare = prizeSlots[i] ?? 0;
        const prize = Math.floor(totalPrize * prizeShare);

        // Create competition result
        await prisma.competitionResult.create({
          data: {
            score,
            placement: `${placement}`,
            discipline: show.discipline,
            runDate: now,
            showName: show.name,
            prizeWon: prize,
            horseId: entry.horseId,
            showId: show.id,
          },
        });

        // Award prize money
        if (prize > 0) {
          await prisma.user.update({
            where: { id: entry.userId },
            data: { money: { increment: prize } },
          });
        }

        // Set firstEverWin milestone if 1st place
        if (placement === 1) {
          const user = await prisma.user.findUnique({
            where: { id: entry.userId },
            select: { settings: true },
          });
          const settings = user?.settings ?? {};
          const milestones = settings.milestones ?? {};
          if (!milestones.firstWin) {
            await prisma.user.update({
              where: { id: entry.userId },
              data: {
                settings: {
                  ...settings,
                  milestones: { ...milestones, firstWin: now.toISOString() },
                },
              },
            });
          }
        }

        // Increment rider competition stats using the assignment we already
        // loaded for scoring (Equoria-5bkh). This replaces the previous
        // duplicate findFirst() lookup.
        if (assignment) {
          await prisma.rider.update({
            where: { id: assignment.riderId },
            data: {
              totalCompetitions: { increment: 1 },
              ...(placement === 1 ? { totalWins: { increment: 1 } } : {}),
            },
          });

          // Equoria-r1nr: award XP + prestige to the rider for this competition.
          // Fail-soft — XP failure must not block show execution.
          try {
            await awardRiderCompetitionXP(assignment.riderId, placement);
          } catch (xpErr) {
            logger.error(
              `[showController] Failed to award rider XP for rider ${assignment.riderId}: ${xpErr.message}`,
            );
          }
        }
      });

      await Promise.all(resultOps);

      await prisma.show.update({
        where: { id: show.id },
        data: { status: 'completed', executedAt: now },
      });

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
