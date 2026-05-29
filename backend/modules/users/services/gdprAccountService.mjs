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

  await prisma.$transaction(async tx => {
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

    // ── Shows hosted/created by the user ──────────────────────────────────
    // Show.hostUser / createdByUser are optional (String?) — null them so
    // the show (and other users' results under it) survive, but the
    // identifying link to the deleted user is removed.
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

    // ── Horses + horse-scoped graph ───────────────────────────────────────
    if (horseIds.length > 0) {
      // Break lineage pointers FROM other horses INTO the user's horses
      // (damId/sireId are Restrict). Scope: only horses that point at the
      // user's horses.
      await tx.horse.updateMany({
        where: { damId: { in: horseIds } },
        data: { damId: null },
      });
      await tx.horse.updateMany({
        where: { sireId: { in: horseIds } },
        data: { sireId: null },
      });
      // Most horse children (competitionResults, trainingLogs,
      // foalDevelopment, horseXpEvents, trait logs, groom*) are
      // onDelete: Cascade — they go automatically. Delete the horses
      // (scoped to this user).
      await tx.horse.deleteMany({ where: { userId } });
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
  });

  logger.info(`[gdprAccountService] Erased account ${userId} (GDPR right-to-erasure)`);
  return { deleted: true };
}
