/**
 * gdprAccountService.mjs
 *
 * GDPR Right-to-Access (data export) + Right-to-Erasure (account deletion)
 * for Equoria (Equoria-s3rf).
 *
 * SAFETY DOCTRINE (CLAUDE.md §2): every query/mutation in this module is
 * scoped STRICTLY to the single authenticated `userId` passed in. There is
 * no broad `deleteMany()` without a `where` clause, and no name/prefix
 * heuristic — only the exact owning user's id and the ids of rows that
 * belong to that user. This module runs against the canonical Equoria DB.
 *
 * Retention policy (see docs/legal/privacy-policy.md):
 *   - All rows keyed directly to the user's id (profile, horses,
 *     transactions, notifications, grooms, riders, trainers, messages,
 *     forum content, club membership, settings, tokens) are HARD-DELETED.
 *   - Horse-derived competition history cascade-deletes with the horse
 *     (schema `onDelete: Cascade`), so a user's competition results are
 *     erased along with their horses — nothing identifying the user is
 *     retained.
 *   - HorseSale rows are bilateral (a buyer + a seller). The deleted
 *     user's identity is removed by deleting only the sale rows where the
 *     deleted user was a party AND the referenced horse belonged to the
 *     deleted user; the counterparty's other sales are untouched.
 *   - The append-only AuditLog trail uses a SOFT user reference (no FK)
 *     by design (SECURITY.md A09) so security/forensic records survive
 *     erasure. This is a lawful-basis retention exception, documented in
 *     the privacy policy.
 */

import bcrypt from 'bcryptjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import logger from '../../../utils/logger.mjs';
import { withRetryableTxMapping } from '../../../utils/retryableTransaction.mjs';
import { eraseOrAnonymizeOwnedHorses } from './gdprHorseLineageErasure.mjs';
import {
  SYSTEM_ACCOUNT_SHOW_ESCROW,
  SYSTEM_ACCOUNT_BURN,
  creditSystemAccount,
  debitSystemAccountOrThrow,
} from '../../economy/index.mjs';

/**
 * Interactive-transaction options for `eraseUserAccount` (Equoria-49bc2).
 *
 * Prisma's DEFAULT interactive-transaction budget is 5000 ms. The erasure body
 * walks an entire account, so a power user's erasure blew that budget, raised
 * P2028, and was mapped to a retryable 503 the client could never succeed at —
 * Article 17 erasure was PERMANENTLY impossible for exactly those accounts.
 *
 * A chunked/multi-transaction erasure was considered and REJECTED. This body is
 * not a bulk row delete, it is a settlement: it refunds money into OTHER
 * players' wallets, burns escrow, rewrites OTHER players' pedigrees, and ends
 * with the user row. Split across transactions, a crash between chunks leaves a
 * half-erased account — refunds paid but the account still present (a retry
 * double-refunds), or horses gone and the user row surviving as an unusable
 * ghost. A failed erasure is recoverable; a half-erased one is not. The
 * atomicity boundary therefore stays at the whole account, or nothing.
 *
 * Keeping one transaction means keeping its wall time honest, so the fix is
 * BOTH this explicit budget AND the removal of the O(N)-round-trip loops below
 * (the lineage walk and the show-cancel pass). 120 s is a ceiling for the
 * pathological account, not the expected cost. `maxWait` is the pool-acquire
 * budget: under contention, wait for a connection rather than fail outright —
 * and THAT 503 is genuinely actionable, unlike the old one.
 */
export const ERASURE_TX_OPTIONS = Object.freeze({
  timeout: 120_000,
  maxWait: 10_000,
});

/**
 * Build a complete, machine-readable export of a user's personal data.
 *
 * Strictly scoped: every nested query filters by the owning user's id (or
 * by ids of rows already proven to belong to the user). Returns `null` if
 * the user does not exist.
 *
 * @param {string} userId - The authenticated user's own id.
 * @returns {Promise<object|null>}
 */
