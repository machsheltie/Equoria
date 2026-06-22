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
import {
  SYSTEM_ACCOUNT_SHOW_ESCROW,
  SYSTEM_ACCOUNT_BURN,
  creditSystemAccount,
  debitSystemAccountOrThrow,
} from '../../economy/index.mjs';

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
 * without throwing (the caller maps this to 404).
 *
 * @param {string} userId - The authenticated user's own id.
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
      const ownedHorses = await tx.horse.findMany({
        where: { userId },
        select: { id: true },
      });
      const horseIds = ownedHorses.map(h => h.id);

      // Ids of grooms owned by THIS user (groom-dependent cleanup scope).
      const ownedGrooms = await tx.groom.findMany({
        where: { userId },
        select: { id: true },
      });
      const groomIds = ownedGrooms.map(g => g.id);

      // ── Club election artifacts authored by the user ──────────────────────
      await tx.clubBallot.deleteMany({ where: { voterId: userId } });
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

        // Drop entries (otherwise executeClosedShows would still see them
        // through the status filter being widened, AND the entrant's horse
        // FK keeps the row alive — not our problem to clean up later).
        await tx.showEntry.deleteMany({ where: { showId: show.id } });

        // Mark the show terminated. status:'completed' + executedAt = now
        // takes it out of every executor's filter (status:'open' AND
        // closeDate<=now). createdByUserId is nulled in the bulk update
        // below for consistency with already-completed shows.
        await tx.show.update({
          where: { id: show.id },
          data: {
            status: 'completed',
            executedAt: cancelNow,
            prizeEscrow: 0,
            feeEscrow: 0,
          },
        });
      }

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
      if (horseIds.length > 0) {
        // A user's horse may be a breeding ANCESTOR of horses owned by OTHER,
        // surviving users. The pre-cugl9 code nulled damId/sireId on EVERY
        // descendant pointing at the user's horses, then deleted the user's
        // horses — that DESTROYED the lineage of descendants the deleted user
        // never owned (collateral damage to another player's horse graph).
        //
        // The senior fix (per the issue + a richer breeding economy): partition
        // the user's horses into
        //   (a) ANCESTORS WITH A SURVIVING EXTERNAL DESCENDANT — a horse that
        //       has at least one offspring whose owner is NOT this user. These
        //       are ANONYMIZED (detached + PII-scrubbed), NOT deleted, so the
        //       descendant keeps its damId/sireId pointer and the breeding
        //       graph survives.
        //   (b) ALL OTHER owned horses — hard-deleted as before (no external
        //       graph value to preserve).
        //
        // A descendant owned by THIS SAME user is being deleted in this very
        // transaction, so it does not count as a reason to preserve its parent
        // — hence the `userId: { not: userId }` (plus null-owner) filter below.
        // The set we may NOT delete. Seed it with the user's horses that are
        // DIRECT parents of a surviving external descendant, then expand
        // transitively UP the ancestry: a preserved horse's own owned ancestors
        // (grandparents, great-grandparents, ...) must ALSO be preserved, or a
        // multi-generation lineage would lose its deeper ancestors and the
        // intermediate preserved horse would be left with a dangling parent edge.
        const horseIdSet = new Set(horseIds);
        const preserveIds = new Set();

        // Seed: direct external children of any of the user's horses.
        const directExternalChildren = await tx.horse.findMany({
          where: {
            OR: [{ sireId: { in: horseIds } }, { damId: { in: horseIds } }],
            // Owned by ANYONE other than the user being deleted (another
            // surviving user, or an already-unowned/anonymized horse).
            NOT: { userId },
          },
          select: { sireId: true, damId: true },
        });
        for (const child of directExternalChildren) {
          if (child.sireId !== null && horseIdSet.has(child.sireId)) {
            preserveIds.add(child.sireId);
          }
          if (child.damId !== null && horseIdSet.has(child.damId)) {
            preserveIds.add(child.damId);
          }
        }

        // Transitive expansion: walk up. For every horse currently slated for
        // preservation, pull its sire/dam; if that parent is one of the user's
        // horses and not yet preserved, preserve it too. Iterate to a fixpoint.
        // Bounded by horseIds.length (each iteration adds ≥1 id or stops).
        let frontier = [...preserveIds];
        while (frontier.length > 0) {
          const parents = await tx.horse.findMany({
            where: { id: { in: frontier } },
            select: { sireId: true, damId: true },
          });
          const nextFrontier = [];
          for (const p of parents) {
            for (const parentId of [p.sireId, p.damId]) {
              if (parentId !== null && horseIdSet.has(parentId) && !preserveIds.has(parentId)) {
                preserveIds.add(parentId);
                nextFrontier.push(parentId);
              }
            }
          }
          frontier = nextFrontier;
        }

        const idsToDelete = horseIds.filter(id => !preserveIds.has(id));

        // (a) Anonymize the ancestors that must survive for the lineage. Detach
        //     from the deleted user (userId -> null) and scrub user-identifying
        //     fields. The horse row + the descendants' lineage pointers INTO it
        //     are left intact (that is the whole point). We deliberately do NOT
        //     cascade-delete the ancestor's own horse children here — the horse
        //     survives, so its competition history / logs survive with it (no
        //     longer attributed to the deleted user).
        //
        //     Safety net: clear a preserved ancestor's OWN sireId/damId if it
        //     somehow references a horse slated for hard-delete in step (b).
        //     The transitive expansion above already guarantees a preserved
        //     horse's owned parents are themselves preserved, so this should
        //     never fire — but if it did, leaving the edge would make the
        //     deleted horse a referenced parent and the Restrict FK would block
        //     its deletion. Defensive only; loses no graph value when inert.
        const fetchedPreserved =
          preserveIds.size > 0
            ? await tx.horse.findMany({
                where: { id: { in: [...preserveIds] } },
                select: { id: true, sireId: true, damId: true },
              })
            : [];
        const deleteIdSet = new Set(idsToDelete);
        for (const ancestor of fetchedPreserved) {
          await tx.horse.update({
            where: { id: ancestor.id },
            data: {
              userId: null,
              name: `Anonymized Horse #${ancestor.id}`,
              forSale: false,
              salePrice: 0,
              studStatus: 'Not at Stud',
              studFee: 0,
              // Drop dangling edges into horses being deleted in step (b).
              ...(ancestor.sireId !== null && deleteIdSet.has(ancestor.sireId)
                ? { sireId: null }
                : {}),
              ...(ancestor.damId !== null && deleteIdSet.has(ancestor.damId)
                ? { damId: null }
                : {}),
            },
          });
        }

        // (b) Hard-delete the remaining owned horses. Their lineage pointers
        //     into siblings that are ALSO being deleted (or into preserved
        //     ancestors) must be cleared first so the damId/sireId Restrict FKs
        //     don't block — but scoped ONLY to deleted-horse → deleted-horse
        //     edges (never touching a surviving/anonymized horse's pointers).
        if (idsToDelete.length > 0) {
          await tx.horse.updateMany({
            where: { id: { in: idsToDelete }, damId: { in: idsToDelete } },
            data: { damId: null },
          });
          await tx.horse.updateMany({
            where: { id: { in: idsToDelete }, sireId: { in: idsToDelete } },
            data: { sireId: null },
          });
          // Most horse children (competitionResults, trainingLogs,
          // foalDevelopment, horseXpEvents, trait logs, groom*) are
          // onDelete: Cascade — they go automatically.
          await tx.horse.deleteMany({ where: { id: { in: idsToDelete } } });
        }
      }

      // ── Grooms owned by the user ──────────────────────────────────────────
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
    }),
    { message: 'Account service is busy right now, please retry in a moment.' },
  );

  logger.info(`[gdprAccountService] Erased account ${userId} (GDPR right-to-erasure)`);
  return { deleted: true };
}
