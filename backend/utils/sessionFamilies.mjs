/**
 * Player sessions (Equoria-wj4bc, owner ruling q180, 2026-10-28):
 * "Allow a few devices at once — up to about 5 logins stay signed in, each
 * safely renewed on its own; your oldest drops off after that."
 *
 * A session is one sign-in: one refresh-token family (`RefreshToken.familyId`).
 * Every login starts a NEW family (a login never reuses an earlier session id,
 * so the CWE-384 session-fixation protection holds). Refresh rotates the
 * token within its family only, and reuse detection revokes only that family
 * (utils/tokenRotationService.mjs). A player keeps at most
 * `maxSessionsPerPlayer` live families; the login that would make one more
 * ends the oldest. Logout ends only the session it is sent from.
 *
 * Access tokens carry their family (`familyId` claim), and authenticateToken
 * refuses one whose family has no live refresh token (Equoria-yrixa), so ending
 * a session ends its 15-minute access tokens too, not only its refresh token.
 * The answer is cached per family for 30 seconds, like passwordChangedAt;
 * every path in this module that ends a family evicts it at once.
 */

import prisma from '../../packages/database/prismaClient.mjs';
import logger from './logger.mjs';
import { withRetryableTxMapping } from './retryableTransaction.mjs';
import {
  hashRefreshToken,
  generateTokenFamily,
  buildSignedTokenPair,
  buildSignedAccessToken,
  persistRefreshTokenWithRetry,
} from './tokenCryptoHelpers.mjs';

/** Owner ruling q180: about five devices stay signed in. */
export const maxSessionsPerPlayer = 5;

/** A refresh token lives 7 days, as in tokenRotationService. */
const refreshLifetimeMs = 7 * 24 * 60 * 60 * 1000;

const sessionOpenCacheTtlMs = 30_000;
/** familyId -> { userId, open, expiresAt } */
const sessionOpenCache = new Map();

/** A refresh-token row that can still be renewed. */
const liveTokenWhere = () => ({
  isActive: true,
  isInvalidated: false,
  expiresAt: { gt: new Date() },
});

/**
 * Is this sign-in still open? True while its family has a live refresh token.
 * Read through a 30s cache; a lookup error propagates (the caller fails closed).
 */
export async function isSessionOpen(familyId, userId) {
  const entry = sessionOpenCache.get(familyId);
  if (entry && entry.expiresAt > Date.now() && entry.userId === userId) {
    return entry.open;
  }
  const live = await prisma.refreshToken.findFirst({
    where: { familyId, userId, ...liveTokenWhere() },
    select: { id: true },
  });
  const open = live !== null;
  sessionOpenCache.set(familyId, { userId, open, expiresAt: Date.now() + sessionOpenCacheTtlMs });
  return open;
}

/** Forget cached answers for families that were just ended. */
export function forgetSessions(familyIds) {
  for (const familyId of familyIds) {
    sessionOpenCache.delete(familyId);
  }
}

/**
 * The family a presented refresh token belongs to, by its stored hash. A match
 * proves possession of the token, so no signature check is needed to END it.
 * @returns {Promise<{ userId: string, familyId: string } | null>}
 */
async function familyOfRefreshToken(client, refreshToken) {
  if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
    return null;
  }
  const row = await client.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(refreshToken) },
    select: { userId: true, familyId: true },
  });
  return row?.familyId ? { userId: row.userId, familyId: row.familyId } : null;
}

/**
 * The live families of a player beyond the newest `maxSessionsPerPlayer`,
 * oldest first. A family's age is its earliest surviving row (the login row,
 * until the token cleanup removes rows past their 7-day expiry).
 */
async function familiesOverTheLimit(tx, userId, keepFamilyId) {
  const liveRows = await tx.refreshToken.findMany({
    where: { userId, familyId: { not: null }, ...liveTokenWhere() },
    select: { familyId: true },
  });
  const live = [...new Set(liveRows.map(row => row.familyId))];
  if (live.length <= maxSessionsPerPlayer) {
    return [];
  }
  const started = await tx.refreshToken.groupBy({
    by: ['familyId'],
    where: { userId, familyId: { in: live } },
    _min: { createdAt: true },
  });
  return started
    .filter(family => family.familyId !== keepFamilyId)
    .sort((a, b) => a._min.createdAt - b._min.createdAt || a.familyId.localeCompare(b.familyId))
    .slice(0, live.length - maxSessionsPerPlayer)
    .map(family => family.familyId);
}

/**
 * Start a new session for a player who has just proved who they are (password,
 * or password + MFA code).
 *
 * In one transaction, after locking the player's User row so two logins at
 * once cannot both keep a sixth session:
 *   1. the session of the refresh token this browser presented, if any, ends —
 *      the new login replaces it in this cookie jar;
 *   2. a new family starts with a fresh token pair;
 *   3. families beyond the newest five end (the oldest drop off).
 * Ended families are invalidated (kept for the cleanup job's audit window),
 * never deleted, so a later refresh with one of their tokens is a plain 401.
 *
 * @param {string} userId
 * @param {string} [role] embedded in the access token (Equoria-ovp9)
 * @param {{ presentedRefreshToken?: string }} [options]
 * @returns {Promise<{ accessToken: string, refreshToken: string, familyId: string }>}
 */
