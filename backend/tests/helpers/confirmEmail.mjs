/**
 * Confirm a test player's email (Equoria-voasj, owner ruling q248).
 *
 * The server refuses all play until an account's email is confirmed. A suite
 * that signs a player up through POST /auth/register and then plays calls this
 * right after registering, standing in for the player following the emailed
 * link. The link itself is covered by the email-verification suites and by
 * emailVerificationGate.integration.test.mjs; this is only fixture setup.
 *
 * An unconfirmed account is never served from the auth middleware's cache, so
 * the very next request sees the confirmed state.
 */

import prisma from '../../../packages/database/prismaClient.mjs';

/** @param {string} userId */
export async function confirmEmail(userId) {
  if (typeof userId !== 'string' || userId.length === 0) {
    throw new Error(`confirmEmail needs a user id, got ${String(userId)}`);
  }
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: true, emailVerifiedAt: new Date() },
  });
}
