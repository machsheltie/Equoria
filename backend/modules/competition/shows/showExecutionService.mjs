/**
 * Show execution service — the overnight show executor (Epic BACKEND-A, BA-4).
 *
 * Equoria-q4uem.4 (WS4 S4, review M2): executeClosedShows and its private helper
 * clearStagedOrdering moved here VERBATIM from ./showController.mjs. Nothing else
 * changed: same (req, res) signature, same body, same log prefix. The barrel
 * (../index.mjs) exports it from this file; the nightly jobs
 * (services/jobs/impl/retentionMaintenance.mjs, showExecutionReaper.mjs) call it with
 * no req/res or a synthetic `{ body: { showIds } }`; POST /api/v1/shows/execute
 * (./showRoutes.mjs) wires it as the admin-triggered handler. HTTP controllers are
 * not domain capabilities (spec), which is why the executor is a service.
 */

import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { updateUserSettingsPaths } from '../../../utils/userSettingsPaths.mjs';
// Equoria-si69u: show money now routes through a named system-account escrow
// so creator account deletion can never sink entry fees mid-flight. See the
// si69u close note for the full design + the money-conservation sentinel.
import { SYSTEM_ACCOUNT_SHOW_ESCROW, debitSystemAccountOrThrow } from '../../economy/index.mjs';
// Equoria-8pb6w: the two escrow-touching transactions live in a sibling module
// (extracted for deterministic testability + file-size discipline).
import { settleShowFeeEscrow } from './showEscrowTx.mjs';
import { settleDueConformationShows } from '../services/conformationShowService.mjs';
// Equoria-c7mx0: scoring extracted verbatim to the shared scoring service;
// readStagedOrdering implements the 2026-07-06 staged-ordering replay contract.
import { readStagedOrdering, scoreShowEntries } from '../services/competitionScoring.mjs';
import { awardRiderCompetitionXP } from '../../trainers/index.mjs';
// Equoria-oey96.4: horse XP / owner XP / stat gains — the executor's progression
// gap (it paid prize + rider XP but zero player/horse progression). Tx-aware helper
// so the awards run INSIDE the per-entry tx below without a nested transaction.
import { awardPlacementProgression } from '../services/competitionAwards.mjs';
import {
  buildRiddenResultRow,
  recordProgressionOnResult,
} from '../services/competitionResultRecord.mjs';
// Equoria-o26xc: sibling-fix of Equoria-pi4nk for the cron-driven executor.
// executeClosedShows previously never wrote competition_placement
// notifications — owners of winning horses got zero UI signal that their
// horses had placed. Mirrors the pi4nk pattern from enterAndRunShow:
// fire-and-forget OUTSIDE the prize-payout tx (fail-soft).
import { createNotification } from '../../../utils/notificationService.mjs';

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
 * Executes due shows (closeDate <= now, 'open'): sets status 'completed' and executedAt,
 * awards prizes and XP, sets the firstEverWin milestone. Conformation shows settle first
 * on their own scorer (titles, no prize), isolated from the ridden batch (Equoria-mwjst):
 * each batch is attempted even if the other fails, and any failure is rethrown to cron.
 *
 * Called by the nightly cron (no req/res) or POST /api/v1/shows/execute (admin).
 *
 * Equoria-rsss0 (test-isolation): an OPTIONAL `req.body.showIds` array narrows the scan
 * to those ids (still gated on status 'open' AND closeDate <= now), so a test settles
 * only its own shows. Production callers pass no req, so the scan stays global.
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

    // Conformation first, failure held: a ridden failure below cannot strand these shows.
    const conformation = await settleDueConformationShows({ now, showIds: scopedShowIds }).then(
      executed => ({ executed }),
      error => ({ error }),
    );

    const where = { status: 'open', closeDate: { lte: now }, showType: { not: 'conformation' } };
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

    let totalExecuted = conformation.executed ?? 0;

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
        const { horseId, userId, horseName, placement, riderId } = staged;
        const prizeShare = prizeSlots[placement - 1] ?? 0;
        const prize = Math.floor(totalPrize * prizeShare);

        await prisma.$transaction(async tx => {
          // Create competition result (row shape owned by competitionResultRecord)
          await tx.competitionResult.create({
            data: buildRiddenResultRow({ show, staged, prize, now }),
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
              // Finding 1 (Equoria-6p398.1): `milestones` path only.
              await updateUserSettingsPaths(tx, userId, {
                set: { milestones: { ...milestones, firstWin: now.toISOString() } },
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
          const progression = await awardPlacementProgression(tx, {
            horseId,
            ownerId: userId,
            placementNumber: placement,
            discipline: show.discipline,
            horseName,
          });
          // Equoria-q4uem.10 (owner ruling R6): the result records what it awarded.
          await recordProgressionOnResult(tx, { showId: show.id, horseId }, progression);
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

    if (conformation.error) {
      throw conformation.error; // the ridden batch ran; surface the held conformation failure
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
    throw error; // cron/reaper callers: unfinished shows must record as a failure
  }
}
