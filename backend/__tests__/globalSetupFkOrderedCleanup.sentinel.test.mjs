/**
 * Sentinel (Equoria-fefh2.29): the globalSetup user-purge ordering is
 * load-bearing.
 *
 * v58ta made horses_userId_fkey ON DELETE RESTRICT. backend/tests/globalSetup.mjs
 * previously deleted fixture users WITHOUT first deleting their (registration
 * starter) horses, so user.deleteMany RESTRICT-failed and the catch swallowed it
 * (per-run "violates RESTRICT setting of foreign key constraint
 * horses_userId_fkey" warning + stale fixture data). The fix FK-orders the purge
 * (horses before users) and makes the catch fail-loud.
 *
 * This proves, sentinel-positive (OPTIMAL_FIX_DISCIPLINE §2):
 *   - deleting a user BEFORE its RESTRICT-linked horse REJECTS (so a future
 *     refactor that reverts to user-first deletion fails this test loudly), and
 *   - the FK-ordered form (horse before user) SUCCEEDS.
 * Cleanup is scoped to the suite's own TestFixture- prefix (CLAUDE.md §3).
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../packages/database/prismaClient.mjs';
import { fixtureColor } from '../tests/helpers/fixtureColor.mjs';

const SENTINEL = `TestFixture-fefh2_29-${randomBytes(6).toString('hex')}`;

async function makeUserWithHorse() {
  const tag = randomBytes(4).toString('hex');
  const user = await prisma.user.create({
    data: {
      email: `${SENTINEL}-${tag}@test.com`,
      username: `${SENTINEL}_${tag}`,
      password: 'irrelevant-hash',
      firstName: 'FK',
      lastName: 'Order',
      settings: {},
    },
  });
  const horse = await prisma.horse.create({
    data: {
      ...fixtureColor(),
      name: `${SENTINEL}-horse-${tag}`,
      sex: 'Mare',
      dateOfBirth: new Date(),
      userId: user.id,
    },
  });
  return { user, horse };
}

async function cleanup() {
  // Horses before users (the very ordering this sentinel guards).
  await prisma.horse.deleteMany({ where: { name: { startsWith: SENTINEL } } });
  await prisma.user.deleteMany({ where: { username: { startsWith: SENTINEL } } });
}

afterAll(cleanup);

describe('globalSetup FK-ordered user purge (Equoria-fefh2.29)', () => {
  it('SENTINEL: deleting a user BEFORE its RESTRICT-linked horse REJECTS', async () => {
    const { user } = await makeUserWithHorse();
    // Reversed (user-first) — must hit the horses_userId_fkey RESTRICT. The
    // Prisma error is a raw ConnectorError (no mapped .code), so assert on the
    // message text rather than relying on .rejects.toThrow regex matching.
    let err;
    try {
      await prisma.user.deleteMany({ where: { id: user.id } });
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.message).toMatch(/RESTRICT|horses_userId_fkey/);
    await cleanup();
  });

  it('FK-ordered (horse before user) SUCCEEDS', async () => {
    const { user, horse } = await makeUserWithHorse();
    await prisma.horse.deleteMany({ where: { id: horse.id } });
    const res = await prisma.user.deleteMany({ where: { id: user.id } });
    expect(res.count).toBe(1);
  });
});