export async function buildUserDataExport(userId) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('userId is required');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return null;
  }

  // Strip the password hash — never exported.
  const { password: _password, ...profile } = user;

  const [
    horses,
    transactions,
    notifications,
    grooms,
    riders,
    trainers,
    sentMessages,
    receivedMessages,
    forumThreads,
    forumPosts,
    clubMemberships,
    xpEvents,
    horseSalesAsSeller,
    horseSalesAsBuyer,
    competitionResults,
  ] = await Promise.all([
    prisma.horse.findMany({ where: { userId } }),
    prisma.userTransaction.findMany({ where: { userId } }),
    prisma.notification.findMany({ where: { userId } }),
    prisma.groom.findMany({ where: { userId } }),
    prisma.rider.findMany({ where: { userId } }),
    prisma.trainer.findMany({ where: { userId } }),
    prisma.directMessage.findMany({ where: { senderId: userId } }),
    prisma.directMessage.findMany({ where: { recipientId: userId } }),
    prisma.forumThread.findMany({ where: { authorId: userId } }),
    prisma.forumPost.findMany({ where: { authorId: userId } }),
    prisma.clubMembership.findMany({ where: { userId } }),
    prisma.xpEvent.findMany({ where: { userId } }),
    prisma.horseSale.findMany({ where: { sellerId: userId } }),
    prisma.horseSale.findMany({ where: { buyerId: userId } }),
    // Competition history for horses the user owns (their personal sporting record).
    prisma.competitionResult.findMany({ where: { horse: { userId } } }),
  ]);

  return {
    exportMetadata: {
      generatedAt: new Date().toISOString(),
      userId,
      schemaVersion: 1,
      description:
        'GDPR Article 15/20 data export. Contains all personal data Equoria holds about this account.',
    },
    profile,
    settings: profile.settings ?? {},
    horses,
    competitionHistory: competitionResults,
    transactions,
    notifications,
    grooms,
    riders,
    trainers,
    messages: {
      sent: sentMessages,
      received: receivedMessages,
    },
    forum: {
      threads: forumThreads,
      posts: forumPosts,
    },
    clubMemberships,
    xpEvents,
    horseSales: {
      asSeller: horseSalesAsSeller,
      asBuyer: horseSalesAsBuyer,
    },
  };
}

/**
 * Verify the supplied password matches the authenticated user's stored
 * hash. Used to gate the destructive deletion endpoint.
 *
 * @param {string} userId
 * @param {string} password
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function verifyAccountPassword(userId, password) {
  if (!password || typeof password !== 'string') {
    return { ok: false, reason: 'missing_password' };
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, password: true },
  });
  if (!user) {
    return { ok: false, reason: 'not_found' };
  }
  const valid = await bcrypt.compare(password, user.password);
  return valid ? { ok: true } : { ok: false, reason: 'bad_password' };
}

/**
 * Permanently erase a user's account and all data scoped to that user.
 *
 * Runs inside a single transaction. Deletes in FK-dependency order so the
 * final `user.delete` cannot be blocked by a `Restrict` relation. Every
 * statement is scoped to `userId` or to ids already proven to belong to
 * the user — never an unscoped `deleteMany`.
 *
 * Idempotent: if the user does not exist, returns `{ deleted: false }`
 * without throwing.
 *
 * No player-reachable route calls this (Equoria-gfany: players cannot delete
 * their accounts); it is kept for erasure an operator runs on request.
 *
 * @param {string} userId - The id of the account to erase.
 * @returns {Promise<{ deleted: boolean }>}
 */
