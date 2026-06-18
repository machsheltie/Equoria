/**
 * Sentinel — createTokenPair refresh-token persistence is FAIL-LOUD (Equoria-6fm0e).
 *
 * createTokenPair() previously wrapped the refresh-token persist in
 * `catch (err) { if (NODE_ENV === 'test') { warn + swallow } else throw }` — a
 * test-only soft-catch in a production code path: on a real persistence failure
 * it returned UNPERSISTED tokens and only logged under test, masking the failure
 * (same backdoor class as the removed ensureUserExists(), Equoria-x243u). The
 * swallow is removed; persistence now propagates in every env.
 *
 * This sentinel proves it, end-to-end against the real DB: a createTokenPair for
 * a valid-UUID-but-NON-EXISTENT user must REJECT — the refresh_tokens.userId FK
 * (now enforced canonical-DB-wide after the Equoria-3spgs-class FK-drift fix)
 * rejects the insert, and with the swallow gone that rejection propagates. (This
 * sentinel could NOT pass before the FK was enforced — a ghost insert silently
 * succeeded; that drift is what blocked 6fm0e.) The success path stays intact:
 * a real user yields a pair AND a persisted refresh_tokens row.
 *
 * Real DB, no mocks.
 */
import { describe, it, expect, afterEach } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import prisma from '../../packages/database/prismaClient.mjs';
import { createTokenPair } from '../utils/tokenRotationService.mjs';
import { createTestUser, cleanupTestUser } from './config/test-helpers.mjs';

describe('createTokenPair — fail-loud refresh-token persistence (Equoria-6fm0e)', () => {
  let createdUserId = null;

  afterEach(async () => {
    if (createdUserId) {
      await cleanupTestUser(createdUserId);
      createdUserId = null;
    }
  });

  it('REJECTS when the userId does not exist (FK violation propagates — no test-env swallow)', async () => {
    // A well-formed UUID that owns no User row. Persisting a refresh_token for it
    // violates refresh_tokens_userId_fkey; the removed soft-catch used to swallow
    // this under NODE_ENV=test and return unpersisted tokens.
    // A well-formed UUID that owns no User row. Persisting a refresh_token for it
    // violates refresh_tokens_userId_fkey (Prisma P2003); the removed soft-catch
    // used to swallow this under NODE_ENV=test and return unpersisted tokens.
    // (An explicit try/catch, not `.rejects.toThrow()`, because the latter
    // matcher did not reliably observe this particular async rejection under the
    // experimental-vm-modules runner — and asserting the P2003 code is stronger.)
    const ghostUserId = randomUUID();
    let error = null;
    try {
      await createTokenPair(ghostUserId);
    } catch (e) {
      error = e;
    }
    expect(error).not.toBeNull();
    expect(error.code).toBe('P2003'); // foreign-key violation propagated, not swallowed

    // And nothing was persisted for the ghost user.
    const count = await prisma.refreshToken.count({ where: { userId: ghostUserId } });
    expect(count).toBe(0);
  });

  it('SUCCESS PATH intact: a real user yields a pair AND a persisted refresh_tokens row', async () => {
    const user = await createTestUser();
    createdUserId = user.id;

    const pair = await createTokenPair(user.id);
    expect(typeof pair.accessToken).toBe('string');
    expect(typeof pair.refreshToken).toBe('string');
    expect(typeof pair.familyId).toBe('string');

    // The token was actually persisted (proves the persist path runs, not swallowed).
    const persisted = await prisma.refreshToken.count({ where: { userId: user.id } });
    expect(persisted).toBeGreaterThanOrEqual(1);
  });
});
