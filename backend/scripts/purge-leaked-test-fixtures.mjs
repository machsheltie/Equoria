#!/usr/bin/env node
/**
 * purge-leaked-test-fixtures.mjs (Equoria-6n9dj)
 *
 * SCOPED, FK-ORDERED cleanup for TEST-fixture users + their owned data that
 * leaked into the canonical Equoria DB. Test runs emit recurring warnings of
 * the form:
 *
 *   update or delete on table "User" violates foreign key constraint
 *   "horses_userId_fkey" on table "horses"
 *
 * The root cause is twofold:
 *   1. Some suites' afterAll cleanup deletes (or attempts to delete) a test
 *      User row WITHOUT first FK-ordering its owned Horse rows. Horse.userId
 *      is `onDelete: Restrict` (schema line ~282), so the user delete is
 *      blocked and the row — plus its horses — is left behind.
 *   2. The Jest globalTeardown (backend/tests/config/globalTeardown.mjs) only
 *      ran a conditional User+refreshToken delete and never touched horses,
 *      so it could not clear the leak either (and would itself hit the same
 *      FK error). That teardown is FK-order-fixed in the same change as this
 *      script.
 *
 * ──────────────────────────────────────────────────────────────────────────
 *  SAFETY DOCTRINE (CLAUDE.md §2/§3 + the c3kb6 DB-wipe incident)
 * ──────────────────────────────────────────────────────────────────────────
 *  - This script touches the CANONICAL Equoria DB. There is therefore NO
 *    unscoped `deleteMany()` anywhere in this file. EVERY delete is scoped
 *    either to a TEST-ONLY identifier pattern, or to ids already proven to
 *    belong to a matched test user.
 *  - Leaked rows are identified by TEST patterns ONLY (see TEST_USER_WHERE):
 *      • email ends in `@test.com` or `@example.com`
 *      • email or username starts with `TestFixture-` / `testfixture-`
 *    These domains/prefixes are reserved for fixtures + seed data across the
 *    backend test suite (authHelper.createTestUser → `test_*@example.com`;
 *    bankController/csrf/etc → `*@test.com`; module fixtures →
 *    `TestFixture-*`). No real player account uses these domains.
 *  - DRY-RUN BY DEFAULT. With no flags (or `--dry-run`) the script COUNTS the
 *    matched users + their FK-dependent rows and prints the exact scoped
 *    WHERE clauses, but performs ZERO writes. Deletes happen ONLY with an
 *    explicit `--execute` flag.
 *  - Main-module guarded (c3kb6 / 5z0if): importing this file is side-effect
 *    free. It only runs when invoked as the direct entrypoint.
 *
 *  USAGE (run by the LEAD after review — NOT by the authoring agent):
 *    # 1. See what WOULD be deleted (no writes):
 *    node backend/scripts/purge-leaked-test-fixtures.mjs
 *    node backend/scripts/purge-leaked-test-fixtures.mjs --dry-run   # explicit
 *
 *    # 2. After reviewing the dry-run output, actually delete:
 *    node backend/scripts/purge-leaked-test-fixtures.mjs --execute
 *
 *  The FK-ordered delete mirrors the proven ordering in
 *  backend/modules/users/services/gdprAccountService.mjs#eraseUserAccount —
 *  the same Restrict relations must clear before the final user.delete:
 *  Horse (+ self-referential sire/dam edges within the deleted set),
 *  Groom, Rider, Trainer, Show host/creator (nulled), forum content,
 *  direct messages, horse sales, club artifacts, show entries.
 */

import { fileURLToPath } from 'node:url';
import prisma from '../../packages/database/prismaClient.mjs';

/**
 * TEST-ONLY user matcher. This is the ONLY heuristic used to decide what is a
 * leaked fixture. Scoped to reserved test email domains + fixture name
 * prefixes — never a broad match. A real player account cannot match this.
 */
