/**
 * legacyUserDelete.integration.test.mjs
 *
 * Equoria-02nos — Legacy DELETE /api/v1/users/:id is broken on the
 * canonical DB: backend/models/userModel.mjs deleteUser() did a bare
 * prisma.user.delete({ where: { id } }) with no related-record cleanup,
 * so for any non-empty account it failed with a Prisma FK Restrict
 * violation (P2003) and the route 500'd.
 *
 * Fix: deleteUser() now delegates to the proven, scoped, transactional
 * gdprAccountService.eraseUserAccount() cascade (DRY — same logic the
 * GDPR right-to-erasure endpoint uses). This route is self-scoped
 * (requireSelfAccess enforces req.user.id === :id) so its contract
 * matches eraseUserAccount's self-only contract exactly.
 *
 * Real-DB integration test — NO mocks. Exercises the live Express app,
 * real auth/CSRF middleware, and the canonical Equoria DB.
 *
 * CRITICAL SAFETY: every fixture user/horse is created via the tracked
 * test helpers (createTestUser / createTestHorse) whose cleanup is
 * strictly id-scoped (where: { id: { in: trackedIds } } — never a broad
 * deleteMany, never a where-clause that could match a real user). The
 * route under test is itself scoped strictly to the authenticated
 * fixture user's own id. These tests only ever delete throwaway fixture
 * accounts.
 *
 * AC coverage:
 *   1. RED sentinel: a fixture user WITH related rows (horse, txn,
 *      notification, groom, rider, trainer, message, forum, club)
 *      deleted via the legacy route must NOT 500 (pre-fix: P2003 → 500).
 *   2. After the fix the user + owned data are gone (FK-safe cascade)
 *      and the message counterparty (a different user) survives.
 *   3. Idempotent: a second delete does not 500 (404, not crash).
 *   4. Authz: a non-self caller is rejected (403); unauthenticated 401.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../db/index.mjs';
import { createTestUser, createTestHorse, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

const PASSWORD = 'TestPassword123!';
const ORIGIN = 'http://localhost:3000';

describe('INTEGRATION: legacy DELETE /api/v1/users/:id (Equoria-02nos)', () => {
  let csrf;

  beforeAll(async () => {
    csrf = await fetchCsrf(app);
  }, 120000);

  afterAll(async () => {
    // id-scoped cleanup of any fixtures that survived (deletes only
    // tracked fixture ids — never a broad/real-user-matching where).
    await cleanupTestData();
  }, 120000);

  it('deletes a fixture user WITH related rows without a P2003/500 (FK-safe cascade), idempotently', async () => {
    const ts = randomBytes(8).toString('hex');
    const subject = await createTestUser({
      username: `TestFixture_legacydel_${ts}`,
      email: `TestFixture_legacydel_${ts}@test.com`,
      password: PASSWORD,
    });

    // Seed owned + related data across multiple FK-Restrict relation
    // classes so the bare prisma.user.delete WOULD fail P2003 pre-fix.
    const horse = await createTestHorse({
      name: `TestFixture-LegacyDelHorse_${ts}`,
      userId: subject.user.id,
    });
    await prisma.userTransaction.create({
      data: {
        userId: subject.user.id,
        type: 'credit',
        amount: 77,
        category: 'test_fixture',
        description: `TestFixture-LegacyDelTxn_${ts}`,
      },
    });
    await prisma.notification.create({
      data: {
        userId: subject.user.id,
        type: 'system',
        payload: { title: `TestFixture-LegacyDelNotif_${ts}`, message: 'legacy delete test' },
      },
    });
    const groom = await prisma.groom.create({
      data: {
        name: `TestFixture-LegacyDelGroom_${ts}`,
        speciality: 'foal_care',
        personality: 'gentle',
        userId: subject.user.id,
      },
    });
    const rider = await prisma.rider.create({
      data: {
        firstName: 'Legacy',
        lastName: `Rider_${ts}`,
        personality: 'methodical',
        skillLevel: 'rookie',
        speciality: 'Racing',
        userId: subject.user.id,
      },
    });
    const trainer = await prisma.trainer.create({
      data: {
        firstName: 'Legacy',
        lastName: `Trainer_${ts}`,
        personality: 'focused',
        skillLevel: 'novice',
        speciality: 'Dressage',
        userId: subject.user.id,
      },
    });
    // A second fixture user as the message counterparty — must NOT be
    // deleted (scope-safety assertion).
    const peer = await createTestUser({
      username: `TestFixture_legacypeer_${ts}`,
      email: `TestFixture_legacypeer_${ts}@test.com`,
      password: PASSWORD,
    });
    await prisma.directMessage.create({
      data: {
        senderId: subject.user.id,
        recipientId: peer.user.id,
        subject: `TestFixture-LegacyDelMsg_${ts}`,
        content: 'legacy delete message',
      },
    });
    const thread = await prisma.forumThread.create({
      data: {
        section: 'general',
        title: `TestFixture-LegacyDelThread_${ts}`,
        authorId: subject.user.id,
        tags: [],
      },
    });
    await prisma.forumPost.create({
      data: {
        threadId: thread.id,
        authorId: subject.user.id,
        content: 'legacy delete post',
      },
    });
    const club = await prisma.club.create({
      data: {
        name: `TestFixture-LegacyDelClub_${ts}`,
        type: 'discipline',
        category: 'Racing',
        description: 'legacy delete club',
        leaderId: subject.user.id,
      },
    });
    await prisma.clubMembership.create({
      data: { clubId: club.id, userId: subject.user.id, role: 'president' },
    });

    // ── RED sentinel: pre-fix this returns 500 (P2003 FK Restrict) ──
    const res = await request(app)
      .delete(`/api/v1/users/${subject.user.id}`)
      .set('Authorization', `Bearer ${subject.token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).not.toBe(500);
    expect([200, 204]).toContain(res.status);

    // User + owned graph gone (FK-safe cascade)
    expect(await prisma.user.findUnique({ where: { id: subject.user.id } })).toBeNull();
    expect(await prisma.horse.findUnique({ where: { id: horse.id } })).toBeNull();
    expect(await prisma.userTransaction.findMany({ where: { userId: subject.user.id } })).toHaveLength(0);
    expect(await prisma.notification.findMany({ where: { userId: subject.user.id } })).toHaveLength(0);
    expect(await prisma.groom.findUnique({ where: { id: groom.id } })).toBeNull();
    expect(await prisma.rider.findUnique({ where: { id: rider.id } })).toBeNull();
    expect(await prisma.trainer.findUnique({ where: { id: trainer.id } })).toBeNull();
    expect(await prisma.directMessage.findMany({ where: { senderId: subject.user.id } })).toHaveLength(0);
    expect(await prisma.forumThread.findUnique({ where: { id: thread.id } })).toBeNull();
    expect(await prisma.club.findUnique({ where: { id: club.id } })).toBeNull();

    // Counterparty survives — deletion strictly scoped to subject.user.id
    expect(await prisma.user.findUnique({ where: { id: peer.user.id } })).not.toBeNull();

    // Idempotent: second delete must not 500 (404, not crash)
    const res2 = await request(app)
      .delete(`/api/v1/users/${subject.user.id}`)
      .set('Authorization', `Bearer ${subject.token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);
    expect(res2.status).not.toBe(500);
    expect([401, 404]).toContain(res2.status);
  }, 120000);

  it('rejects a non-self caller with 403 and leaves the target intact', async () => {
    const ts = randomBytes(8).toString('hex');
    const attacker = await createTestUser({
      username: `TestFixture_legacyatk_${ts}`,
      email: `TestFixture_legacyatk_${ts}@test.com`,
      password: PASSWORD,
    });
    const victim = await createTestUser({
      username: `TestFixture_legacyvic_${ts}`,
      email: `TestFixture_legacyvic_${ts}@test.com`,
      password: PASSWORD,
    });

    const res = await request(app)
      .delete(`/api/v1/users/${victim.user.id}`)
      .set('Authorization', `Bearer ${attacker.token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(403);
    // Victim untouched — authz boundary held before any DB work
    expect(await prisma.user.findUnique({ where: { id: victim.user.id } })).not.toBeNull();
  }, 120000);

  it('rejects an unauthenticated delete with 401', async () => {
    const ts = randomBytes(8).toString('hex');
    const target = await createTestUser({
      username: `TestFixture_legacyanon_${ts}`,
      email: `TestFixture_legacyanon_${ts}@test.com`,
      password: PASSWORD,
    });

    const res = await request(app)
      .delete(`/api/v1/users/${target.user.id}`)
      .set('Origin', ORIGIN)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken);

    expect(res.status).toBe(401);
    expect(await prisma.user.findUnique({ where: { id: target.user.id } })).not.toBeNull();
  }, 120000);
});
