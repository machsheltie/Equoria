/**
 * Bank + transactions beta-critical API — real-DB integration (Equoria-qfky)
 *
 * Bank is beta-live (weekly claim + transaction history) but only had
 * unit-style bankController.test.mjs with no co-located supertest
 * integration test. This file exercises the full HTTP chain against the
 * real test DB with real JWT auth and real CSRF — NO Prisma or service
 * mocks, no bypass headers.
 *
 * Coverage:
 *  - GET  /api/v1/bank/claim-status   → fresh account can claim
 *  - POST /api/v1/bank/claim          → balance += 500, PERSISTED to DB
 *  - GET  /api/v1/bank/transactions   → a weekly_reward credit row exists
 *                                         reflecting the claim
 *  - POST /api/v1/bank/claim (again)  → cooldown rejection (400), balance
 *                                         unchanged (no double-credit)
 *
 * Real DB. Real prisma. Real HTTP chain via supertest. Real CSRF.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { randomBytes } from 'node:crypto';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { createTestUser, cleanupTestData } from '../../../tests/helpers/testAuth.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';

const FIXTURE_PREFIX = 'TestFixture-bank-qfky';
const ORIGIN = 'http://localhost:3000';
const WEEKLY_REWARD = 500;

let owner;
let token;

/**
 * Sends a CSRF-protected mutating request and resolves to the response.
 * A supertest chain is itself a thenable, so we fetch CSRF first then
 * build + .send() in one expression (no intermediate await of the chain).
 */
async function sendAuthCsrf(method, endpoint, body) {
  const c = await fetchCsrf(app, { origin: ORIGIN });
  const agent = request(app);
  const req = agent[method](endpoint);
  return req
    .set('Authorization', `Bearer ${token}`)
    .set('Origin', ORIGIN)
    .set('Cookie', c.cookieHeader)
    .set('X-CSRF-Token', c.csrfToken)
    .send(body);
}

beforeAll(async () => {
  const tag = randomBytes(4).toString('hex');
  const created = await createTestUser({
    username: `${FIXTURE_PREFIX}-${tag}`,
    email: `${FIXTURE_PREFIX}-${tag}@example.com`,
    money: 1000,
  });
  owner = created.user;
  token = created.token;

  // Ensure a clean weekly-claim slate (no prior claim recorded).
  await prisma.user.update({
    where: { id: owner.id },
    data: { money: 1000, settings: {} },
  });
}, 120000);

afterAll(async () => {
  await cleanupTestData();
});

describe('Bank + transactions API — real-DB integration (Equoria-qfky)', () => {
  it('GET /bank/claim-status reports a fresh account can claim', async () => {
    const res = await request(app)
      .get('/api/v1/bank/claim-status')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.canClaim).toBe(true);
    expect(res.body.data.rewardAmount).toBe(WEEKLY_REWARD);
  });

  it('POST /bank/claim credits the weekly reward and PERSISTS the balance delta', async () => {
    const before = await prisma.user.findUnique({
      where: { id: owner.id },
      select: { money: true },
    });

    const res = await sendAuthCsrf('post', '/api/v1/bank/claim', {});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.amount).toBe(WEEKLY_REWARD);
    expect(res.body.data.newBalance).toBe(before.money + WEEKLY_REWARD);

    // Persisted: re-read straight from the DB (not the response body).
    const after = await prisma.user.findUnique({
      where: { id: owner.id },
      select: { money: true, settings: true },
    });
    expect(after.money).toBe(before.money + WEEKLY_REWARD);
    // The atomic claim must have stamped lastWeeklyClaimDate.
    expect(after.settings.lastWeeklyClaimDate).toBeTruthy();
  });

  it('GET /bank/transactions reflects the weekly_reward credit row', async () => {
    const res = await request(app)
      .get('/api/v1/bank/transactions')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', ORIGIN);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // History shape varies (array vs { transactions, ... }); normalize.
    const list = Array.isArray(res.body.data) ? res.body.data : res.body.data.transactions || res.body.data.items || [];

    const claimRow = list.find(t => t.category === 'weekly_reward' && Number(t.amount) === WEEKLY_REWARD);
    expect(claimRow).toBeDefined();
    expect(claimRow.type).toBe('credit');
  });

  it('POST /bank/claim a second time is rejected (cooldown) with no double-credit', async () => {
    const before = await prisma.user.findUnique({
      where: { id: owner.id },
      select: { money: true },
    });

    const res = await sendAuthCsrf('post', '/api/v1/bank/claim', {});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already claimed/i);
    expect(res.body.nextClaimDate).toBeTruthy();

    // No double-credit: balance must be unchanged after the rejected claim.
    const after = await prisma.user.findUnique({
      where: { id: owner.id },
      select: { money: true },
    });
    expect(after.money).toBe(before.money);
  });
});