const TEST_USER_WHERE = {
  OR: [
    // Reserved fixture/seed domains used across the backend suite.
    { email: { endsWith: '@test.com' } },
    { email: { endsWith: '@example.com' } },
    { email: { endsWith: '@example.org' } },
    // RFC 2606 / RFC 6761 reserved TLDs — GUARANTEED never to be a real,
    // deliverable player address. Covers @equoria.test, @fixture.test,
    // @sentinel.test, @example.test, @test.invalid, @testfixture.invalid,
    // @test.local, @*.localhost, @*.example, etc. The `.` prefix on each
    // endsWith ensures we match the TLD boundary, not a substring.
    { email: { endsWith: '.test' } },
    { email: { endsWith: '.invalid' } },
    { email: { endsWith: '.local' } },
    { email: { endsWith: '.localhost' } },
    { email: { endsWith: '.example' } },
    // Fixture name prefixes (covers users created without a test-domain email).
    { email: { startsWith: 'TestFixture-' } },
    { email: { startsWith: 'testfixture-' } },
    { email: { startsWith: 'testfixture_' } },
    { username: { startsWith: 'TestFixture-' } },
    { username: { startsWith: 'testfixture-' } },
  ],
};

/**
 * Print the human-readable scoped WHERE clause so the lead can audit exactly
 * what the matcher targets before any write happens.
 */
function describeScope() {
  console.log('Scoped TEST-user matcher (the ONLY rows this script touches):');
  console.log('  user WHERE OR [');
  console.log("    email endsWith '@test.com' | '@example.com' | '@example.org',");
  console.log(
    "    email endsWith '.test' | '.invalid' | '.local' | '.localhost' | '.example'  (reserved TLDs),",
  );
  console.log("    email startsWith 'TestFixture-' | 'testfixture-' | 'testfixture_',");
  console.log("    username startsWith 'TestFixture-' | 'testfixture-',");
  console.log('  ]');
  console.log(
    '  All FK-dependent deletes are scoped to { userId: { in: <matched ids> } } ' +
      'or { id: { in: <ids proven to belong to a matched user> } }.\n',
  );
}

/**
 * Count what a dry-run would delete, scoped to the matched test users.
 * Returns the matched user ids + per-table counts for reporting.
 */
async function collectDryRunCounts() {
  const users = await prisma.user.findMany({
    where: TEST_USER_WHERE,
    select: { id: true, email: true, username: true },
  });
  const userIds = users.map(u => u.id);

  if (userIds.length === 0) {
    return { users, userIds, counts: {} };
  }

  const horses = await prisma.horse.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const horseIds = horses.map(h => h.id);

  // Count every FK-dependent surface that the FK-ordered delete will touch.
  // Each count query is scoped to the matched user ids (or their horse ids).
  const [
    horseCount,
    groomCount,
    riderCount,
    trainerCount,
    notificationCount,
    transactionCount,
    xpEventCount,
    refreshTokenCount,
    forumThreadCount,
    forumPostCount,
    sentMessageCount,
    receivedMessageCount,
    horseSaleSellerCount,
    horseSaleBuyerCount,
    clubMembershipCount,
    showEntryCount,
    facilityCount,
    hostedShowCount,
    createdShowCount,
  ] = await Promise.all([
    prisma.horse.count({ where: { userId: { in: userIds } } }),
    prisma.groom.count({ where: { userId: { in: userIds } } }),
    prisma.rider.count({ where: { userId: { in: userIds } } }),
    prisma.trainer.count({ where: { userId: { in: userIds } } }),
    prisma.notification.count({ where: { userId: { in: userIds } } }),
    prisma.userTransaction.count({ where: { userId: { in: userIds } } }),
    prisma.xpEvent.count({ where: { userId: { in: userIds } } }),
    prisma.refreshToken.count({ where: { userId: { in: userIds } } }),
    prisma.forumThread.count({ where: { authorId: { in: userIds } } }),
    prisma.forumPost.count({ where: { authorId: { in: userIds } } }),
    prisma.directMessage.count({ where: { senderId: { in: userIds } } }),
    prisma.directMessage.count({ where: { recipientId: { in: userIds } } }),
    prisma.horseSale.count({ where: { sellerId: { in: userIds } } }),
    prisma.horseSale.count({ where: { buyerId: { in: userIds } } }),
    prisma.clubMembership.count({ where: { userId: { in: userIds } } }),
    prisma.showEntry.count({ where: { userId: { in: userIds } } }),
    prisma.facility.count({ where: { userId: { in: userIds } } }),
    prisma.show.count({ where: { hostUserId: { in: userIds } } }),
    prisma.show.count({ where: { createdByUserId: { in: userIds } } }),
  ]);

  return {
    users,
    userIds,
    horseIds,
    counts: {
      users: users.length,
      horses: horseCount,
      grooms: groomCount,
      riders: riderCount,
      trainers: trainerCount,
      notifications: notificationCount,
      transactions: transactionCount,
      xpEvents: xpEventCount,
      refreshTokens: refreshTokenCount,
      forumThreads: forumThreadCount,
      forumPosts: forumPostCount,
      directMessagesSent: sentMessageCount,
      directMessagesReceived: receivedMessageCount,
      horseSalesAsSeller: horseSaleSellerCount,
      horseSalesAsBuyer: horseSaleBuyerCount,
      clubMemberships: clubMembershipCount,
      showEntries: showEntryCount,
      facilities: facilityCount,
      'shows (host link nulled, not deleted)': hostedShowCount,
      'shows (creator link nulled, not deleted)': createdShowCount,
    },
  };
}

