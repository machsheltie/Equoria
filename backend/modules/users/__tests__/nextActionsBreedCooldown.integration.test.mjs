/**
 * next-actions `breed`: the 7-day, mares-only cooldown on Eastern game days
 * (Equoria-kha18 item 5).
 *
 * Owner rulings: the dam cooldown is 7 days and applies to mares only
 * (2026-10-02, S-Q1 2026-10-16); every day count is an Eastern calendar day
 * (2026-10-09). The controller used a 30-day millisecond cooldown on both
 * sexes. It now asks the breeding guard's own rule (breedingPairRules
 * damBreedingCooldownEndsAt): a mare is held until 00:00 Eastern on bred-day
 * + 7; a stallion is never held.
 *
 * Instants pinned inside the evening window, where a millisecond count from
 * the date-only lastBredDate already holds one more day than the Eastern
 * calendar:
 *   - summer: 2026-10-17T00:30Z = Fri 2026-10-16 20:30 EDT
 *   - winter: 2026-12-12T03:30Z = Fri 2026-12-11 22:30 EST
 *
 * Only Date is faked; every timer Prisma and pg rely on stays real. The token
 * is issued under the pinned clock so it is valid at that instant.
 * Real DB, real HTTP. No mocks.
 */

import { describe, it, expect, jest, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import request from 'supertest';

import app from '../../../app.mjs';
import prisma from '../../../../packages/database/prismaClient.mjs';
import { generateTestToken } from '../../../tests/helpers/authHelper.mjs';
import { createCleanupTracker } from '../../../__tests__/helpers/failLoudCleanup.mjs';
import { createTestHorse, cleanupTestHorses } from '../../../__tests__/helpers/createTestHorse.mjs';
import { birthDateForAge } from '../../../utils/horseAge.mjs';
import { gameCalendarDate } from '../../../utils/gameTime.mjs';

const ORIGIN = 'http://localhost:3000';
const TAG = randomBytes(4).toString('hex');

const EVENINGS = [
  ['summer, 20:30 EDT', new Date('2026-10-17T00:30:00.000Z')],
  ['winter, 22:30 EST', new Date('2026-12-12T03:30:00.000Z')],
];

const REAL_EXCEPT_DATE = [
  'hrtime',
  'nextTick',
  'performance',
  'queueMicrotask',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
  'setImmediate',
  'clearImmediate',
  'setInterval',
  'clearInterval',
  'setTimeout',
  'clearTimeout',
];

/** Run `fn` with the wall clock (Date only) frozen at `instant`. */
async function at(instant, fn) {
  jest.useFakeTimers({ now: instant, doNotFake: REAL_EXCEPT_DATE });
  try {
    return await fn();
  } finally {
    jest.useRealTimers();
  }
}

const horseIds = [];
const userIds = [];
let seq = 0;

/** A user owning exactly one adult horse of `sex`, last bred `bredDaysAgo` game days before `now`. */
async function ownerOf(now, sex, bredDaysAgo) {
  seq += 1;
  const user = await prisma.user.create({
    data: {
      email: `kha18-nextact-${TAG}-${seq}@test.com`,
      username: `kha18nextact${TAG}${seq}`,
      password: 'irrelevant-hash',
      firstName: 'NextAct',
      lastName: 'Cooldown',
    },
  });
  userIds.push(user.id);
  // No rider: no compete suggestion. Not injured: no visit-vet. Bad health
  // blocks breeding (owner ruling 2026-10-22), so the horse is fed.
  const horse = await createTestHorse(
    prisma,
    {
      name: `TestFixture-kha18-nextact-${TAG}-${seq}`,
      sex,
      age: 5,
      dateOfBirth: birthDateForAge(5, now),
      healthStatus: 'Excellent',
      // Fed at the pinned instant: not in bad health, so the health gate
      // (Equoria-3tna6) leaves the cooldown as the only rule under test.
      lastFedDate: now,
      lastBredDate: gameCalendarDate(now, -bredDaysAgo),
      userId: user.id,
    },
    horseIds,
  );
  return { user, horse };
}

function breedActionsAt(now, user) {
  return at(now, async () => {
    const token = generateTestToken({ id: user.id, email: user.email, role: 'user' });
    const res = await request(app)
      .get('/api/v1/next-actions')
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    return res.body.data.actions.filter(a => a.type === 'breed');
  });
}

const cleanup = createCleanupTracker();
cleanup.add(() => cleanupTestHorses(prisma, horseIds), 'horses');
cleanup.add(() => prisma.user.deleteMany({ where: { id: { in: userIds } } }), 'users');
afterAll(() => cleanup.run(), 60000);

describe.each(EVENINGS)('next-actions breed cooldown on Eastern game days (%s) — Equoria-kha18', (_label, now) => {
  let mare7;
  let mare6;
  let stallion1;

  beforeAll(async () => {
    mare7 = await ownerOf(now, 'Mare', 7);
    mare6 = await ownerOf(now, 'Mare', 6);
    stallion1 = await ownerOf(now, 'Stallion', 1);
  }, 60000);

  it('suggests breeding a mare bred 7 game days ago: her cooldown ended at 00:00 Eastern today', async () => {
    const breed = await breedActionsAt(now, mare7.user);

    expect(breed).toHaveLength(1);
    expect(breed[0]).toMatchObject({ horseId: mare7.horse.id, metadata: { cooldownEndsAt: null } });
  });

  it('does not suggest a mare bred 6 game days ago, though a millisecond count already reads 7 days', async () => {
    const breed = await breedActionsAt(now, mare6.user);

    expect(breed).toHaveLength(0);
  });

  it('suggests breeding a stallion bred yesterday: a stallion is never held by a cooldown', async () => {
    const breed = await breedActionsAt(now, stallion1.user);

    expect(breed).toHaveLength(1);
    expect(breed[0]).toMatchObject({ horseId: stallion1.horse.id, metadata: { cooldownEndsAt: null } });
  });
});