export async function startSession(userId, role, { presentedRefreshToken } = {}) {
  const { pair, ended } = await withRetryableTxMapping(
    prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;

      const ended = [];
      const replaced = await familyOfRefreshToken(tx, presentedRefreshToken);
      if (replaced) {
        ended.push(replaced.familyId);
      }

      const familyId = generateTokenFamily();
      const pair = await persistRefreshTokenWithRetry({
        prismaClient: tx,
        userId,
        familyId,
        expiresAt: new Date(Date.now() + refreshLifetimeMs),
        initialPair: buildSignedTokenPair(userId, familyId, role),
        role,
      });

      if (ended.length > 0) {
        await tx.refreshToken.updateMany({
          where: { familyId: { in: ended } },
          data: { isActive: false, isInvalidated: true },
        });
      }
      const overLimit = await familiesOverTheLimit(tx, userId, familyId);
      if (overLimit.length > 0) {
        await tx.refreshToken.updateMany({
          where: { userId, familyId: { in: overLimit } },
          data: { isActive: false, isInvalidated: true },
        });
        ended.push(...overLimit);
      }
      return { pair: { ...pair, familyId }, ended };
    }),
    { message: 'The server is busy signing you in, please retry in a moment.' },
  );

  forgetSessions(ended);
  if (ended.length > 0) {
    logger.info('[sessions] Login ended earlier sessions', { userId, endedCount: ended.length });
  }
  return pair;
}

/**
 * End the session(s) a logout request came from: the family named by its
 * access token and the family of its refresh cookie, when that cookie is the
 * same player's. Other devices keep playing.
 *
 * A request that names no session (an access token from before families were
 * stamped into it, and no refresh cookie) ends all of the player's sessions,
 * as logout always did, rather than leaving the unnamed one open.
 *
 * @returns {Promise<number>} refresh-token rows removed
 */
export async function endSession(userId, { accessFamilyId, presentedRefreshToken } = {}) {
  const families = new Set();
  if (typeof accessFamilyId === 'string' && accessFamilyId.length > 0) {
    families.add(accessFamilyId);
  }
  const cookieFamily = await familyOfRefreshToken(prisma, presentedRefreshToken);
  if (cookieFamily && cookieFamily.userId === userId) {
    families.add(cookieFamily.familyId);
  }

  if (families.size === 0) {
    const ownFamilies = await prisma.refreshToken.findMany({
      where: { userId, familyId: { not: null } },
      distinct: ['familyId'],
      select: { familyId: true },
    });
    const removed = await prisma.refreshToken.deleteMany({ where: { userId } });
    forgetSessions(ownFamilies.map(row => row.familyId));
    return removed.count;
  }

  const removed = await prisma.refreshToken.deleteMany({
    where: { userId, familyId: { in: [...families] } },
  });
  forgetSessions(families);
  return removed.count;
}

/**
 * Two requests that presented the same refresh token while it was still live
 * (two tabs sharing one cookie jar refreshing at the same moment) both reach
 * the rotation; the database lets one rotate and the other finds the token
 * already rotated. That loser is not a thief — the token was live when it
 * arrived — so instead of a 401 that signs the tab out it gets a new access
 * token for the same session. It gets NO refresh token: the winner's response
 * carries the rotated one into the shared cookie jar.
 *
 * Only for that overlap. A token presented after its rotation committed is
 * reuse, and revokes its family as before; the browser keeps two tabs from
 * refreshing at once in the first place (frontend crossTabRefresh, Web Locks).
 *
 * @returns {Promise<{ accessToken: string, userId: string, familyId: string } | null>}
 */
export async function accessForConcurrentRotation(oldToken, decoded) {
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(oldToken) },
    select: { userId: true, familyId: true, isActive: true, isInvalidated: true },
  });
  if (
    !row ||
    row.isActive ||
    row.isInvalidated ||
    !row.familyId ||
    row.familyId !== decoded?.familyId ||
    row.userId !== decoded?.userId
  ) {
    return null;
  }
  const successor = await prisma.refreshToken.findFirst({
    where: { familyId: row.familyId, userId: row.userId, ...liveTokenWhere() },
    select: { id: true },
  });
  const user = await prisma.user.findUnique({
    where: { id: row.userId },
    select: { role: true },
  });
  if (!successor || !user) {
    return null;
  }
  return {
    accessToken: buildSignedAccessToken(row.userId, row.familyId, user.role ?? undefined),
    userId: row.userId,
    familyId: row.familyId,
  };
}