/**
 * FK-ordered, userId-scoped deletion of the matched test users. Mirrors the
 * proven ordering in gdprAccountService.eraseUserAccount — every Restrict
 * relation is cleared before the final user.delete. Runs in a single
 * transaction so a partial failure rolls back (no half-deleted users).
 *
 * NOTE on lineage: unlike the GDPR path, this does NOT attempt to preserve
 * ancestors with surviving external descendants. Leaked test horses are
 * fixtures; if a fixture horse were a real ancestor of a real player's horse
 * the matcher would not have selected its (test-domain) owner anyway. We hard
 * delete the matched users' horses, clearing only self-referential sire/dam
 * edges WITHIN the deleted set so the Restrict lineage FKs don't block.
 */
async function executeScopedPurge(userIds, horseIds) {
  if (userIds.length === 0) {
    return { deletedUsers: 0 };
  }

  await prisma.$transaction(async tx => {
    // ── Club election artifacts authored by the matched users ──────────────
    await tx.clubBallot.deleteMany({ where: { voterId: { in: userIds } } });
    await tx.clubCandidate.deleteMany({ where: { userId: { in: userIds } } });
    await tx.clubMembership.deleteMany({ where: { userId: { in: userIds } } });

    // Clubs led by a matched user: clear ballots/candidates/elections under
    // them, then memberships, then the clubs. Scoped to ids derived from the
    // matched users only.
    const ledClubs = await tx.club.findMany({
      where: { leaderId: { in: userIds } },
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
          await tx.clubBallot.deleteMany({ where: { candidateId: { in: ledCandidateIds } } });
          await tx.clubCandidate.deleteMany({ where: { id: { in: ledCandidateIds } } });
        }
        await tx.clubElection.deleteMany({ where: { id: { in: ledElectionIds } } });
      }
      await tx.clubMembership.deleteMany({ where: { clubId: { in: ledClubIds } } });
      await tx.club.deleteMany({ where: { id: { in: ledClubIds } } });
    }

    // ── Forum content ──────────────────────────────────────────────────────
    await tx.forumPost.deleteMany({ where: { authorId: { in: userIds } } });
    await tx.forumThread.deleteMany({ where: { authorId: { in: userIds } } });

    // ── Direct messages (both directions) ───────────────────────────────────
    await tx.directMessage.deleteMany({ where: { senderId: { in: userIds } } });
    await tx.directMessage.deleteMany({ where: { recipientId: { in: userIds } } });

    // ── Horse sales involving the matched users ──────────────────────────────
    await tx.horseSale.deleteMany({ where: { sellerId: { in: userIds } } });
    await tx.horseSale.deleteMany({ where: { buyerId: { in: userIds } } });
    if (horseIds.length > 0) {
      // Any sale row still referencing a matched user's horse (HorseSale.horse
      // is Restrict) must clear before the horse delete.
      await tx.horseSale.deleteMany({ where: { horseId: { in: horseIds } } });
    }

    // ── Show entries by the matched users, then null show host/creator links ─
    await tx.showEntry.deleteMany({ where: { userId: { in: userIds } } });
    await tx.show.updateMany({
      where: { hostUserId: { in: userIds } },
      data: { hostUserId: null },
    });
    await tx.show.updateMany({
      where: { createdByUserId: { in: userIds } },
      data: { createdByUserId: null },
    });

    // ── Staff marketplace state (Cascade, explicit for clarity) ──────────────
    await tx.staffMarketplaceState.deleteMany({ where: { userId: { in: userIds } } });

    // ── Riders / Trainers owned by the matched users (assignments cascade) ───
    await tx.rider.deleteMany({ where: { userId: { in: userIds } } });
    await tx.trainer.deleteMany({ where: { userId: { in: userIds } } });

    // ── Horses owned by the matched users ────────────────────────────────────
    if (horseIds.length > 0) {
      // Clear self-referential lineage edges WITHIN the deleted set so the
      // damId/sireId Restrict FKs don't block. Scoped to deleted-horse →
      // deleted-horse edges only (never touches a surviving horse's pointers).
      await tx.horse.updateMany({
        where: { id: { in: horseIds }, damId: { in: horseIds } },
        data: { damId: null },
      });
      await tx.horse.updateMany({
        where: { id: { in: horseIds }, sireId: { in: horseIds } },
        data: { sireId: null },
      });
      // Horse children (competitionResults, trainingLogs, foalDevelopment,
      // horseXpEvents, trait logs, groom*) are onDelete: Cascade.
      await tx.horse.deleteMany({ where: { id: { in: horseIds } } });
    }

    // ── Grooms owned by the matched users (groom children cascade) ───────────
    await tx.groom.deleteMany({ where: { userId: { in: userIds } } });

    // ── Remaining directly-keyed rows (most Cascade, explicit for intent) ────
    await tx.userRankSnapshot.deleteMany({ where: { userId: { in: userIds } } });
    await tx.notification.deleteMany({ where: { userId: { in: userIds } } });
    await tx.userTransaction.deleteMany({ where: { userId: { in: userIds } } });
    await tx.xpEvent.deleteMany({ where: { userId: { in: userIds } } });
    await tx.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await tx.passwordResetToken.deleteMany({ where: { userId: { in: userIds } } });
    await tx.emailVerificationToken.deleteMany({ where: { userId: { in: userIds } } });
    await tx.groomSalaryPayment.deleteMany({ where: { userId: { in: userIds } } });
    await tx.groomPerformanceRecord.deleteMany({ where: { userId: { in: userIds } } });
    await tx.facility.deleteMany({ where: { userId: { in: userIds } } });

    // ── Finally the matched user rows ─────────────────────────────────────────
    await tx.user.deleteMany({ where: { id: { in: userIds } } });
  });

  return { deletedUsers: userIds.length };
}

