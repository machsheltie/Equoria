/**
 * gdprAccountRoutes.integration.test.mjs
 *
 * Equoria-s3rf — GDPR Right-to-Access (data export) endpoint + the
 * Right-to-Erasure cascade.
 *
 * Equoria-gfany: players cannot delete their accounts, so the HTTP erasure
 * route (POST /api/v1/account/delete) is closed and locked by
 * accountDeletionClosed.integration.test.mjs. The erasure cascade stays for
 * operator-run erasure and is exercised here through `eraseUserAccount()`.
 *
 * Real-DB integration test — NO mocks. Exercises the live Express app,
 * real auth/CSRF middleware, and the canonical Equoria DB.
 *
 * CRITICAL SAFETY: every fixture row's id is tracked the moment it is
 * created, and cleanup is FAIL-LOUD (createCleanupTracker — a failed
 * delete throws in afterAll instead of console.warn'ing the leak away;
 * the previous cleanupTestData() helper silently swallowed a
 * ClubMembership_userId_fkey RESTRICT error and leaked the whole fixture
 * graph) and FK-ORDERED (children before parents: membership → club →
 * posts → threads → messages → staff → notifications → transactions →
 * horses → users). Every delete is strictly id-scoped
 * (where: { id: { in: trackedIds } }) — never a broad deleteMany. When
 * the erasure endpoint under test succeeds, its cascade has already
 * removed the subject's rows and these deletes are count-0 no-ops — that
 * is fine; fail-loud means surfacing thrown errors, not requiring rows to
 * exist. The deletion endpoint is itself scoped strictly to the
 * authenticated user's own userId.
 *
 * AC coverage:
 *   1. GET /api/v1/account/export returns the caller's own personal data
 *      (profile, horses, transactions) and NOTHING belonging to other users.
 *   2. Export is self-only — there is no path param, so a token only ever
 *      yields its own data (cross-user access is structurally impossible);
 *      an unauthenticated request is rejected (401 by authenticateToken —
 *      no CSRF pair is sent because auth runs before CSRF on this router).
 *   3. (retired with Equoria-gfany — the password-confirmed route is closed.)
 *   4. `eraseUserAccount()` removes the user's PII + owned data and is
 *      idempotent (second call → { deleted: false }, never a throw).
 *   5. A deleted user can no longer authenticate (login → 401; login is a
 *      public route with no csrfProtection, so no CSRF pair is sent).
 *      Non-vacuous: the same credentials are proven to log in successfully
 *      BEFORE the deletion, so the post-delete 401 can only be caused by
 *      the erasure. Fixture emails are lowercase because the login route's
 *      normalizeEmail() validator lowercases the submitted email before
 *      lookup — a mixed-case stored email would 401 even for a live
 *      account and make this assertion pass for the wrong reason.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, createTestHorse } from '../../../tests/helpers/testAuth.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { eraseUserAccount } from '../services/gdprAccountService.mjs';

const PASSWORD = 'TestPassword123!';
const ORIGIN = 'http://localhost:3000';

describe('INTEGRATION: GDPR account export/delete (Equoria-s3rf)', () => {
  const cleanup = createCleanupTracker();

  // Per-model fixture id ledgers. Every create below pushes its id here
  // IMMEDIATELY so a mid-test failure still leaves a complete ledger for
  // the FK-ordered afterAll cleanup.
  const ids = {
    users: [],
    horses: [],
    grooms: [],
    riders: [],
    trainers: [],
    notifications: [],
    transactions: [],
    messages: [],
    posts: [],
    threads: [],
    memberships: [],
    clubs: [],
  };

  beforeAll(() => {
    // FK-ordered, id-scoped, fail-loud cleanup. Registration order = run
    // order (children before parents). When the erasure endpoint succeeds,
    // its cascade has already removed the subject's rows and these deletes
    // are no-ops; when it regresses (e.g. the CSRF 403 this suite used to
    // have), this is what prevents the fixture graph from leaking into the
    // canonical DB (the previous cleanupTestData() swallowed the
    // ClubMembership_userId_fkey RESTRICT error and leaked the user).
    cleanup.add(() => prisma.clubMembership.deleteMany({ where: { id: { in: ids.memberships } } }), 'clubMemberships');
    cleanup.add(() => prisma.club.deleteMany({ where: { id: { in: ids.clubs } } }), 'clubs');
    cleanup.add(() => prisma.forumPost.deleteMany({ where: { id: { in: ids.posts } } }), 'forumPosts');
    cleanup.add(() => prisma.forumThread.deleteMany({ where: { id: { in: ids.threads } } }), 'forumThreads');
    cleanup.add(() => prisma.directMessage.deleteMany({ where: { id: { in: ids.messages } } }), 'directMessages');
    cleanup.add(() => prisma.groom.deleteMany({ where: { id: { in: ids.grooms } } }), 'grooms');
    cleanup.add(() => prisma.rider.deleteMany({ where: { id: { in: ids.riders } } }), 'riders');
    cleanup.add(() => prisma.trainer.deleteMany({ where: { id: { in: ids.trainers } } }), 'trainers');
    cleanup.add(() => prisma.notification.deleteMany({ where: { id: { in: ids.notifications } } }), 'notifications');
    cleanup.add(
      () => prisma.userTransaction.deleteMany({ where: { id: { in: ids.transactions } } }),
      'userTransactions',
    );
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: ids.horses } } }), 'horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: ids.users } } }), 'users');
  });

  afterAll(() => cleanup.run(), 120000);

  describe('GET /api/v1/account/export — Right to Access', () => {
    it('returns the caller own profile + horses and excludes other users data', async () => {
      const ts = randomBytes(8).toString('hex');
      const subject = await createTestUser({
        username: `TestFixture_gdprexp_${ts}`,
        email: `testfixture_gdprexp_${ts}@test.com`,
        password: PASSWORD,
      });
      ids.users.push(subject.user.id);
      const other = await createTestUser({
        username: `TestFixture_gdproth_${ts}`,
        email: `testfixture_gdproth_${ts}@test.com`,
        password: PASSWORD,
      });
      ids.users.push(other.user.id);

      // createTestHorse spreads fixtureColor() internally — no raw
      // NULL-phenotype horse create (CONTRIBUTING.md Equoria-dm1i).
      const subjectHorse = await createTestHorse({
        name: `TestFixture-GdprSubjectHorse_${ts}`,
        userId: subject.user.id,
      });
      ids.horses.push(subjectHorse.id);
      const otherHorse = await createTestHorse({
        name: `TestFixture-GdprOtherHorse_${ts}`,
        userId: other.user.id,
      });
      ids.horses.push(otherHorse.id);

      // Give the subject a transaction so the export proves it includes it.
      const txn = await prisma.userTransaction.create({
        data: {
          userId: subject.user.id,
          type: 'credit',
          amount: 250,
          category: 'test_fixture',
          description: `TestFixture-GdprExportTxn_${ts}`,
        },
      });
      ids.transactions.push(txn.id);

      // GET is a CSRF-safe method (csrfProtection only gates state-changing
      // verbs), so no CSRF pair is needed here — Bearer auth only.
      const res = await request(app)
        .get('/api/v1/account/export')
        .set('Authorization', `Bearer ${subject.token}`)
        .set('Origin', ORIGIN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data).toBeTruthy();

      // Profile is the subject's, password is NOT exported
      expect(data.profile.id).toBe(subject.user.id);
      expect(data.profile.email).toBe(`testfixture_gdprexp_${ts}@test.com`);
      expect(data.profile.password).toBeUndefined();

      // Horses: subject's horse present, other user's horse absent
      const horseIds = data.horses.map(h => h.id);
      expect(horseIds).toContain(subjectHorse.id);
      expect(horseIds).not.toContain(otherHorse.id);

      // Transactions: the subject's seeded txn is present
      const txnDescriptions = data.transactions.map(t => t.description);
      expect(txnDescriptions).toContain(`TestFixture-GdprExportTxn_${ts}`);

      // No record anywhere in the export references the other user's id
      const serialized = JSON.stringify(data);
      expect(serialized).not.toContain(other.user.id);
    }, 120000);

    it('rejects an unauthenticated export request (401)', async () => {
      // No CSRF pair needed: the authRouter mounts authenticateToken BEFORE
      // csrfProtection (backend/app/routers.mjs), so a credential-less
      // request is 401'd by authenticateToken before CSRF ever runs (and
      // GET is CSRF-exempt anyway).
      const res = await request(app).get('/api/v1/account/export').set('Origin', ORIGIN);
      expect(res.status).toBe(401);
    }, 120000);
  });

  // Equoria-gfany: players cannot delete their accounts, so POST
  // /api/v1/account/delete is closed (locked by
  // accountDeletionClosed.integration.test.mjs) and its wrong-/no-password
  // cases were retired with it. The erasure cascade is kept for operator-run
  // erasure, so this case now drives `eraseUserAccount()` directly with every
  // original assertion on the erased graph.
  describe('eraseUserAccount() — Right to Erasure (operator-run)', () => {
    it('deletes the user + owned data, is idempotent, and blocks future login', async () => {
      const ts = randomBytes(8).toString('hex');
      const subject = await createTestUser({
        username: `TestFixture_gdprdel_${ts}`,
        email: `testfixture_gdprdel_${ts}@test.com`,
        password: PASSWORD,
      });
      ids.users.push(subject.user.id);

      // Seed owned + related data across multiple relation classes.
      // (createTestHorse spreads fixtureColor() internally — no raw
      // NULL-phenotype horse create; CONTRIBUTING.md Equoria-dm1i.)
      const horse = await createTestHorse({
        name: `TestFixture-GdprDelHorse_${ts}`,
        userId: subject.user.id,
      });
      ids.horses.push(horse.id);
      const txn = await prisma.userTransaction.create({
        data: {
          userId: subject.user.id,
          type: 'credit',
          amount: 99,
          category: 'test_fixture',
          description: `TestFixture-GdprDelTxn_${ts}`,
        },
      });
      ids.transactions.push(txn.id);
      const notif = await prisma.notification.create({
        data: {
          userId: subject.user.id,
          type: 'system',
          payload: { title: `TestFixture-GdprDelNotif_${ts}`, message: 'gdpr delete test' },
        },
      });
      ids.notifications.push(notif.id);

      // Seed across the FK-ordered cascade branches so the deletion path
      // (clubs led, forum, messages, grooms/riders/trainers) is actually
      // exercised — not just the simple horse/txn/notification path.
      const groom = await prisma.groom.create({
        data: {
          name: `TestFixture-GdprDelGroom_${ts}`,
          speciality: 'foal_care',
          personality: 'gentle',
          userId: subject.user.id,
        },
      });
      ids.grooms.push(groom.id);
      const rider = await prisma.rider.create({
        data: {
          firstName: 'Gdpr',
          lastName: `Rider_${ts}`,
          personality: 'methodical',
          skillLevel: 'rookie',
          speciality: 'Racing',
          userId: subject.user.id,
        },
      });
      ids.riders.push(rider.id);
      const trainer = await prisma.trainer.create({
        data: {
          firstName: 'Gdpr',
          lastName: `Trainer_${ts}`,
          personality: 'focused',
          skillLevel: 'novice',
          speciality: 'Dressage',
          userId: subject.user.id,
        },
      });
      ids.trainers.push(trainer.id);
      // A second user to be the message counterparty (must NOT be deleted).
      const peer = await createTestUser({
        username: `TestFixture_gdprpeer_${ts}`,
        email: `testfixture_gdprpeer_${ts}@test.com`,
        password: PASSWORD,
      });
      ids.users.push(peer.user.id);
      const msg = await prisma.directMessage.create({
        data: {
          senderId: subject.user.id,
          recipientId: peer.user.id,
          subject: `TestFixture-GdprDelMsg_${ts}`,
          content: 'gdpr delete message',
        },
      });
      ids.messages.push(msg.id);
      const thread = await prisma.forumThread.create({
        data: {
          section: 'general',
          title: `TestFixture-GdprDelThread_${ts}`,
          authorId: subject.user.id,
          tags: [],
        },
      });
      ids.threads.push(thread.id);
      const post = await prisma.forumPost.create({
        data: {
          threadId: thread.id,
          authorId: subject.user.id,
          content: 'gdpr delete post',
        },
      });
      ids.posts.push(post.id);
      // A club the subject leads — deletion must cascade it without
      // blocking on the leader FK.
      const club = await prisma.club.create({
        data: {
          name: `TestFixture-GdprDelClub_${ts}`,
          type: 'discipline',
          category: 'Racing',
          description: 'gdpr delete club',
          leaderId: subject.user.id,
        },
      });
      ids.clubs.push(club.id);
      const membership = await prisma.clubMembership.create({
        data: { clubId: club.id, userId: subject.user.id, role: 'president' },
      });
      ids.memberships.push(membership.id);

      // Non-vacuousness proof for the post-delete login assertion below:
      // the same credentials MUST authenticate while the account is live.
      // Without this, a 401 after deletion could equally be caused by an
      // email-normalization mismatch (login's normalizeEmail() lowercases
      // the submitted email) and the test would pass for the wrong reason.
      const preDeleteLogin = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', ORIGIN)
        .send({ email: `testfixture_gdprdel_${ts}@test.com`, password: PASSWORD });
      expect(preDeleteLogin.status).toBe(200);

      const result = await eraseUserAccount(subject.user.id);
      expect(result).toEqual({ deleted: true });

      // User row is gone
      const gone = await prisma.user.findUnique({
        where: { id: subject.user.id },
      });
      expect(gone).toBeNull();

      // Owned data is gone (PII erasure)
      const horseGone = await prisma.horse.findUnique({ where: { id: horse.id } });
      expect(horseGone).toBeNull();
      const txns = await prisma.userTransaction.findMany({
        where: { userId: subject.user.id },
      });
      expect(txns).toHaveLength(0);
      const notifs = await prisma.notification.findMany({
        where: { userId: subject.user.id },
      });
      expect(notifs).toHaveLength(0);

      // Related-graph erasure: grooms/riders/trainers/messages/forum/club
      expect(await prisma.groom.findUnique({ where: { id: groom.id } })).toBeNull();
      expect(await prisma.rider.findUnique({ where: { id: rider.id } })).toBeNull();
      expect(await prisma.trainer.findUnique({ where: { id: trainer.id } })).toBeNull();
      expect(await prisma.directMessage.findMany({ where: { senderId: subject.user.id } })).toHaveLength(0);
      expect(await prisma.forumThread.findUnique({ where: { id: thread.id } })).toBeNull();
      expect(await prisma.club.findUnique({ where: { id: club.id } })).toBeNull();
      expect(await prisma.clubMembership.findMany({ where: { userId: subject.user.id } })).toHaveLength(0);

      // Counterparty must survive — deletion is strictly scoped to the
      // subject's own userId, never the peer.
      const peerStillThere = await prisma.user.findUnique({
        where: { id: peer.user.id },
      });
      expect(peerStillThere).not.toBeNull();

      // Idempotent: a second erase of the same id is a no-op, not a throw.
      await expect(eraseUserAccount(subject.user.id)).resolves.toEqual({ deleted: false });

      // Deleted user can no longer authenticate. POST /api/v1/auth/login is
      // a PUBLIC route (backend/app/routers.mjs mounts it on publicRouter
      // with no csrfProtection), so no CSRF pair is sent — and the guard
      // below proves the 401 is an auth rejection, not a CSRF artifact.
      const login = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', ORIGIN)
        .send({ email: `testfixture_gdprdel_${ts}@test.com`, password: PASSWORD });
      expect(login.body?.code).not.toBe('INVALID_CSRF_TOKEN');
      expect(login.status).toBe(401);
    }, 120000);
  });
});
