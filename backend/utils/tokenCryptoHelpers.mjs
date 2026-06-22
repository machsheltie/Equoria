/**
 * 🔐 Token Crypto Helpers
 *
 * Pure / persistence helpers extracted from tokenRotationService.mjs
 * (Equoria-urqic.7 file-size split): the token-config constants, the refresh-
 * token at-rest hash, the token-family ID generator, the signed JWT-pair
 * builder, and the P2002-retrying refresh-token persistence helper.
 *
 * This module owns NO interactive `prisma.$transaction` and NO retryable-tx
 * wrapping — those (the auth `/refresh` rotation tx + its Equoria-2ksil 503
 * mapping) stay in tokenRotationService.mjs. `_persistRefreshTokenWithRetry`
 * takes a `prismaClient` parameter so callers pass either the global prisma or
 * a transaction client (`tx`), keeping this module agnostic of the tx boundary.
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import logger from './logger.mjs';

// Token configuration
export const TOKEN_CONFIG = {
  ACCESS_TOKEN_EXPIRY: '15m', // 15 minutes
  REFRESH_TOKEN_EXPIRY: '7d', // 7 days
  FAMILY_ID_LENGTH: 32, // 32 character family ID
  CLEANUP_THRESHOLD_DAYS: 30, // Cleanup tokens older than 30 days
};

/**
 * Hash a refresh token for at-rest storage.
 *
 * Equoria-uy73 (2026-04-23): raw JWTs are never persisted. The DB stores only
 * this SHA-256 hex digest. A DB read leak therefore yields hashes, not
 * forgeable tokens. The raw refresh token is only ever in memory (issued to
 * the client, HMAC-verified on inbound) and in the client's httpOnly cookie.
 *
 * SHA-256 is acceptable here (not bcrypt) because the token itself has 256
 * bits of pre-hash entropy and a 7-day lifetime — offline brute force is
 * infeasible and no credential-stuffing class of attacks applies.
 */
export function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate Unique Token Family ID
 * Creates a cryptographically secure family identifier
 */
export function generateTokenFamily() {
  const timestamp = Date.now().toString(36);
  const randomBytes = crypto.randomBytes(16).toString('hex');
  return `${timestamp}_${randomBytes}`;
}

/**
 * Build a fresh signed JWT pair with unique JTIs. Pure — no DB I/O.
 * Returned pair is guaranteed to differ across calls (16-byte random JTI).
 *
 * @param {string} userId
 * @param {string} familyId
 * @param {string} [role] - Optional user role embedded in the access token so
 *   requireRole() can skip the per-request DB lookup when the role is already
 *   present (Equoria-ovp9). Falls back gracefully when omitted (legacy callers
 *   and the rotate path before a DB role lookup is performed).
 */
export function buildSignedTokenPair(userId, familyId, role) {
  const timestamp = Date.now();
  const nanoTime = process.hrtime.bigint();
  const randomBytes = crypto.randomBytes(16).toString('hex');
  const accessJti = `access-${timestamp}-${nanoTime}-${randomBytes}`;
  const refreshJti = `refresh-${timestamp}-${nanoTime}-${randomBytes}`;
  const accessPayload = {
    userId,
    ...(role ? { role } : {}),
    type: 'access',
    jti: accessJti,
    iat: Math.floor(Date.now() / 1000),
  };
  const refreshPayload = {
    userId,
    type: 'refresh',
    familyId,
    jti: refreshJti,
    iat: Math.floor(Date.now() / 1000),
  };
  const accessToken = jwt.sign(accessPayload, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY,
  });
  const refreshToken = jwt.sign(refreshPayload, process.env.JWT_REFRESH_SECRET, {
    algorithm: 'HS256',
    expiresIn: TOKEN_CONFIG.REFRESH_TOKEN_EXPIRY,
  });
  return { accessToken, refreshToken };
}

/**
 * Persist a refresh-token row, regenerating the JWT pair on a tokenHash
 * unique-constraint collision (Prisma P2002). Astronomically rare in normal
 * operation; possible after a partial migration leaves stale rows.
 *
 * Uses `prismaClient` parameter so callers can pass either the global prisma
 * or a transaction client (`tx`).
 */
export async function persistRefreshTokenWithRetry({
  prismaClient,
  userId,
  familyId,
  expiresAt,
  initialPair,
  role,
}) {
  const MAX_ATTEMPTS = 3;
  let pair = initialPair;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await prismaClient.refreshToken.create({
        data: {
          tokenHash: hashRefreshToken(pair.refreshToken),
          userId,
          familyId,
          expiresAt,
          isActive: true,
          isInvalidated: false,
        },
      });
      return pair;
    } catch (err) {
      if (err?.code === 'P2002' && attempt < MAX_ATTEMPTS) {
        logger.warn('[TokenRotation] tokenHash collision (P2002), regenerating JWT pair', {
          attempt,
          userId,
        });
        pair = buildSignedTokenPair(userId, familyId, role);
        continue;
      }
      throw err;
    }
  }
  // Unreachable: loop either returns on success or throws above.
  throw new Error('refresh-token persistence exhausted retry budget');
}
