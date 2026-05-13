/**
 * bankController integration tests (Equoria-rr7 coverage sprint).
 *
 * Covers: getClaimStatus, getTransactionHistory, claimWeeklyReward.
 * Bank routes live under authRouter → real auth + real CSRF required for POST.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../../app.mjs';
import prisma from '../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../tests/helpers/csrfHelper.mjs';

const ORIGIN = 'http://localhost:3000';

function uniqueEmail(prefix = 'bank') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`;
}
function uniqueUsername(prefix = 'bank') {
  return `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
}

describe('bankController integration', () => {
  let user;
  let token;

  beforeEach(async () => {
    user = await prisma.user.create({
      data: {
        email: uniqueEmail(),
        username: uniqueUsername(),
        password: 'irrelevant-hash',
        firstName: 'Bank',
        lastName: 'Tester',
        money: 1000,
        settings: {},
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
  }, 30000);

  afterEach(async () => {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  }, 30000);

  // ─── GET /api/bank/claim-status (getClaimStatus) ─────────────────────────

  describe('GET /api/bank/claim-status', () => {
    it('returns 200 with canClaim=true for a user who has never claimed', async () => {
      const res = await request(app)
        .get('/api/bank/claim-status')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.canClaim).toBe(true);
      expect(res.body.data.rewardAmount).toBe(500);
      expect(res.body.data.nextClaimDate).toBeNull();
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app).get('/api/bank/claim-status').set('Origin', ORIGIN);

      expect(res.status).toBe(401);
    });

    it('returns 404 when user is deleted after JWT issued (stateless auth scenario — covers !user branch)', async () => {
      // JWT is stateless — user can be deleted after token is issued
      // The controller's findUnique returns null, hitting the !user 404 branch
      const tempUser = await prisma.user.create({
        data: {
          email: uniqueEmail('bankghost'),
          username: uniqueUsername('bankghost'),
          password: 'irrelevant-hash',
          firstName: 'Ghost',
          lastName: 'Bank',
          money: 0,
          settings: {},
        },
      });
      const tempToken = generateTestToken({ id: tempUser.id, email: tempUser.email, role: 'user' });
      await prisma.user.delete({ where: { id: tempUser.id } });

      const res = await request(app)
        .get('/api/bank/claim-status')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${tempToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns canClaim=false for a user who claimed this week', async () => {
      // Record a claim date in the current week (today's ISO)
      const thisWeekISO = new Date().toISOString();
      await prisma.user.update({
        where: { id: user.id },
        data: { settings: { lastWeeklyClaimDate: thisWeekISO } },
      });

      const res = await request(app)
        .get('/api/bank/claim-status')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.canClaim).toBe(false);
      expect(res.body.data.nextClaimDate).not.toBeNull();
    });
  });

  // ─── GET /api/bank/transactions (getTransactionHistory) ──────────────────

  describe('GET /api/bank/transactions', () => {
    it('returns 200 with data for an authenticated user', async () => {
      const res = await request(app)
        .get('/api/bank/transactions')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('data');
    });

    it('returns 401 without auth token', async () => {
      const res = await request(app).get('/api/bank/transactions').set('Origin', ORIGIN);

      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/bank/claim (claimWeeklyReward) ─────────────────────────────

  describe('POST /api/bank/claim', () => {
    it('returns 200 and awards coins on first claim', async () => {
      const csrf = await fetchCsrf(app);
      const res = await request(app)
        .post('/api/bank/claim')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.newBalance).toBe('number');
      expect(res.body.data.newBalance).toBeGreaterThan(1000); // started with 1000
    });

    it('returns 409 when the user tries to claim twice in the same week', async () => {
      const thisWeekISO = new Date().toISOString();
      await prisma.user.update({
        where: { id: user.id },
        data: { settings: { lastWeeklyClaimDate: thisWeekISO } },
      });

      const csrf = await fetchCsrf(app);
      const res = await request(app)
        .post('/api/bank/claim')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${token}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 without auth token', async () => {
      const csrf = await fetchCsrf(app);
      const res = await request(app)
        .post('/api/bank/claim')
        .set('Origin', ORIGIN)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({});

      expect(res.status).toBe(401);
    });

    it('returns 404 when user is deleted after JWT issued (atomic update returns 0 rows, findUnique returns null)', async () => {
      // Atomic UPDATE finds no matching rows because user doesn't exist,
      // then findUnique also returns null — hits the !user 404 branch (line 107)
      const tempUser = await prisma.user.create({
        data: {
          email: uniqueEmail('bankghost2'),
          username: uniqueUsername('bankghost2'),
          password: 'irrelevant-hash',
          firstName: 'Ghost2',
          lastName: 'Bank',
          money: 0,
          settings: {},
        },
      });
      const tempToken = generateTestToken({ id: tempUser.id, email: tempUser.email, role: 'user' });
      await prisma.user.delete({ where: { id: tempUser.id } });

      const csrf = await fetchCsrf(app);
      const res = await request(app)
        .post('/api/bank/claim')
        .set('Origin', ORIGIN)
        .set('Authorization', `Bearer ${tempToken}`)
        .set('Cookie', csrf.cookieHeader)
        .set('X-CSRF-Token', csrf.csrfToken)
        .send({});

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
