/**
 * feedHorse writes and compares lastFedDate in UTC whatever the database
 * session's TimeZone is (Equoria-7uphu).
 *
 * `horses.lastFedDate` is `timestamp without time zone` holding UTC wall time —
 * that is what every typed Prisma write stores. The feed claim is a raw
 * UPDATE, and a JS Date bound into raw SQL arrives as `timestamptz`; Postgres
 * converts it to the column type in the SESSION time zone. On a server whose
 * TimeZone is not UTC (this laptop's PostgreSQL runs America/New_York) the
 * claim therefore stored Eastern wall time, and its `lastFedDate < start of
 * today` guard compared a UTC-written column against a shifted bound: a horse
 * last fed (by a typed write) just before today's Eastern midnight passed the
 * "not fed today" pre-check and was then refused by the claim with
 * "Already fed today". On a UTC server both tests pass with or without the fix;
 * on a non-UTC server they fail without it.
 *
 * Real DB, real service, no mocks.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { feedHorse } from '../services/horseFeedService.mjs';
import { startOfGameDay } from '../../../utils/horseHealth.mjs';
import { fixtureColor } from '../../../tests/helpers/fixtureColor.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';

const noBoost = () => 0.99;

describe('feedHorse lastFedDate is UTC regardless of the session TimeZone (Equoria-7uphu)', () => {
  let userId;
  let horseId;
  const cleanup = createCleanupTracker();

  beforeEach(async () => {
    const tag = `${randomBytes(4).toString('hex')}${randomBytes(4).toString('hex')}`;
    const user = await prisma.user.create({
      data: {
        email: `feed-tz-${tag}@test.com`,
        username: `feedtz${tag}`,
        password: 'irrelevant-test-hash',
        firstName: 'Test',
        lastName: 'User',
        money: 0,
        settings: {
          inventory: [{ id: 'feed-basic', itemId: 'basic', category: 'feed', name: 'Basic Feed', quantity: 5 }],
        },
      },
    });
    userId = user.id;
    const horse = await prisma.horse.create({
      data: {
        ...fixtureColor(),
        name: `FeedTzHorse${tag}`,
        sex: 'Stallion',
        dateOfBirth: new Date('2020-01-01'),
        age: 5,
        userId,
        equippedFeedType: 'basic',
      },
    });
    horseId = horse.id;
    cleanup.add(() => prisma.horse.delete({ where: { id: horseId } }), 'horse');
    cleanup.add(() => prisma.user.delete({ where: { id: userId } }), 'user');
  });

  afterEach(() => cleanup.run());

  it('stores the feeding instant, not the session-local wall time', async () => {
    const before = Date.now();
    await feedHorse({ userId, horseId, rng: noBoost });
    const after = Date.now();

    const fresh = await prisma.horse.findUnique({
      where: { id: horseId },
      select: { lastFedDate: true },
    });
    const stored = fresh.lastFedDate.getTime();
    // A session-zone shift is whole hours; one second of slack covers the
    // millisecond truncation of timestamp(3) and clock granularity.
    expect(stored).toBeGreaterThanOrEqual(before - 1000);
    expect(stored).toBeLessThanOrEqual(after + 1000);
  });

  it('a horse last fed just before today’s Eastern midnight can be fed today', async () => {
    const lastFedDate = new Date(startOfGameDay(new Date()).getTime() - 1);
    await prisma.horse.update({ where: { id: horseId }, data: { lastFedDate } });

    const result = await feedHorse({ userId, horseId, rng: noBoost });

    expect(result).toBeTruthy();
    const fresh = await prisma.horse.findUnique({
      where: { id: horseId },
      select: { lastFedDate: true },
    });
    expect(fresh.lastFedDate.getTime()).toBeGreaterThan(lastFedDate.getTime());
  });
});
