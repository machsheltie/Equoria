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
 * Equoria-fefh2.16 / Equoria-lax36 — CSRF binding fix: per-user CSRF
 * binding (Equoria-plw0h, backend/middleware/csrf.mjs) derives the
 * sessionIdentifier as req.user.id when the request is authenticated.
 * The authRouter mounts authenticateToken BEFORE csrfProtection
 * (backend/app/routers.mjs — authRouter.use(authenticateToken) then
 * authRouter.use(csrfProtection)), so by the time csrfProtection runs on
 * an authenticated mutation, req.user.id is populated and the CSRF token
 * MUST have been issued under that same user id. An anonymous token
 * (bound to the CSRF_SESSION_SALT fallback) correctly 403s — that is the
 * middleware doing its job, so every authenticated mutation in this
 * suite fetches its CSRF token bound to the acting identity by
 * forwarding that identity's accessToken cookie to GET /auth/csrf-token
 * (fetchCsrf's extraCookies option → tryPopulateUserFromAccessCookie
 * binds issuance to the decoded user id).
 *
 * Auth source precedence (backend/middleware/auth.mjs): authenticateToken
 * reads req.cookies.accessToken FIRST (primary), then falls back to the
 * Authorization: Bearer header. The mutations below send the SAME JWT in
 * both places (the accessToken cookie rides along in csrf.cookieHeader),
 * so whichever source the middleware picks, the resolved identity — and
 * therefore the CSRF sessionIdentifier — is identical.
 *
 * Real-DB integration test — NO mocks. Exercises the live Express app,
 * real auth/CSRF middleware, and the canonical Equoria DB.
 *
 * CRITICAL SAFETY: every fixture row's id is tracked the moment it is
 * created, and cleanup is FAIL-LOUD (createCleanupTracker — a failed
 * delete throws in afterAll instead of console.warn'ing the leak away)
 * and FK-ORDERED (children before parents: membership → club → posts →
 * threads → messages → staff → notifications → transactions → horses →
 * users). Every delete is strictly id-scoped
 * (where: { id: { in: trackedIds } }) — never a broad deleteMany, never
 * a where-clause that could match a real user. The route under test is
 * itself scoped strictly to the authenticated fixture user's own id.
 *
 * AC coverage:
 *   1. RED sentinel: a fixture user WITH related rows (horse, txn,
 *      notification, groom, rider, trainer, message, forum, club)
 *      deleted via the legacy route must NOT 500 (pre-fix: P2003 → 500).
 *   2. After the fix the user + owned data are gone (FK-safe cascade)
 *      and the message counterparty (a different user) survives.
 *   3. Idempotent: a second delete does not 500 (404, not crash).
 *   4. Authz: a non-self caller is rejected 403 BY requireSelfAccess
 *      (asserted on the ownership body, NOT the CSRF body — the caller
 *      presents a valid attacker-bound CSRF pair so a CSRF 403 cannot
 *      masquerade as an ownership 403); unauthenticated 401.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, createTestHorse } from '../../../tests/helpers/testAuth.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const PASSWORD = 'TestPassword123!';
const ORIGIN = 'http://localhost:3000';

/**
 * Fetch a CSRF token bound to a specific authenticated identity.
 * Forwards the identity's JWT as an accessToken cookie on the token GET so
 * csrf.mjs#tryPopulateUserFromAccessCookie resolves the issuance
 * sessionIdentifier to that user's id — matching what authenticateToken →
 * csrfProtection will resolve on the subsequent mutation (Equoria-plw0h).
 */
const fetchCsrfFor = token => fetchCsrf(app, { extraCookies: [`accessToken=${token}`] });