/**
 * Entry point. Default = dry-run. `--execute` = perform the scoped purge.
 */
async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes('--execute');
  const dryRun = !execute; // --dry-run is the default; the flag is accepted but optional

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  purge-leaked-test-fixtures (Equoria-6n9dj)');
  console.log(`  Mode: ${execute ? 'EXECUTE (writes WILL happen)' : 'DRY-RUN (no writes)'}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  describeScope();

  const { users, userIds, horseIds, counts } = await collectDryRunCounts();

  if (userIds.length === 0) {
    console.log('No leaked test-fixture users matched. Nothing to do.\n');
    return;
  }

  console.log(`Matched ${userIds.length} test-fixture user(s). FK-dependent row counts:`);
  for (const [table, count] of Object.entries(counts)) {
    console.log(`  ${table.padEnd(42)} ${count}`);
  }
  console.log('');

  // Show a sample of matched users so the lead can sanity-check the matcher.
  const sample = users.slice(0, 20);
  console.log(`Sample of matched users (first ${sample.length} of ${users.length}):`);
  for (const u of sample) {
    console.log(`  ${u.id}  ${u.email}  (${u.username})`);
  }
  console.log('');

  if (dryRun) {
    console.log('DRY-RUN complete. No rows were modified.');
    console.log('Re-run with --execute to perform the scoped FK-ordered purge.\n');
    return;
  }

  console.log('Executing scoped FK-ordered purge inside a single transaction...\n');
  const { deletedUsers } = await executeScopedPurge(userIds, horseIds);
  console.log(
    `✅ Purge complete. Deleted ${deletedUsers} test-fixture user(s) and their owned data.\n`,
  );
}

// Equoria-6n9dj / 5z0if: main-module guard. main() performs destructive,
// userId-scoped Prisma deletes when invoked with --execute — it MUST NOT run
// on bare import (e.g. parse-check `node -e "import('./purge-leaked-test-fixtures.mjs')"`).
// Canonical cross-platform form (CONTRIBUTING.md): fileURLToPath, not string concat.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async err => {
      console.error('Fatal:', err);
      await prisma.$disconnect();
      process.exit(1);
    });
}

export { TEST_USER_WHERE, collectDryRunCounts, executeScopedPurge, main };
