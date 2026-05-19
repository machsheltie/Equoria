/**
 * CWE-639 Wave-5 Sweep — sentinel tests for the wave-4 follow-up triplet.
 *
 * Wave-4 closed Equoria-bik1 (showController.enterShow) and surfaced three
 * adjacent leaks that were filed separately per the non-bundling rule
 * (EDGE_CASE_FIX_DISCIPLINE.md §7). This wave closes those:
 *
 *   - Equoria-y0l4 — messageController.getMessage   (GET  /api/v1/messages/:id)
 *   - Equoria-a3kp — messageController.markRead     (PATCH /api/v1/messages/:id/read)
 *   - Equoria-c4g3 — competitionRoutes POST /execute (POST /api/v1/competition/execute)
 *
 * Each test asserts cross-user access returns 404 (not 403) AND that the
 * response body is byte-identical to the not-exists case. The byte-identical
 * sentinel is what makes these CWE-639 tests rather than just "404 not 403"
 * tests — without byte-identity, response shape differences leak existence.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createMockToken } from '../../../__tests__/factories/index.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

describe('CWE-639 wave-5 sweep (Equoria-9ov8 follow-up triplet)', () => {
  let __csrf__;
  beforeAll(async () => {
    __csrf__ = await fetchCsrf(app);
  }, 120000);

  let userA;
  let userB;
  let tokenA;
  let tokenB;

  const NONEXISTENT_MESSAGE_ID = 999999999;
  const NONEXISTENT_SHOW_ID = 999999999;

  beforeEach(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only-32chars';

    userA = await prisma.user.create({
      data: {
        email: `cwe639w5a-${randomBytes(8).toString('hex')}@example.com`,
        username: `cwe639w5a-${randomBytes(8).toString('hex')}`,
        password: 'hashedPassword123',
        firstName: 'Cwe',
        lastName: 'W5A',
        emailVerified: true,
      },
    });
    userB = await prisma.user.create({
      data: {
        email: `cwe639w5b-${randomBytes(8).toString('hex')}@example.com`,
        username: `cwe639w5b-${randomBytes(8).toString('hex')}`,
        password: 'hashedPassword123',
        firstName: 'Cwe',
        lastName: 'W5B',
        emailVerified: true,
      },
    });

    tokenA = createMockToken(userA.id, {
      payload: { email: userA.email, role: userA.role || 'user' },
    });
    tokenB = createMockToken(userB.id, {
      payload: { email: userB.email, role: userB.role || 'user' },
    });
  });

  afterEach(async () => {
    const ids = [userA?.id, userB?.id].filter(Boolean);
    if (ids.length === 0) {
      return;
    }
    await prisma.directMessage
      .deleteMany({ where: { OR: [{ senderId: { in: ids } }, { recipientId: { in: ids } }] } })
      .catch(() => {});
    await prisma.showEntry.deleteMany({ where: { show: { hostUserId: { in: ids } } } }).catch(() => {});
    await prisma.show.deleteMany({ where: { hostUserId: { in: ids } } }).catch(() => {});
    await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });

  // ─── Equoria-y0l4 ────────────────────────────────────────────────────────
  describe('messageController.getMessage GET /api/v1/messages/:id', () => {
    it('returns 404 for cross-user message with byte-identical response to not-exists', async () => {
      // user B sends to themselves' inbox via sender=A — actually need a
      // message between A and B; the intruder is a third party. Use userA as
      // an unrelated reader of a message between userB and a temp recipient.
      const tempRecipient = await prisma.user.create({
        data: {
          email: `cwe639w5tmp-${randomBytes(8).toString('hex')}@example.com`,
          username: `cwe639w5tmp-${randomBytes(8).toString('hex')}`,
          password: 'hashedPassword123',
          firstName: 'Cwe',
          lastName: 'W5Tmp',
          emailVerified: true,
        },
      });
      try {
        const msg = await prisma.directMessage.create({
          data: {
            senderId: userB.id,
            recipientId: tempRecipient.id,
            subject: 'Private',
            content: 'Not for A',
          },
        });

        // Cross-user case: user A reading a message they neither sent nor received
        const resCrossUser = await request(app)
          .get(`/api/v1/messages/${msg.id}`)
          .set('Authorization', `Bearer ${tokenA}`)
          .set('Origin', 'http://localhost:3000');

        expect(resCrossUser.status).toBe(404);
        expect(resCrossUser.body.success).toBe(false);

        // Not-exists case: user A reading a non-existent message ID
        const resMissing = await request(app)
          .get(`/api/v1/messages/${NONEXISTENT_MESSAGE_ID}`)
          .set('Authorization', `Bearer ${tokenA}`)
          .set('Origin', 'http://localhost:3000');

        expect(resMissing.status).toBe(404);
        // Byte-identical sentinel — divergence enables message ID enumeration.
        expect(resMissing.body).toEqual(resCrossUser.body);

        // Also: confirm the message was NOT auto-marked read (would leak existence).
        const after = await prisma.directMessage.findUnique({ where: { id: msg.id } });
        expect(after.isRead).toBe(false);
      } finally {
        await prisma.directMessage
          .deleteMany({ where: { OR: [{ senderId: tempRecipient.id }, { recipientId: tempRecipient.id }] } })
          .catch(() => {});
        await prisma.user.delete({ where: { id: tempRecipient.id } }).catch(() => {});
      }
    });
  });

  // ─── Equoria-a3kp ────────────────────────────────────────────────────────
  describe('messageController.markRead PATCH /api/v1/messages/:id/read', () => {
    it('returns 404 for non-recipient with byte-identical response to not-exists', async () => {
      // Message from user B to themselves' partner — userA is non-recipient.
      const tempRecipient = await prisma.user.create({
        data: {
          email: `cwe639w5tmp-${randomBytes(8).toString('hex')}@example.com`,
          username: `cwe639w5tmp-${randomBytes(8).toString('hex')}`,
          password: 'hashedPassword123',
          firstName: 'Cwe',
          lastName: 'W5Tmp2',
          emailVerified: true,
        },
      });
      try {
        const msg = await prisma.directMessage.create({
          data: {
            senderId: userB.id,
            recipientId: tempRecipient.id,
            subject: 'Private',
            content: 'Not for A',
            isRead: false,
          },
        });

        // Cross-user case: user A (non-recipient, non-sender) marking read
        const resCrossUser = await request(app)
          .patch(`/api/v1/messages/${msg.id}/read`)
          .set('Authorization', `Bearer ${tokenA}`)
          .set('Origin', 'http://localhost:3000')
          .set('Cookie', __csrf__.cookieHeader)
          .set('X-CSRF-Token', __csrf__.csrfToken);

        expect(resCrossUser.status).toBe(404);
        expect(resCrossUser.body.success).toBe(false);

        // Sender side: even the SENDER is not the recipient — same 404 expected.
        const resSenderTriesMarkRead = await request(app)
          .patch(`/api/v1/messages/${msg.id}/read`)
          .set('Authorization', `Bearer ${tokenB}`)
          .set('Origin', 'http://localhost:3000')
          .set('Cookie', __csrf__.cookieHeader)
          .set('X-CSRF-Token', __csrf__.csrfToken);
        expect(resSenderTriesMarkRead.status).toBe(404);

        // Not-exists case
        const resMissing = await request(app)
          .patch(`/api/v1/messages/${NONEXISTENT_MESSAGE_ID}/read`)
          .set('Authorization', `Bearer ${tokenA}`)
          .set('Origin', 'http://localhost:3000')
          .set('Cookie', __csrf__.cookieHeader)
          .set('X-CSRF-Token', __csrf__.csrfToken);

        expect(resMissing.status).toBe(404);
        // Byte-identical sentinel
        expect(resMissing.body).toEqual(resCrossUser.body);

        // Confirm the message was NOT marked read — non-recipient must not flip state.
        const after = await prisma.directMessage.findUnique({ where: { id: msg.id } });
        expect(after.isRead).toBe(false);
      } finally {
        await prisma.directMessage
          .deleteMany({ where: { OR: [{ senderId: tempRecipient.id }, { recipientId: tempRecipient.id }] } })
          .catch(() => {});
        await prisma.user.delete({ where: { id: tempRecipient.id } }).catch(() => {});
      }
    });
  });

  // ─── Equoria-c4g3 → Equoria-kacla ────────────────────────────────────────
  // POST /api/v1/competition/execute is REMOVED (410 Gone, Equoria-kacla):
  // on-demand execution was the legacy instant-run that contradicted the
  // 7-day deferred model. The original CWE-639 concern (a scoped host-only
  // DB lookup whose 404 must be byte-identical for non-host vs not-exists to
  // prevent show-ID enumeration) is now MOOT — the endpoint performs NO DB
  // lookup at all and returns an unconditional, caller-independent,
  // show-existence-independent 410. That is strictly stronger than the prior
  // byte-identical-404 guarantee. Migrated (not skipped — CLAUDE.md / nx8t1
  // precedent) to lock in the no-enumeration property under the new
  // behaviour.
  describe('competitionRoutes POST /api/v1/competition/execute (removed — 410 Gone)', () => {
    it('returns an identical 410 for non-host vs non-existent show (no enumeration surface)', async () => {
      // Show hosted by user B — user A is non-host.
      const show = await prisma.show.create({
        data: {
          name: `CweShowW5-${randomBytes(8).toString('hex')}`,
          discipline: 'Dressage',
          levelMin: 1,
          levelMax: 10,
          entryFee: 0,
          prize: 100,
          runDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          hostUserId: userB.id,
          status: 'open',
        },
      });

      // Cross-user (non-host) case: user A "executing" user B's show.
      const resCrossUser = await request(app)
        .post('/api/v1/competition/execute')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ showId: show.id });

      expect(resCrossUser.status).toBe(410);
      expect(resCrossUser.body.success).toBe(false);

      // Not-exists case: user A "executing" a non-existent show.
      const resMissing = await request(app)
        .post('/api/v1/competition/execute')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Origin', 'http://localhost:3000')
        .set('Cookie', __csrf__.cookieHeader)
        .set('X-CSRF-Token', __csrf__.csrfToken)
        .send({ showId: NONEXISTENT_SHOW_ID });

      expect(resMissing.status).toBe(410);
      // Byte-identical sentinel — the 410 must not leak whether the show
      // exists or who the caller is (no enumeration surface at all).
      expect(resMissing.body).toEqual(resCrossUser.body);
    });
  });
});