describe('INTEGRATION: legacy DELETE /api/v1/users/:id (Equoria-02nos)', () => {
  const cleanup = createCleanupTracker();

  // Per-model fixture id ledgers. Every prisma create below pushes its id
  // here IMMEDIATELY so a mid-test failure still leaves a complete ledger
  // for the FK-ordered afterAll cleanup.
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
    // order (children before parents). When the route under test succeeds,
    // its cascade has already removed the subject's rows and these deletes
    // are no-ops; when it regresses, this is what prevents the fixture
    // graph from leaking into the canonical DB (the previous generic
    // cleanup swallowed the ClubMembership_userId_fkey RESTRICT error and
    // leaked the user).
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

  it('deletes a fixture user WITH related rows without a P2003/500 (FK-safe cascade), idempotently', async () => {
    const ts = randomBytes(8).toString('hex');
    const subject = await createTestUser({
      username: `TestFixture_legacydel_${ts}`,
      email: `TestFixture_legacydel_${ts}@test.com`,
      password: PASSWORD,
    });
    ids.users.push(subject.user.id);

    // Seed owned + related data across multiple FK-Restrict relation
    // classes so the bare prisma.user.delete WOULD fail P2003 pre-fix.
    // (createTestHorse spreads fixtureColor() internally — no raw
    // NULL-phenotype horse create; CONTRIBUTING.md Equoria-dm1i.)
    const horse = await createTestHorse({
      name: `TestFixture-LegacyDelHorse_${ts}`,
      userId: subject.user.id,
    });
    ids.horses.push(horse.id);
    const txn = await prisma.userTransaction.create({
      data: {
        userId: subject.user.id,
        type: 'credit',
        amount: 77,
        category: 'test_fixture',
        description: `TestFixture-LegacyDelTxn_${ts}`,
      },
    });
    ids.transactions.push(txn.id);
    const notif = await prisma.notification.create({
      data: {
        userId: subject.user.id,
        type: 'system',
        payload: { title: `TestFixture-LegacyDelNotif_${ts}`, message: 'legacy delete test' },
      },
    });
    ids.notifications.push(notif.id);
    const groom = await prisma.groom.create({
      data: {
        name: `TestFixture-LegacyDelGroom_${ts}`,
        speciality: 'foal_care',
        personality: 'gentle',
        userId: subject.user.id,
      },
    });
    ids.grooms.push(groom.id);
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
    ids.riders.push(rider.id);
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
    ids.trainers.push(trainer.id);
    // A second fixture user as the message counterparty — must NOT be
    // deleted (scope-safety assertion).
    const peer = await createTestUser({
      username: `TestFixture_legacypeer_${ts}`,
      email: `TestFixture_legacypeer_${ts}@test.com`,
      password: PASSWORD,
    });
    ids.users.push(peer.user.id);
    const msg = await prisma.directMessage.create({
      data: {
        senderId: subject.user.id,
        recipientId: peer.user.id,
        subject: `TestFixture-LegacyDelMsg_${ts}`,
        content: 'legacy delete message',
      },
    });
    ids.messages.push(msg.id);
    const thread = await prisma.forumThread.create({
      data: {
        section: 'general',
        title: `TestFixture-LegacyDelThread_${ts}`,
        authorId: subject.user.id,
        tags: [],
      },
    });
    ids.threads.push(thread.id);
    const post = await prisma.forumPost.create({
      data: {
        threadId: thread.id,
        authorId: subject.user.id,
        content: 'legacy delete post',
      },
    });
    ids.posts.push(post.id);
    const club = await prisma.club.create({
      data: {
        name: `TestFixture-LegacyDelClub_${ts}`,
        type: 'discipline',
        category: 'Racing',
        description: 'legacy delete club',
        leaderId: subject.user.id,
      },
    });
    ids.clubs.push(club.id);
    const membership = await prisma.clubMembership.create({
      data: { clubId: club.id, userId: subject.user.id, role: 'president' },
    });
    ids.memberships.push(membership.id);

    // CSRF bound to the SUBJECT's identity (issued after the subject's
    // token exists) — the salt-bound anonymous token this suite previously
    // reused is correctly rejected by per-user binding (Equoria-plw0h).
    const subjectCsrf = await fetchCsrfFor(subject.token);

    // ── RED sentinel: pre-fix this returns 500 (P2003 FK Restrict) ──
    const res = await request(app)
      .delete(`/api/v1/users/${subject.user.id}`)
      .set('Authorization', `Bearer ${subject.token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', subjectCsrf.cookieHeader)
      .set('X-CSRF-Token', subjectCsrf.csrfToken);

    // Guard against the wrong-reason failure this suite used to have: a
    // CSRF rejection must surface as a CSRF defect, not be folded into the
    // route assertion below.
    expect(res.body?.code).not.toBe('INVALID_CSRF_TOKEN');
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

    // Idempotent: second delete must not 500 (404, not crash). The JWT is
    // still cryptographically valid and the CSRF token is still bound to
    // the (now-deleted) subject id, so the request reaches the controller
    // (404) unless auth rejects the dangling identity first (401) — both
    // are acceptable "no crash" outcomes.
    const res2 = await request(app)
      .delete(`/api/v1/users/${subject.user.id}`)
      .set('Authorization', `Bearer ${subject.token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', subjectCsrf.cookieHeader)
      .set('X-CSRF-Token', subjectCsrf.csrfToken);
    expect(res2.status).not.toBe(500);
    expect([401, 404]).toContain(res2.status);
  }, 120000);

  it('rejects a non-self caller with 403 from requireSelfAccess (not CSRF) and leaves the target intact', async () => {
    const ts = randomBytes(8).toString('hex');
    const attacker = await createTestUser({
      username: `TestFixture_legacyatk_${ts}`,
      email: `TestFixture_legacyatk_${ts}@test.com`,
      password: PASSWORD,
    });
    ids.users.push(attacker.user.id);
    const victim = await createTestUser({
      username: `TestFixture_legacyvic_${ts}`,
      email: `TestFixture_legacyvic_${ts}@test.com`,
      password: PASSWORD,
    });
    ids.users.push(victim.user.id);

    // CSRF bound to the ATTACKER (the acting identity). This makes the
    // request fully valid through authenticateToken AND csrfProtection, so
    // the only middleware that can 403 it is requireSelfAccess — the
    // boundary this test exists to prove.
    const attackerCsrf = await fetchCsrfFor(attacker.token);

    const res = await request(app)
      .delete(`/api/v1/users/${victim.user.id}`)
      .set('Authorization', `Bearer ${attacker.token}`)
      .set('Origin', ORIGIN)
      .set('Cookie', attackerCsrf.cookieHeader)
      .set('X-CSRF-Token', attackerCsrf.csrfToken);

    expect(res.status).toBe(403);
    // Distinguish the rejecting middleware: csrfErrorHandler's body carries
    // code INVALID_CSRF_TOKEN (backend/middleware/csrf.mjs); requireSelfAccess
    // returns this exact ownership message with no code field
    // (backend/modules/users/routes/userRoutes.mjs). Without this, a CSRF
    // 403 would let an ownership-bypass regression pass unnoticed — which is
    // exactly how this test passed-for-the-wrong-reason before the fix.
    expect(res.body.code).not.toBe('INVALID_CSRF_TOKEN');
    expect(res.body.message).toBe('You can only access your own user data');
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
    ids.users.push(target.user.id);

    // No CSRF pair needed: the authRouter mounts authenticateToken BEFORE
    // csrfProtection (backend/app/routers.mjs), so a credential-less request
    // is 401'd by authenticateToken before CSRF validation ever runs.
    const res = await request(app).delete(`/api/v1/users/${target.user.id}`).set('Origin', ORIGIN);

    expect(res.status).toBe(401);
    expect(await prisma.user.findUnique({ where: { id: target.user.id } })).not.toBeNull();
  }, 120000);
});
