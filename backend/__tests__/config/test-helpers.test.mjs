/**
 * Sentinel suite for the token-family test helpers — Equoria-9z7u.
 *
 * Why this exists: during the 2026-04-30 code review, Edge Case Hunter
 * surfaced that `verifyTokenFamilyState` at test-helpers.mjs:411 was
 * reading `t.token.substring(0, 20)` — but `RefreshToken.token` was
 * dropped by Equoria-uy73 (only `tokenHash` remains in the schema).
 * Any caller of `assertFamilyInvalidation` would have thrown
 * `TypeError: Cannot read properties of undefined`. The bug was latent
 * because no integration suite directly exercised these helpers after
 * the migration.
 *
 * The fix renamed the field to `tokenHashPrefix` and reads `t.tokenHash`.
 * This file is the sentinel-positive test (per OPTIMAL_FIX_DISCIPLINE §2):
 * it proves the helpers actually work AND would catch a future migration
 * that re-broke them.
 *
 * Coverage:
 *   - verifyTokenFamilyState shape (totalTokens / activeTokens /
 *     invalidatedTokens / tokens[] with the renamed tokenHashPrefix)
 *   - verifyTokenFamilyState handles the empty-family case
 *   - assertFamilyInvalidation passes for a fully-invalidated family
 *   - assertFamilyInvalidation FAILS (throws) for a family with any
 *     active token — this is the actual sentinel: if the helper went
 *     back to silently passing, this test would catch it
 *   - assertFamilyInvalidation FAILS for a partially-invalidated family
 *     (mixed active and invalidated tokens)
 *
 * Real DB, no mocks — the helpers query Prisma directly, so a mock would
 * test the mock, not the helpers. (Backend testing philosophy per
 * CLAUDE.md.)
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';

import prisma from '../../db/index.mjs';
import { createTestUser, createTestRefreshToken } from '../setup.mjs';
import { verifyTokenFamilyState, assertFamilyInvalidation } from './test-helpers.mjs';

const SUITE_PREFIX = `helpers-9z7u-${Date.now()}`;

let testUser;
const createdFamilyIds = [];

beforeAll(async () => {
  testUser = await createTestUser({
    email: `${SUITE_PREFIX}-main@example.com`,
    username: `${SUITE_PREFIX}_main`,
  });
});

afterEach(async () => {
  // Clean tokens between tests so each test starts from a known state.
  if (createdFamilyIds.length > 0) {
    await prisma.refreshToken.deleteMany({
      where: { familyId: { in: createdFamilyIds } },
    });
    createdFamilyIds.length = 0;
  }
});

afterAll(async () => {
  // Defensive double-clean, then drop the user (cascades to any leftover tokens).
  if (testUser?.id) {
    await prisma.refreshToken.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
  }
});

const newFamilyId = label => {
  const familyId = `${SUITE_PREFIX}-fam-${label}-${Math.random().toString(36).slice(2, 8)}`;
  createdFamilyIds.push(familyId);
  return familyId;
};

describe('verifyTokenFamilyState — shape contract', () => {
  it('returns the documented shape including the renamed tokenHashPrefix field', async () => {
    const familyId = newFamilyId('shape');
    await createTestRefreshToken(testUser.id, { familyId });

    const state = await verifyTokenFamilyState(familyId);

    expect(state.familyId).toBe(familyId);
    expect(state.totalTokens).toBe(1);
    expect(state.activeTokens).toBe(1);
    expect(state.invalidatedTokens).toBe(0);
    expect(state.tokens).toHaveLength(1);

    const [t] = state.tokens;
    // Sentinel: this property is the post-Equoria-uy73 rename. If a future
    // migration drops tokenHash and the helper goes back to reading
    // `t.token`, this assertion fails — the bug becomes immediately visible
    // instead of latent.
    expect(t).toHaveProperty('tokenHashPrefix');
    expect(typeof t.tokenHashPrefix).toBe('string');
    expect(t.tokenHashPrefix).toMatch(/^[a-f0-9]{20}\.\.\.$/);
    expect(t.isActive).toBe(true);
    expect(t.isInvalidated).toBe(false);
    // Cross-realm Date check: Prisma returns Date instances from a different
    // module realm than this test, so `instanceof Date` is unreliable.
    // toString-tag is the canonical realm-safe Date detection.
    expect(Object.prototype.toString.call(t.createdAt)).toBe('[object Date]');
    expect(Number.isFinite(t.createdAt.getTime())).toBe(true);

    // Negative sentinel: the legacy `token` field MUST NOT come back. If a
    // future refactor re-aliases it, this assertion catches the regression
    // before it can mask a column-rename migration.
    expect(t).not.toHaveProperty('token');
  });

  it('counts active and invalidated tokens correctly across a mixed family', async () => {
    const familyId = newFamilyId('mixed');
    // 1 active, 1 invalidated, 1 expired-but-not-invalidated.
    await createTestRefreshToken(testUser.id, { familyId, isActive: true, isInvalidated: false });
    await createTestRefreshToken(testUser.id, { familyId, isActive: false, isInvalidated: true });
    await createTestRefreshToken(testUser.id, { familyId, isActive: false, isInvalidated: false });

    const state = await verifyTokenFamilyState(familyId);

    expect(state.totalTokens).toBe(3);
    expect(state.activeTokens).toBe(1);
    expect(state.invalidatedTokens).toBe(1);
    expect(state.tokens).toHaveLength(3);
    // Every token entry has the renamed field.
    for (const t of state.tokens) {
      expect(t).toHaveProperty('tokenHashPrefix');
      expect(t.tokenHashPrefix).toMatch(/^[a-f0-9]{20}\.\.\.$/);
    }
  });

  it('handles an empty family (no tokens with that familyId) without throwing', async () => {
    const familyId = newFamilyId('empty');

    const state = await verifyTokenFamilyState(familyId);

    expect(state).toEqual({
      familyId,
      totalTokens: 0,
      activeTokens: 0,
      invalidatedTokens: 0,
      tokens: [],
    });
  });
});

describe('assertFamilyInvalidation — pass / fail contract', () => {
  it('passes (does not throw) for a fully-invalidated family', async () => {
    const familyId = newFamilyId('invalidated');
    await createTestRefreshToken(testUser.id, {
      familyId,
      isActive: false,
      isInvalidated: true,
    });
    await createTestRefreshToken(testUser.id, {
      familyId,
      isActive: false,
      isInvalidated: true,
    });

    // Must not throw — passes the assertion. If this throws, the helper is broken.
    await expect(assertFamilyInvalidation(familyId)).resolves.toBeUndefined();
  });

  it('throws (fails the assertion) when the family has any active token', async () => {
    // SENTINEL: this is the actual proof that the assertion IS an assertion.
    // If a future change downgrades the inner expects to no-ops, this test
    // would start passing for the wrong reason — the test fails to fail —
    // and we'd lose the contract that family invalidation must be total.
    const familyId = newFamilyId('still-active');
    await createTestRefreshToken(testUser.id, {
      familyId,
      isActive: true,
      isInvalidated: false,
    });

    await expect(assertFamilyInvalidation(familyId)).rejects.toThrow();
  });

  it('throws when the family is partially invalidated (any active token survives)', async () => {
    const familyId = newFamilyId('partial');
    await createTestRefreshToken(testUser.id, {
      familyId,
      isActive: true,
      isInvalidated: false,
    });
    await createTestRefreshToken(testUser.id, {
      familyId,
      isActive: false,
      isInvalidated: true,
    });

    await expect(assertFamilyInvalidation(familyId)).rejects.toThrow();
  });

  it('throws when no row is invalidated even if all are inactive', async () => {
    // Edge case: tokens that expired (isActive=false) but were not flagged
    // as invalidated — the helper requires invalidatedTokens === totalTokens.
    const familyId = newFamilyId('expired-not-invalidated');
    await createTestRefreshToken(testUser.id, {
      familyId,
      isActive: false,
      isInvalidated: false,
    });

    await expect(assertFamilyInvalidation(familyId)).rejects.toThrow();
  });
});
