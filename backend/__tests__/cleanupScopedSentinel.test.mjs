/**
 * Sentinel: test-cleanup helpers MUST be scoped (Equoria-seahi)
 *
 * CLAUDE.md §2 mandate: tests run against the CANONICAL (production) DB.
 * `.env.test` points at the real Equoria DB. A bare
 * `prisma.user.deleteMany({})` / `prisma.refreshToken.deleteMany({})` in any
 * test setup/helper would therefore destroy ALL real user accounts + tokens.
 *
 * This sentinel proves the in-scope cleanup helpers are scoped: a
 * NON-fixture user (email with NO 'test' substring) and its refresh token
 * MUST survive a cleanup invocation. Against the pre-fix unscoped code these
 * assertions fail (the non-fixture rows get wiped). Against the scoped fix
 * they pass.
 *
 * Cleanup of this sentinel's own rows is strictly id-scoped, never broad.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import prisma from '../../packages/database/prismaClient.mjs';
import { hashRefreshToken } from '../utils/tokenRotationService.mjs';
import { cleanupAllRefreshTokens } from './config/test-helpers.mjs';

describe('test-cleanup helpers are scoped (Equoria-seahi)', () => {
  // A deliberately NON-fixture identity: no 'test' substring anywhere, so a
  // correctly-scoped cleanup (which targets only 'test'-tagged rows) must
  // leave it untouched. We still scope our OWN cleanup by these exact ids.
  const realLikeUserId = `Canary-seahi-${randomBytes(8).toString('hex')}`;
  const realLikeEmail = `canary.seahi.${randomBytes(8).toString('hex')}@example.org`;
  let createdTokenId;

  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: realLikeUserId,
        username: `Canary-seahi-${randomBytes(8).toString('hex')}`,
        email: realLikeEmail,
        firstName: 'Canary',
        lastName: 'Seahi',
        password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyGJ4lxPcxqy',
        emailVerified: true,
      },
    });
    const token = await prisma.refreshToken.create({
      data: {
        userId: realLikeUserId,
        tokenHash: hashRefreshToken(`canary-seahi-${randomBytes(8).toString('hex')}`),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        lastActivityAt: new Date(),
      },
    });
    createdTokenId = token.id;
  });

  afterAll(async () => {
    // Strictly scoped to the ids THIS suite created (CLAUDE.md §2).
    await prisma.refreshToken.deleteMany({ where: { userId: realLikeUserId } });
    await prisma.user.deleteMany({ where: { id: realLikeUserId } });
  });

  it('cleanupAllRefreshTokens() leaves a non-fixture refresh token intact', async () => {
    await cleanupAllRefreshTokens();

    const survivor = await prisma.refreshToken.findUnique({
      where: { id: createdTokenId },
    });
    expect(survivor).not.toBeNull();
    expect(survivor.userId).toBe(realLikeUserId);
  });

  it('the non-fixture user itself is never touched by token cleanup', async () => {
    const user = await prisma.user.findUnique({ where: { id: realLikeUserId } });
    expect(user).not.toBeNull();
    expect(user.email).toBe(realLikeEmail);
  });
});
