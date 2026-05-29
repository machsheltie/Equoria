/**
 * gdprAccountRoutes.integration.test.mjs
 *
 * Equoria-s3rf — GDPR Right-to-Access (data export) + Right-to-Erasure
 * (account deletion) endpoints.
 *
 * Real-DB integration test — NO mocks. Exercises the live Express app,
 * real auth/CSRF middleware, and the canonical Equoria DB.
 *
 * CRITICAL SAFETY: every fixture user/horse is created via the tracked
 * test helpers (createTestUser / createTestHorse) so cleanup is id-scoped.
 * The deletion endpoint under test is itself scoped strictly to the
 * authenticated user's own userId — these tests only ever delete
 * throwaway fixture accounts, never a where-clause that could match a
 * real user.
 *
 * AC coverage:
 *   1. GET /api/v1/account/export returns the caller's own personal data
 *      (profile, horses, transactions) and NOTHING belonging to other users.
 *   2. Export is self-only — there is no path param, so a token only ever
 *      yields its own data (cross-user access is structurally impossible);
 *      an unauthenticated request is rejected (401).
 *   3. POST /api/v1/account/delete requires the correct password in the
 *      body; a wrong/absent password is rejected (400/401) and the account
 *      survives.
 *   4. A correct-password delete removes the user's PII + owned data and
 *      is idempotent (second call → 404, not a 500).
 *   5. A deleted user can no longer authenticate (login → 401).
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, createTestHorse, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

const PASSWORD = 'TestPassword123!';

describe('INTEGRATION: GDPR account export/delete (Equoria-s3rf)', () => {
  let csrf;

  beforeAll(async () => {
    csrf = await fetchCsrf(app);
  }, 120000);

  afterAll(async () => {
    // id-scoped cleanup of any fixtures that survived (deletes only tracked ids)
    await cleanupTestData();
  }, 120000);

  describe('GET /api/v1/account/export — Right to Access', () => {
    it('returns the caller own profile + horses and excludes other users data', async () => {
      const ts = Date.now();
      const subject = await createTestUser({
        username: `gdpr_export_${ts}`,
        email: `gdpr_export_${ts}@test.com`,
        password: PASSWORD,
      });
      const other = await createTestUser({
        username: `gdpr_other_${ts}`,
        email: `gdpr_other_${ts}@test.com`,
        password: PASSWORD,
      });

      const subjectHorse = await createTestHorse({
        name: `GdprSubjectHorse_${ts}`,
        userId: subject.user.id,
      });
      const otherHorse = await createTestHorse({
        name: `GdprOtherHorse_${ts}`,
        userId: other.user.id,
      });

      // Give the subject a transaction so the export proves it includes it.
      await prisma.userTransaction.create({
        data: {
          userId: subject.user.id,
          type: 'credit',
          amount: 250,
          category: 'test_fixture',
          description: `GdprExportTxn_${ts}`,
        },
      });

      const res = await request(app)
        .get('/api/v1/account/export')
        .set('Authorization', `Bearer ${subject.token}`)
        .set('Origin', 'http://localhost:3000');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data).toBeTruthy();

      // Profile is the subject's, password is NOT exported
      expect(data.profile.id).toBe(subject.user.id);
      expect(data.profile.email).toBe(`gdpr_export_${ts}@test.com`);
      expect(data.profile.password).toBeUndefined();

      // Horses: subject's horse present, other user's horse absent
      const horseIds = data.horses.map(h => h.id);
      expect(horseIds).toContain(subjectHorse.id);
      expect(horseIds).not.toContain(otherHorse.id);

      // Transactions: the subject's seeded txn is present
      const txnDescriptions = data.transactions.map(t => t.description);
      expect(txnDescriptions).toContain(`GdprExportTxn_${ts}`);

      // No record anywhere in the export references the other user's id
      const serialized = JSON.stringify(data);
      expect(serialized).not.toContain(other.user.id);
    });

    it('rejects an unauthenticated export request (401)', async () => {
      const res = await request(app).get('/api/v1/account/export').set('Origin', 'http://localhost:3000');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/account/delete — Right to Erasure', () => {
    it('rejects a delete with a wrong password and keeps the account', async () => {
      const ts = Date.now();
      const subject = await createTestUser({
        username: `gdpr_delwrong_${ts}`,
        email: `gdpr_delwrong_${ts}@test.com`,
        password: PASSWORD,
      });

      const res = await request(app)
        .post('/api/v1/account/delete')
        .set('Authorization', `Bearer ${subject.token}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ password: 'WrongPassword999!' });

      expect([400, 401]).toContain(res.status);
      expect(res.body.success).toBe(false);

      // Account must still exist
      const stillThere = await prisma.user.findUnique({
        where: { id: subject.user.id },
      });
      expect(stillThere).not.toBeNull();
    });

    it('rejects a delete with no password in the body (400)', async () => {
      const ts = Date.now();
      const subject = await createTestUser({
        username: `gdpr_delnopw_${ts}`,
        email: `gdpr_delnopw_${ts}@test.com`,
        password: PASSWORD,
      });

      const res = await request(app)
        .post('/api/v1/account/delete')
        .set('Authorization', `Bearer ${subject.token}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);

      const stillThere = await prisma.user.findUnique({
        where: { id: subject.user.id },
      });
      expect(stillThere).not.toBeNull();
    });

    it('deletes the user + owned data with the correct password, is idempotent, and blocks future login', async () => {
      const ts = Date.now();
      const subject = await createTestUser({
        username: `gdpr_delok_${ts}`,
        email: `gdpr_delok_${ts}@test.com`,
        password: PASSWORD,
      });

      // Seed owned + related data across multiple relation classes
      const horse = await createTestHorse({
        name: `GdprDelHorse_${ts}`,
        userId: subject.user.id,
      });
      await prisma.userTransaction.create({
        data: {
          userId: subject.user.id,
          type: 'credit',
          amount: 99,
          category: 'test_fixture',
          description: `GdprDelTxn_${ts}`,
        },
      });
      await prisma.notification.create({
        data: {
          userId: subject.user.id,
          type: 'system',
          payload: { title: `GdprDelNotif_${ts}`, message: 'gdpr delete test' },
        },
      });

      // Seed across the FK-ordered cascade branches so the deletion path
      // (clubs led, forum, messages, grooms/riders/trainers) is actually
      // exercised — not just the simple horse/txn/notification path.
      const groom = await prisma.groom.create({
        data: {
          name: `GdprDelGroom_${ts}`,
          speciality: 'foal_care',
          personality: 'gentle',
          userId: subject.user.id,
        },
      });
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
      // A second user to be the message counterparty (must NOT be deleted).
      const peer = await createTestUser({
        username: `gdpr_peer_${ts}`,
        email: `gdpr_peer_${ts}@test.com`,
        password: PASSWORD,
      });
      await prisma.directMessage.create({
        data: {
          senderId: subject.user.id,
          recipientId: peer.user.id,
          subject: `GdprDelMsg_${ts}`,
          content: 'gdpr delete message',
        },
      });
      const thread = await prisma.forumThread.create({
        data: {
          section: 'general',
          title: `GdprDelThread_${ts}`,
          authorId: subject.user.id,
          tags: [],
        },
      });
      await prisma.forumPost.create({
        data: {
          threadId: thread.id,
          authorId: subject.user.id,
          content: 'gdpr delete post',
        },
      });
      // A club the subject leads — deletion must cascade it without
      // blocking on the leader FK.
      const club = await prisma.club.create({
        data: {
          name: `GdprDelClub_${ts}`,
          type: 'discipline',
          category: 'Racing',
          description: 'gdpr delete club',
          leaderId: subject.user.id,
        },
      });
      await prisma.clubMembership.create({
        data: { clubId: club.id, userId: subject.user.id, role: 'president' },
      });

      const res = await request(app)
        .post('/api/v1/account/delete')
        .set('Authorization', `Bearer ${subject.token}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ password: PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

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

      // Idempotent: a second delete with the now-invalid token must not 500.
      const res2 = await request(app)
        .post('/api/v1/account/delete')
        .set('Authorization', `Bearer ${subject.token}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ password: PASSWORD });
      expect([401, 404]).toContain(res2.status);
      expect(res2.status).not.toBe(500);

      // Deleted user can no longer authenticate
      const login = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({ email: `gdpr_delok_${ts}@test.com`, password: PASSWORD });
      expect(login.status).toBe(401);
    });
  });
});
