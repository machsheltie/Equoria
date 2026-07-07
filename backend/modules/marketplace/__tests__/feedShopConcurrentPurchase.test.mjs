/**
 * Concurrent feed-purchase race sentinel (Equoria-8sag0, Cluster 4).
 *
 * Defect class: JSONB read-modify-write ordering. purchaseFeed debits money
 * atomically (row lock via debitMoneyOrThrow) but historically read
 * User.settings BEFORE acquiring that lock, then merged the inventory add onto
 * that pre-lock snapshot. Two concurrent purchases therefore BOTH debit (the
 * row lock serializes the debits) but the second settings write erases the
 * first purchase's inventory add — the player is charged twice and receives
 * one pack. Money-visible loss reproducible with an ordinary double-click.
 *
 * The fix orders the tx as DEBIT FIRST (row lock) → THEN read settings → merge
 * → write, so the lock serializes the whole read-modify-write and a sibling
 * purchase merges onto the committed inventory instead of a stale snapshot.
 *
 * Real DB, real auth, real CSRF — no bypass headers, no API mocks. Test-env
 * Prisma pool (connection_limit: 3) gives the two concurrent purchases real
 * parallel connections so the race is exercised, not serialized away.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

describe('POST /api/v1/feed-shop/purchase — concurrent purchase race (Equoria-8sag0)', () => {
  let user;
  let token;
  let csrf;
  const cleanup = createCleanupTracker();

  beforeAll(async () => {
    csrf = await fetchCsrf(app);
  }, 30000);

  beforeEach(async () => {
    user = await prisma.user.create({
      data: {
        email: `feed-race-${randomBytes(4).toString('hex')}-${randomBytes(4).toString('hex')}@test.com`,
        username: `feedrace${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`,
        password: 'irrelevant-test-hash',
        firstName: 'Test',
        lastName: 'User',
        money: 1000,
        settings: {},
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
    cleanup.add(() => prisma.user.delete({ where: { id: user.id } }), 'user');
  });

  afterEach(() => cleanup.run());

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // Concurrency count. The pre-lock settings read means every purchase whose
  // read window overlaps another's uncommitted debit merges onto a stale
  // inventory base and clobbers the sibling's add. Test-env pool is 3, so a
  // handful of concurrent posts reliably overlaps at least one pair.
  const CONCURRENCY = 8;
  const INITIAL_MONEY = 5000;
  const PACK_PRICE = 100; // FEED_CATALOG basic.packPrice
  const UNITS_PER_PACK = 100;

  const post = () =>
    request(app)
      .post('/api/v1/feed-shop/purchase')
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', csrf.cookieHeader)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ feedTier: 'basic', packs: 1 });

  it('concurrent basic-feed purchases: money debited and units received must agree (no lost pack)', async () => {
    await prisma.user.update({ where: { id: user.id }, data: { money: INITIAL_MONEY } });

    // Fire N purchases at once. Each debits 100 coins and adds 100 units of
    // feed-basic. If the inventory read-modify-write is ordered before the
    // debit's row lock, siblings debit but their adds are clobbered.
    const responses = await Promise.all(Array.from({ length: CONCURRENCY }, () => post()));

    // Every purchase succeeds from the client's perspective — the corruption is
    // silent (each player sees a "purchased" response).
    for (const r of responses) {
      expect(r.status).toBe(200);
    }

    const fresh = await prisma.user.findUnique({ where: { id: user.id } });

    // Every debit landed (row lock serializes the debits): all N charged.
    expect(fresh.money).toBe(INITIAL_MONEY - CONCURRENCY * PACK_PRICE);

    const debitRows = await prisma.userTransaction.count({
      where: { userId: user.id, category: 'feed_purchase', type: 'debit' },
    });
    expect(debitRows).toBe(CONCURRENCY);

    // THE INVARIANT: units received must equal units paid for. Coins spent
    // (INITIAL_MONEY - final) buys (coinsSpent / PACK_PRICE) packs, each
    // UNITS_PER_PACK units. The pre-fix code debits every purchase but loses
    // the clobbered adds, so units received is strictly less than units paid.
    const coinsSpent = INITIAL_MONEY - fresh.money;
    const unitsPaidFor = (coinsSpent / PACK_PRICE) * UNITS_PER_PACK;
    const basicRows = (fresh.settings.inventory || []).filter(i => i.id === 'feed-basic');
    expect(basicRows).toHaveLength(1);
    expect(basicRows[0].quantity).toBe(unitsPaidFor);
    expect(basicRows[0].quantity).toBe(CONCURRENCY * UNITS_PER_PACK);
  });
});
