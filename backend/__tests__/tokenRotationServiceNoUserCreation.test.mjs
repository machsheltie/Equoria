/**
 * tokenRotationService — createTokenPair MUST NOT auto-create users (Equoria-x243u)
 *
 * Security regression guard. `createTokenPair()` previously contained an
 * `ensureUserExists()` helper that, when `NODE_ENV === 'test'`, inserted a
 * minimal `User` row (`password: 'test-bypass'`, fabricated email/username)
 * for any userId that did not already exist. That is a test-only backdoor
 * living in a production code path — exactly the class of construct the
 * constitution (§2 "no fake/seeded data outside tests", §4 "substance over
 * appearance") and the issue Equoria-x243u exist to eradicate.
 *
 * This suite proves the backdoor is gone:
 *   - Calling createTokenPair with a syntactically-valid but NON-EXISTENT
 *     user id (in NODE_ENV=test) creates ZERO User rows.
 *   - The real production callers (authController register/login, refresh)
 *     always pass an already-persisted user, so removing the auto-creation
 *     does not regress any legitimate path — verified by the existing
 *     real-DB suites that create a user before calling createTokenPair.
 *
 * Real-DB, no mocks (CLAUDE.md §3). Scoped, id-based assertions and cleanup.
 */

import { describe, it, expect, afterAll } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createTokenPair } from '../utils/tokenRotationService.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
import { createCleanupTracker } from './helpers/failLoudCleanup.mjs';

// A syntactically-valid UUID that is NOT in the DB. createTokenPair must never
// materialise a User for this id. Generated fresh per run so it can never
// collide with a real row.
const GHOST_USER_ID = randomUUID();

describe('createTokenPair() — no test-user auto-creation (Equoria-x243u)', () => {
  const cleanup = createCleanupTracker();

  afterAll(() => {
    // Defensive, scoped cleanup: if the (now-removed) backdoor ever returns,
    // delete exactly the ghost id this suite could have caused — children
    // (tokens, userId-scoped) before the parent (user, id-scoped). On a green
    // run these delete zero rows. Fail-loud so a leaked fixture surfaces.
    cleanup.add(
      () => prisma.refreshToken.deleteMany({ where: { userId: GHOST_USER_ID } }),
      'refreshToken(ghost userId)',
    );
    cleanup.add(
      () => prisma.user.deleteMany({ where: { id: GHOST_USER_ID } }),
      'user(ghost id)',
    );
    return cleanup.run();
  }, 30000);

  // The function MUST NOT create a User. WHETHER it returns a pair (test-env
  // persistence-skip tolerates the FK-less insert) or throws (if a future
  // change drops that tolerance, the FK violation surfaces) is irrelevant to
  // this AC — either outcome is consistent with "no user was created". So we
  // tolerate a throw and assert ONLY on the absence of a User row, keeping the
  // test pinned to the backdoor's effect rather than to the surrounding catch.
  async function callTolerantOfThrow(...args) {
    try {
      await createTokenPair(...args);
    } catch {
      /* FK rejection on persist is acceptable — it proves no user was created */
    }
  }

  it('does NOT create a User row for a non-existent userId', async () => {
    // Sanity: the ghost user must not pre-exist.
    const before = await prisma.user.findUnique({ where: { id: GHOST_USER_ID } });
    expect(before).toBeNull();

    // Call the production function. With the backdoor present (current master),
    // a User row IS inserted here — which the assertion below catches.
    await callTolerantOfThrow(GHOST_USER_ID);

    const after = await prisma.user.findUnique({ where: { id: GHOST_USER_ID } });
    expect(after).toBeNull();
  });

  it('does NOT create a User even when an explicit familyId and role are passed', async () => {
    // The backdoor ran regardless of familyId/role arguments — cover that shape
    // too so a partial reintroduction (guarded on one arg path) is still caught.
    await callTolerantOfThrow(GHOST_USER_ID, 'x243u-family-explicit', 'admin');

    const after = await prisma.user.findUnique({ where: { id: GHOST_USER_ID } });
    expect(after).toBeNull();
  });
});