export async function eraseUserAccount(userId) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('userId is required');
  }

  const exists = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!exists) {
    return { deleted: false };
  }

  await withRetryableTxMapping(
    prisma.$transaction(async tx => {
      // Ids of horses owned by THIS user. Used to scope horse-dependent
      // cleanup precisely — never "all horses".
      //
      // Equoria-49bc2: sireId/damId are selected HERE so the lineage fixpoint
      // walk further down can run entirely in memory off this single read
      // instead of issuing one findMany per pedigree generation. The owned
      // pedigree can only ever reference rows in this same result set (the
      // walk never leaves `horseIdSet`), so one round trip is sufficient.
      const ownedHorses = await tx.horse.findMany({
        where: { userId },
        select: { id: true, sireId: true, damId: true },
      });
      const horseIds = ownedHorses.map(h => h.id);

      // Ids of the grooms on THIS user's staff (groom-dependent cleanup scope).
      // Equoria-ypb7d.2: said "grooms owned by THIS user". Players engage grooms,
      // they never own them — and unlike the horses above, which really are owned.
      // Found by the round-4 population audit, not by any ownership pattern.
      const staffGrooms = await tx.groom.findMany({
        where: { userId },
        select: { id: true },
      });
      const groomIds = staffGrooms.map(g => g.id);

      // ── Club election artifacts authored by the user ──────────────────────
      // Equoria-8jyiv (owner ruling 2026-09-25): the user's candidacies are
      // WITHDRAWN — ballots OTHER players cast FOR them go with them, since
      // `ClubBallot.candidate` is RESTRICT and would otherwise fail the
      // candidate delete (23001). Other candidates and their ballots are
      // untouched; `ClubElection` stores no winner, so no outcome is rewritten.
      const ownCandidacies = await tx.clubCandidate.findMany({
        where: { userId },
        select: { id: true },
      });
      await tx.clubBallot.deleteMany({ where: { voterId: userId } });
      if (ownCandidacies.length > 0) {
        await tx.clubBallot.deleteMany({
          where: { candidateId: { in: ownCandidacies.map(c => c.id) } },
        });
      }
      await tx.clubCandidate.deleteMany({ where: { userId } });
      await tx.clubMembership.deleteMany({ where: { userId } });

      // Clubs the user leads: deleting cascades memberships + elections
      // (schema onDelete: Cascade on ClubMembership/ClubElection->Club).
      // Ballots/candidates under those elections must clear first.
      const ledClubs = await tx.club.findMany({
        where: { leaderId: userId },
        select: { id: true },
      });
      if (ledClubs.length > 0) {
        const ledClubIds = ledClubs.map(c => c.id);
        const ledElections = await tx.clubElection.findMany({
          where: { clubId: { in: ledClubIds } },
          select: { id: true },
        });
        const ledElectionIds = ledElections.map(e => e.id);
        if (ledElectionIds.length > 0) {
          const ledCandidates = await tx.clubCandidate.findMany({
            where: { electionId: { in: ledElectionIds } },
            select: { id: true },
          });
          const ledCandidateIds = ledCandidates.map(c => c.id);
          if (ledCandidateIds.length > 0) {
            await tx.clubBallot.deleteMany({
              where: { candidateId: { in: ledCandidateIds } },
            });
            await tx.clubCandidate.deleteMany({
              where: { id: { in: ledCandidateIds } },
            });
          }
          await tx.clubElection.deleteMany({
            where: { id: { in: ledElectionIds } },
          });
        }
        await tx.clubMembership.deleteMany({ where: { clubId: { in: ledClubIds } } });
        await tx.club.deleteMany({ where: { id: { in: ledClubIds } } });
      }

      // ── Forum content ─────────────────────────────────────────────────────
      await tx.forumPost.deleteMany({ where: { authorId: userId } });
      await tx.forumThread.deleteMany({ where: { authorId: userId } });

      // ── Direct messages (both directions) ─────────────────────────────────
      await tx.directMessage.deleteMany({ where: { senderId: userId } });
      await tx.directMessage.deleteMany({ where: { recipientId: userId } });

      // ── Horse sales involving the user ────────────────────────────────────
      // Remove sale rows where the user was a party. The counterparty's
      // unrelated sales are untouched (scoped to this user only).
      await tx.horseSale.deleteMany({ where: { sellerId: userId } });
      await tx.horseSale.deleteMany({ where: { buyerId: userId } });
      if (horseIds.length > 0) {
        // Any remaining sale rows referencing the user's horses (e.g. the
        // user bought a horse then it was resold) — clear so the horse can
        // be deleted (HorseSale.horse is Restrict).
        await tx.horseSale.deleteMany({ where: { horseId: { in: horseIds } } });
      }

      // ── Shows hosted/created by the user (Equoria-shsgd) ──────────────────
      // PROACTIVE CANCEL+REFUND for non-executed shows whose creator is
      // being deleted. Pre-shsgd we only nulled createdByUserId on every
      // show row, then let executeClosedShows pick the show up later. That
      // had two real defects for open/closed (not-yet-executed) shows:
      //
      //   (1) Entry fees that other users had paid into SystemAccount[show_escrow]
      //       were eventually burned at execute time (no creator to credit). The
      //       entrants get no refund AND their horse "competes" in a phantom show
      //       — they lose the entry fee with no offsetting outcome they care about.
      //   (2) The creator's prize escrow remained in SystemAccount[show_escrow]
      //       until execute. If the cron never picked the show up (cancelled
      //       cron, status filter drift), the money sat indefinitely.
      //
      // The senior fix is to terminate the show synchronously with the
      // account-deletion transaction:
      //   • Refund each entrant's paid fee from feeEscrow → entrant's wallet.
      //   • Move the creator's remaining prizeEscrow → SystemAccount[burn]
      //     (the creator's wallet is about to be deleted; the prize has no
      //     legitimate destination, and burn is the conservation-preserving
      //     terminal account).
      //   • Delete the ShowEntry rows so executeClosedShows finds nothing to
      //     score for the show, AND so the @@unique([showId, horseId])
      //     constraint stays clean if any horse is later re-entered elsewhere.
      //   • Mark the show 'completed' with executedAt = now so the cron's
      //     status:'open' filter skips it forever.
      //
      // Already-executed shows (status='completed') are left alone — their
      // money has already settled. We only null the identifying createdByUserId
      // on those rows below (the schema preserves their historical record).
      //
      // 'executing' status is the in-flight cron tick. We do NOT touch those
      // rows: the cron has already claimed them and is mid-payout; interfering
      // would cause double-pay or partial state. Worst-case, the cron lands
      // them as 'completed' with createdByUserId=null and the fee escrow goes
      // to burn (pre-existing si69u behavior, money still conserved).
      const cancellableShows = await tx.show.findMany({
        where: { createdByUserId: userId, status: { in: ['open', 'closed'] } },
        select: {
          id: true,
          name: true,
          prizeEscrow: true,
          feeEscrow: true,
          entries: {
            select: { id: true, userId: true, feePaid: true },
          },
        },
      });

      const cancelNow = new Date();
      for (const show of cancellableShows) {
        // Refund each entrant from feeEscrow. Aggregate per-entrant in case
        // a single entrant entered the same show with multiple horses (the
        // unique([showId, horseId]) constraint allows that — only the
        // (showId, horseId) tuple is unique, not (showId, userId)).
        const refundByUser = new Map();
        for (const entry of show.entries) {
          if (entry.feePaid > 0) {
            refundByUser.set(entry.userId, (refundByUser.get(entry.userId) ?? 0) + entry.feePaid);
          }
        }

        // Sanity: refunds cannot exceed the show's feeEscrow snapshot. If
        // the bookkeeping ever drifts (e.g. a manual DB edit), prefer to
        // refund what we can and leave the residue in escrow rather than
        // throw inside the GDPR transaction and roll back the entire
        // deletion. The money-conservation sentinel will surface the drift.
        let totalRefunded = 0;
        for (const [refundUserId, refundAmount] of refundByUser) {
          const allowed = Math.min(refundAmount, show.feeEscrow - totalRefunded);
          if (allowed <= 0) {
            logger.warn(
              `[gdprAccountService] show ${show.id} feeEscrow drift — entrant ${refundUserId} refund skipped (escrow exhausted before refund)`,
            );
            continue;
          }
          await debitSystemAccountOrThrow(tx, SYSTEM_ACCOUNT_SHOW_ESCROW, allowed, {
            category: 'show_cancel_refund_entrant',
            description: `Refund entry fee — show "${show.name}" cancelled (creator GDPR-deleted)`,
            linkedUserId: refundUserId,
            metadata: { showId: show.id, reason: 'creator_deleted' },
          });
          await tx.user.update({
            where: { id: refundUserId },
            data: { money: { increment: allowed } },
          });
          totalRefunded += allowed;
        }

        // Any feeEscrow residue (drift case above, or non-refundable fees)
        // moves to burn so conservation holds.
        const feeEscrowResidue = show.feeEscrow - totalRefunded;
        if (feeEscrowResidue > 0) {
          await debitSystemAccountOrThrow(tx, SYSTEM_ACCOUNT_SHOW_ESCROW, feeEscrowResidue, {
            category: 'show_cancel_burn_fee_residue',
            description: `Burn fee-escrow residue for cancelled show ${show.id}`,
            metadata: { showId: show.id, reason: 'fee_escrow_residue' },
          });
          await creditSystemAccount(tx, SYSTEM_ACCOUNT_BURN, feeEscrowResidue, {
            category: 'show_cancel_burn_fee_residue',
            description: `Burn fee-escrow residue for cancelled show ${show.id}`,
          });
        }

        // Burn the prize escrow — the creator's prize has no destination
        // (the creator's wallet is being deleted with their account).
        if (show.prizeEscrow > 0) {
          await debitSystemAccountOrThrow(tx, SYSTEM_ACCOUNT_SHOW_ESCROW, show.prizeEscrow, {
            category: 'show_cancel_burn_prize',
            description: `Burn prize escrow for cancelled show ${show.id} (creator GDPR-deleted)`,
            metadata: { showId: show.id, reason: 'creator_deleted' },
          });
          await creditSystemAccount(tx, SYSTEM_ACCOUNT_BURN, show.prizeEscrow, {
            category: 'show_cancel_burn_prize',
            description: `Burn prize escrow for cancelled show ${show.id}`,
          });
        }
      }

      // Equoria-49bc2: the per-show entry delete and the per-show terminal
      // status write used to sit INSIDE the loop above — two round trips per
      // cancelled show. Both write identical data for every show in the set,
      // so they collapse to one statement each, scoped to exactly the show ids
      // the loop just settled. The per-entrant refund + ledger writes stay
      // per-row on purpose: each one debits escrow and credits a DIFFERENT
      // surviving player's wallet with its own audit row, so there is no
      // correct bulk form.
      if (cancellableShows.length > 0) {
        const cancelledShowIds = cancellableShows.map(s => s.id);

        // Drop entries (otherwise executeClosedShows would still see them
        // through the status filter being widened, AND the entrant's horse
        // FK keeps the row alive — not our problem to clean up later).
        await tx.showEntry.deleteMany({ where: { showId: { in: cancelledShowIds } } });

        // Mark the shows terminated. status:'completed' + executedAt = now
        // takes them out of every executor's filter (status:'open' AND
        // closeDate<=now). createdByUserId is nulled in the bulk update
        // below for consistency with already-completed shows.
        await tx.show.updateMany({
          where: { id: { in: cancelledShowIds } },
          data: {
            status: 'completed',
            executedAt: cancelNow,
            prizeEscrow: 0,
            feeEscrow: 0,
          },
        });
      }

      // ── The user's OWN entries on OTHER players' shows (Equoria-hr0jw) ────
      // `ShowEntry.userId` is a REQUIRED relation, so it carries Prisma's
      // default RESTRICT. Until now the erasure never deleted these rows: the
      // cancel pass above only clears entries on shows the user CREATED, and
      // everything else was left to `ShowEntry.horse` (onDelete: Cascade) to
      // sweep up when the horse was hard-deleted.
      //
      // That covered the common case by accident, and broke on the ordinary
      // one. When the Equoria-cugl9 lineage rule PRESERVES a horse (a
      // surviving player's horse descends from it), the horse row stays, so
      // its ShowEntry stays, so the terminal `tx.user.delete` below fails with
      //   23001 ... violates RESTRICT ... "show_entries_userId_fkey"
      // and the whole erasure rolls back. The shape is stable, so retrying can
      // never clear it: a breeder who sold a foal on and had entered that
      // horse in someone else's show could NEVER be erased.
      //
      // RETENTION RULING — the entry is deleted and the fee stays escrowed to
      // the host:
      //   • Equoria has no withdraw-from-show path. Once `enterShowAtomicTx`
      //     moves a fee into SystemAccount[show_escrow] it is the HOST's at
      //     settlement (`settleShowFeeEscrow`); there is no inverse operation
      //     and no refund anywhere in the entry lifecycle.
      //   • This is already what the cascade path does for every other entry
      //     this erasure touches. Making the delete explicit makes ALL of the
      //     user's entries behave identically, rather than the outcome hinging
      //     on whether some other player happened to breed from the horse.
      //   • Money is conserved because nothing here moves: neither
      //     SystemAccount[show_escrow] nor the show's prizeEscrow/feeEscrow
      //     columns are touched, so the si69u invariant
      //     (escrow.balance == SUM(prizeEscrow + feeEscrow)) still holds and
      //     the host settles exactly what they were always going to settle.
      //     Refunding instead would have to burn the money (the entrant's
      //     wallet is being deleted), which would shrink ANOTHER player's
      //     payout as a side effect of a stranger's erasure.
      //   • The other player's show is left defensible: still open, other
      //     entrants untouched, one horse scratched. A preserved horse is
      //     ownerless after anonymization, so leaving it entered would stage a
      //     competitor with nobody to pay a placing to.
      //
      // Scoped to this user's own rows only — never `{ showId }` on a show
      // someone else created.
      await tx.showEntry.deleteMany({ where: { userId } });

      // Show.hostUser / createdByUser are optional (String?) — null them so
      // the show (and other users' results under it) survive, but the
      // identifying link to the deleted user is removed. This now covers
      // BOTH the shows we just cancelled above AND any already-completed
      // shows whose payouts have already settled.
      await tx.show.updateMany({
        where: { hostUserId: userId },
        data: { hostUserId: null },
      });
      await tx.show.updateMany({
        where: { createdByUserId: userId },
        data: { createdByUserId: null },
      });

      // ── Staff marketplace state (Cascade, but explicit for clarity) ───────
      await tx.staffMarketplaceState.deleteMany({ where: { userId } });

      // ── Riders / Trainers owned by the user ───────────────────────────────
      // Their assignments cascade-delete with the rider/trainer (schema
      // onDelete: Cascade on RiderAssignment/TrainerAssignment -> Rider/Trainer).
      await tx.rider.deleteMany({ where: { userId } });
      await tx.trainer.deleteMany({ where: { userId } });

      // ── Horses + horse-scoped graph (Equoria-cugl9: lineage anonymization) ─
      // Owns the "anonymize an ancestor a surviving player descends from,
      // hard-delete the rest" partition. Runs inside THIS transaction.
      await eraseOrAnonymizeOwnedHorses(tx, userId, ownedHorses);

      // ── Grooms on the user's staff (Equoria-ypb7d.2: engaged, never owned) ──
      // Groom children (assignments, interactions, synergies, logs,
      // salary/performance) are onDelete: Cascade on the groom.
      if (groomIds.length > 0) {
        await tx.groom.deleteMany({ where: { userId } });
      }

      // ── Remaining directly-keyed rows ─────────────────────────────────────
      // (Most are Cascade on user, but deleting explicitly inside the same
      // transaction keeps the final user.delete unambiguous and the intent
      // auditable.)
      await tx.userRankSnapshot.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.userTransaction.deleteMany({ where: { userId } });
      await tx.xpEvent.deleteMany({ where: { userId } });
      await tx.refreshToken.deleteMany({ where: { userId } });
      await tx.passwordResetToken.deleteMany({ where: { userId } });
      await tx.emailVerificationToken.deleteMany({ where: { userId } });
      await tx.groomSalaryPayment.deleteMany({ where: { userId } });
      await tx.groomPerformanceRecord.deleteMany({ where: { userId } });
      await tx.facility.deleteMany({ where: { userId } });

      // ── Finally the user row ──────────────────────────────────────────────
      await tx.user.delete({ where: { id: userId } });
    }, ERASURE_TX_OPTIONS),
    { message: 'Account service is busy right now, please retry in a moment.' },
  );

  logger.info(`[gdprAccountService] Erased account ${userId} (GDPR right-to-erasure)`);
  return { deleted: true };
}
