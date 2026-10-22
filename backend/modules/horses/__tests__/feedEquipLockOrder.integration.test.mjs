/**
 * Feeding takes the owner's User row before the Horse row (Equoria-lmer7).
 *
 * The repository lock order is User -> Horse -> staff rows
 * (txUserBeforeHorseLockOrder.sentinel). feedHorse claimed the horse row (the
 * guarded fed-today UPDATE) and only then wrote the owner's settings
 * inventory, while equipItem writes the inventory (User row) and then the
 * horse's tack. A feed and an equip on one horse could therefore each hold
 * one row and wait for the other: Postgres kills one with 40P01, which the
 * player sees as a 503.
 *
 * The interleaving is forced with a real row lock (rowLockBarrier), no mocks:
 * the test holds the User row; the equip queues on its inventory write; the
 * feed (pre-fix) claims the horse, then queues on the User row behind the
 * equip. Releasing gives the equip the User row while the feed holds the
 * horse — the deadlock. After the fix the feed queues on the User row before
 * touching the horse, so the two simply run one after the other.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { fetchCsrf } from '../../../tests/helpers/csrfHelper.mjs';
import { createTestHorse } from '../../../__tests__/helpers/createTestHorse.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import {
  createBarrierClient,
  openRowLockBarrier,
  waitForBlockedSessions,
} from '../../../__tests__/helpers/rowLockBarrier.mjs';

const origin = 'http://localhost:3000';
const fixturePrefix = 'TestFixture-lmer7-feedequip';
const startUnits = 5;

const barrierClient = createBarrierClient();
const uniq = () => randomBytes(6).toString('hex');

async function post(endpoint, jwt, body) {
  const csrf = await fetchCsrf(app, { origin, extraCookies: [`accessToken=${jwt}`] });
  return request(app)
    .post(endpoint)
    .set('Authorization', `Bearer ${jwt}`)
    .set('Origin', origin)
    .set('Cookie', csrf.cookieHeader)
    .set('X-CSRF-Token', csrf.csrfToken)
    .send(body ?? {});
}

describe('feedHorse locks User before Horse (Equoria-lmer7)', () => {
  const cleanup = createCleanupTracker();
  let user;
  let token;
  let horse;

  beforeEach(async () => {
    const tag = uniq();
    user = await prisma.user.create({
      data: {
        email: `${fixturePrefix}-${tag}@example.com`,
        username: `${fixturePrefix}-${tag}`,
        password: 'irrelevant-hash',
        firstName: 'Feed',
        lastName: 'Equip',
        money: 10000,
        settings: {
          inventory: [
            { id: 'feed-basic', itemId: 'basic', category: 'feed', name: 'Basic Feed', quantity: startUnits },
            {
              id: 'inv-saddle',
              itemId: 'all-purpose-saddle',
              category: 'saddle',
              name: 'All-Purpose Saddle',
              quantity: 1,
              equippedToHorseId: null,
            },
          ],
        },
      },
    });
    token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
    const horseIds = [];
    horse = await createTestHorse(
      prisma,
      {
        name: `${fixturePrefix}-${tag}`,
        sex: 'Mare',
        dateOfBirth: new Date('2022-01-01'),
        age: 4,
        userId: user.id,
        equippedFeedType: 'basic',
        lastFedDate: null,
      },
      horseIds,
    );
    const userId = user.id;
    cleanup.add(() => prisma.userTransaction.deleteMany({ where: { userId } }), 'ledger');
    cleanup.add(() => prisma.horse.deleteMany({ where: { id: { in: horseIds } } }), 'horses');
    cleanup.add(() => prisma.user.deleteMany({ where: { id: userId } }), 'user');
  }, 60000);

  afterEach(() => cleanup.run(), 60000);
  afterAll(() => barrierClient.$disconnect());

  it('a feed and an equip on the same horse both complete — no deadlock', async () => {
    const barrier = await openRowLockBarrier(
      barrierClient,
      tx => tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`,
    );
    let equip;
    let feed;
    try {
      equip = post('/api/v1/inventory/equip', token, {
        inventoryItemId: 'inv-saddle',
        horseId: horse.id,
      }).then(r => r);
      await waitForBlockedSessions(barrierClient, barrier.pid, 1);
      feed = post(`/api/v1/horses/${horse.id}/feed`, token).then(r => r);
      await waitForBlockedSessions(barrierClient, barrier.pid, 2);
    } finally {
      await barrier.release();
    }
    const [equipped, fed] = await Promise.all([equip, feed]);

    expect({ equip: equipped.status, feed: fed.status }).toEqual({ equip: 200, feed: 200 });

    const row = await prisma.horse.findUnique({
      where: { id: horse.id },
      select: { tack: true, lastFedDate: true },
    });
    expect(row.tack).toMatchObject({ saddle: 'all-purpose-saddle' });
    expect(row.lastFedDate).not.toBeNull();
    const settings = (await prisma.user.findUnique({ where: { id: user.id }, select: { settings: true } })).settings;
    expect(settings.inventory.find(i => i.id === 'feed-basic').quantity).toBe(startUnits - 1);
    expect(settings.inventory.find(i => i.id === 'inv-saddle').equippedToHorseId).toBe(horse.id);
  }, 60000);
});
