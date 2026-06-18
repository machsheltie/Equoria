/**
 * 🔄 Token Rotation Service (TDD GREEN Implementation Phase)
 *
 * Implements refresh token rotation and reuse detection security measures.
 * This service provides comprehensive token family management with security
 * features to prevent token compromise and unauthorized access.
 *
 * Security Features:
 * - Refresh token rotation on every use
 * - Token family tracking and management
 * - Reuse detection with family invalidation
 * - Concurrent request handling
 * - Token compromise protection
 *
 * Phase 1, Day 4-5: Token Rotation with Reuse Detection
 */

import jwt from 'jsonwebtoken';
import { verifyWithKeyRing } from './jwtKeyRing.mjs';
import crypto from 'crypto';
import { MS_PER_WEEK } from '../constants/time.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
import logger from './logger.mjs';

// Token configuration
const TOKEN_CONFIG = {
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
function _buildSignedTokenPair(userId, familyId, role) {
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
async function _persistRefreshTokenWithRetry({
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
        pair = _buildSignedTokenPair(userId, familyId, role);
        continue;
      }
      throw err;
    }
  }
  // Unreachable: loop either returns on success or throws above.
  throw new Error('refresh-token persistence exhausted retry budget');
}

/**
 * Create Token Pair (Access + Refresh)
 * Generates a new access/refresh token pair with family tracking
 *
 * Security Note: Includes unique JTI (JWT ID) claim for guaranteed uniqueness
 * even when multiple tokens are issued in the same millisecond.
 *
 * @param {string} userId
 * @param {string} [familyId] - Token family ID; generated if omitted.
 * @param {string} [role] - User role embedded in the access token so
 *   requireRole() can skip the per-request DB lookup (Equoria-ovp9).
 */
export async function createTokenPair(userId, familyId, role) {
  // Generate family ID if not provided
  if (!familyId) {
    familyId = generateTokenFamily();
  }

  let { accessToken, refreshToken } = _buildSignedTokenPair(userId, familyId, role);
  const expiresAt = new Date(Date.now() + MS_PER_WEEK); // 7 days

  // Equoria-x243u: createTokenPair NEVER materialises the user. Every real
  // caller (authController register/login, refresh) passes an already-persisted
  // user id, so user creation is the caller's responsibility — not a token
  // utility's. A prior `ensureUserExists()` helper here inserted a minimal
  // `User` row (with `password: 'test-bypass'`) when `NODE_ENV === 'test'`;
  // that is a test-only backdoor in a production code path (CLAUDE.md §2/§4)
  // and has been removed. Tests that need a user create one explicitly via the
  // real fixtures before calling this function.
  // Equoria-6fm0e: refresh-token persistence is now FAIL-LOUD in EVERY env. The
  // prior `catch (err) { if (NODE_ENV === 'test') { warn + swallow } else throw }`
  // was a test-only soft-catch living in a production code path — the same
  // backdoor class as the ensureUserExists() removal (x243u): on a real
  // persistence failure it returned UNPERSISTED tokens and only logged a
  // warning under test, masking the failure (CLAUDE.md §3 fail-closed /
  // EDGE_CASE_FIX_DISCIPLINE §3). Now that refresh_tokens.userId enforces its FK
  // (the Equoria-3spgs FK-drift fix landed canonical-DB-wide), a persistence
  // failure — e.g. a token insert for a non-existent userId — MUST propagate so
  // callers and tests observe it. No env-conditional swallow.
  const finalPair = await _persistRefreshTokenWithRetry({
    prismaClient: prisma,
    userId,
    familyId,
    expiresAt,
    initialPair: { accessToken, refreshToken },
    role,
  });
  accessToken = finalPair.accessToken;
  refreshToken = finalPair.refreshToken;

  logger.info('[TokenRotation] Created new token pair', {
    userId,
    familyId,
    accessTokenLength: accessToken.length,
    refreshTokenLength: refreshToken.length,
  });

  return {
    accessToken,
    refreshToken,
    familyId,
  };
}

/**
 * Validate Refresh Token
 * Verifies token signature and database state
 */
export async function validateRefreshToken(token) {
  try {
    // Basic token format validation
    if (!token || typeof token !== 'string') {
      return {
        isValid: false,
        error: 'Invalid token format',
        decoded: null,
      };
    }

    // Verify JWT signature and expiration.
    // Equoria-gjdj: verify against the refresh key ring (current secret first,
    // then optional JWT_REFRESH_SECRET_PREVIOUS during a rotation overlap
    // window). Refresh tokens are still SIGNED with the current secret only.
    let decoded;
    try {
      decoded = verifyWithKeyRing(token, 'refresh');
    } catch (jwtError) {
      return {
        isValid: false,
        error: jwtError.message,
        decoded: null,
      };
    }

    // Check token type
    if (decoded.type !== 'refresh') {
      return {
        isValid: false,
        error: 'Invalid token type',
        decoded: null,
      };
    }

    // Check database for token status (look up by hash, not raw JWT — Equoria-uy73)
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(token) },
    });

    if (!tokenRecord) {
      // Distinguish "this user has zero tokens at all" (system-level purge —
      // typically a destructive migration that wiped refresh tokens) from
      // "this specific token is gone while others remain" (genuine reuse
      // signal). The former is a session upgrade and must NOT poison the
      // reuse-detection audit log. See `docs/migration-deploy-checklist.md`.
      //
      // Cost note: this branch fires only when (a) the JWT signature
      // verifies AND (b) the tokenHash row is missing. That combination is
      // already an exceptional path (forged token from a leaked secret,
      // post-migration session, or post-logout-all). The extra count() is
      // therefore O(rare-event), not a per-request 2x amplification on the
      // hot path. Caching is rejected: a stale cache would mis-classify a
      // new login during the rare-event window as a system purge.
      const userTokenCount = await prisma.refreshToken.count({
        where: { userId: decoded.userId },
      });
      return {
        isValid: false,
        error: userTokenCount === 0 ? 'SESSION_UPGRADE_REQUIRED' : 'Token not found in database',
        decoded: null,
      };
    }

    if (!tokenRecord.isActive) {
      return {
        isValid: false,
        error: 'Token is inactive',
        decoded: null,
      };
    }

    if (tokenRecord.isInvalidated) {
      return {
        isValid: false,
        error: 'Token has been invalidated',
        decoded: null,
      };
    }

    // Check expiration in database (additional security layer)
    if (new Date() > tokenRecord.expiresAt) {
      return {
        isValid: false,
        error: 'Token has expired',
        decoded: null,
      };
    }

    return {
      isValid: true,
      error: null,
      decoded,
      tokenRecord,
    };
  } catch (error) {
    logger.error('[TokenRotation] Error validating refresh token:', error);
    return {
      isValid: false,
      error: 'Token validation failed',
      decoded: null,
    };
  }
}

/**
 * Detect Token Reuse
 * Identifies if a token has been used before (security violation)
 */
export async function detectTokenReuse(token) {
  try {
    // First validate token structure. If validateRefreshToken signals a
    // system-level session upgrade (zero tokens for this user — caused by
    // a destructive migration), propagate that as a non-reuse signal so the
    // audit log isn't poisoned with false reuse alerts.
    const validation = await validateRefreshToken(token);
    if (validation.error === 'SESSION_UPGRADE_REQUIRED') {
      return {
        isReuse: false,
        familyId: null,
        shouldInvalidateFamily: false,
        reason: 'SESSION_UPGRADE_REQUIRED',
      };
    }

    // If token is inactive, it might be reuse (look up by hash, not raw JWT)
    const tokenHash = hashRefreshToken(token);
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!tokenRecord) {
      return {
        isReuse: true,
        familyId: null,
        shouldInvalidateFamily: false,
        reason: 'Token not found',
      };
    }

    // If token is inactive but not invalidated, it's been used
    if (!tokenRecord.isActive && !tokenRecord.isInvalidated) {
      logger.warn('[TokenRotation] Token reuse detected', {
        userId: tokenRecord.userId,
        familyId: tokenRecord.familyId,
        // Log a hash prefix, never the raw token. Prior code logged 20 chars
        // of raw JWT — an attacker with log access could have exfiltrated
        // session material.
        tokenHashPrefix: tokenHash.substring(0, 12),
      });

      // Find all tokens in the same family for invalidation diagnostics.
      // Returns tokenHashes (never raw tokens — Equoria-uy73).
      const familyTokens = await prisma.refreshToken.findMany({
        where: { familyId: tokenRecord.familyId },
        select: { tokenHash: true },
      });

      return {
        isReuse: true,
        familyId: tokenRecord.familyId,
        shouldInvalidateFamily: true,
        reason: 'Token already used',
        affectedTokenHashes: familyTokens.map(t => t.tokenHash),
      };
    }

    return {
      isReuse: false,
      familyId: tokenRecord.familyId,
      shouldInvalidateFamily: false,
      reason: 'First use',
    };
  } catch (error) {
    logger.error('[TokenRotation] Error detecting token reuse:', error);
    return {
      isReuse: true,
      familyId: null,
      shouldInvalidateFamily: false,
      reason: 'Detection error',
    };
  }
}

/**
 * Rotate Refresh Token
 * Creates new token and invalidates old one
 */
export async function rotateRefreshToken(oldToken) {
  try {
    // First check for reuse
    const reuseDetection = await detectTokenReuse(oldToken);

    if (reuseDetection.isReuse) {
      // Invalidate entire family
      if (reuseDetection.familyId) {
        await invalidateTokenFamily(reuseDetection.familyId);
      }

      logger.warn('[TokenRotation] Token reuse detected during rotation', {
        familyId: reuseDetection.familyId,
        reason: reuseDetection.reason,
      });

      return {
        success: false,
        error: 'Token reuse detected - family invalidated',
        newTokenPair: null,
        familyInvalidated: true,
      };
    }

    // Validate old token
    const validation = await validateRefreshToken(oldToken);

    if (!validation.isValid) {
      return {
        success: false,
        error: validation.error,
        newTokenPair: null,
        familyInvalidated: false,
      };
    }

    // Use transaction to ensure atomicity. Two concurrent /api/v1/auth/refresh
    // calls with the same old token must not both succeed: validateRefreshToken
    // sees isActive:true for both before either tx starts, so we cannot rely
    // on the pre-transaction validation. Instead, atomically flip
    // isActive:true→false; if `count` is 0, another request already rotated
    // this token and we must abort to preserve the rotation/reuse contract.
    const result = await prisma.$transaction(async tx => {
      const upd = await tx.refreshToken.updateMany({
        where: { tokenHash: hashRefreshToken(oldToken), isActive: true },
        data: { isActive: false },
      });
      if (upd.count === 0) {
        const concurrentError = new Error('Token already rotated by a concurrent request');
        concurrentError.code = 'CONCURRENT_ROTATION';
        throw concurrentError;
      }

      // Create new token pair with same family ID. Persist via the shared
      // retry helper so a tokenHash collision (P2002) — possible after a
      // partial migration leaves stale rows — regenerates the JWT pair
      // automatically rather than surfacing a 500 to the user.
      const userId = validation.decoded.userId;
      const familyId = validation.decoded.familyId;
      const expiresAt = new Date(Date.now() + MS_PER_WEEK); // 7 days
      // Equoria-ovp9: look up the user's role so the rotated access token
      // carries it. This avoids a requireRole() DB round-trip on every admin-
      // guarded request after a token rotation. The lookup is within the
      // transaction so the role is consistent with the user row at rotation time.
      const userRecord = await tx.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      const rotationRole = userRecord?.role ?? undefined;
      const initialPair = _buildSignedTokenPair(userId, familyId, rotationRole);
      const finalPair = await _persistRefreshTokenWithRetry({
        prismaClient: tx,
        userId,
        familyId,
        expiresAt,
        role: rotationRole,
        initialPair,
      });

      return {
        accessToken: finalPair.accessToken,
        refreshToken: finalPair.refreshToken,
        familyId,
      };
    });

    logger.info('[TokenRotation] Token rotation successful', {
      userId: validation.decoded.userId,
      familyId: validation.decoded.familyId,
    });

    return {
      success: true,
      error: null,
      newTokenPair: result,
      // Equoria-plw0h: expose userId so the caller can bind the rotated CSRF
      // token to the same identifier authenticateToken will resolve next.
      userId: validation.decoded.userId,
      familyInvalidated: false,
    };
  } catch (error) {
    // Concurrent-rotation race: a parallel request beat us to flipping
    // isActive. The other request already issued a fresh pair to the legit
    // caller; the loser of the race returns a clean 401-equivalent without
    // poisoning the audit log or invalidating the family.
    if (error?.code === 'CONCURRENT_ROTATION') {
      logger.info('[TokenRotation] Concurrent rotation detected — losing request returns failure', {
        message: error.message,
      });
      return {
        success: false,
        error: 'Concurrent token rotation — please retry',
        newTokenPair: null,
        familyInvalidated: false,
      };
    }

    logger.error('[TokenRotation] Error rotating refresh token:', error);

    return {
      success: false,
      error: 'Token rotation failed',
      newTokenPair: null,
      familyInvalidated: false,
    };
  }
}

/**
 * Invalidate Token Family
 * Marks all tokens in a family as invalid (security breach response)
 */
export async function invalidateTokenFamily(familyId) {
  try {
    const updateResult = await prisma.refreshToken.updateMany({
      where: { familyId },
      data: {
        isActive: false,
        isInvalidated: true,
      },
    });

    // Get user info for logging
    const tokenRecord = await prisma.refreshToken.findFirst({
      where: { familyId },
      include: { user: { select: { id: true, email: true } } },
    });

    logger.warn('[TokenRotation] Token family invalidated', {
      familyId,
      invalidatedCount: updateResult.count,
      userId: tokenRecord?.user?.id,
      email: tokenRecord?.user?.email,
      reason: 'Security violation - token reuse detected',
    });

    return {
      success: true,
      invalidatedCount: updateResult.count,
      familyId,
    };
  } catch (error) {
    logger.error('[TokenRotation] Error invalidating token family:', error);
    return {
      success: false,
      invalidatedCount: 0,
      familyId,
      error: error.message,
    };
  }
}

/**
 * Cleanup Expired Tokens
 * Removes old and expired tokens from database
 */
export async function cleanupExpiredTokens(options = {}) {
  try {
    const { olderThanDays = TOKEN_CONFIG.CLEANUP_THRESHOLD_DAYS } = options;

    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

    // Delete expired tokens
    const expiredTokensResult = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          {
            AND: [{ isInvalidated: true }, { createdAt: { lt: cutoffDate } }],
          },
        ],
      },
    });

    logger.info('[TokenRotation] Token cleanup completed', {
      removedCount: expiredTokensResult.count,
      cutoffDate,
      olderThanDays,
    });

    return {
      removedCount: expiredTokensResult.count,
      expiredCount: expiredTokensResult.count, // Simplified for now
      invalidatedCount: 0, // Could be tracked separately
      cutoffDate,
    };
  } catch (error) {
    logger.error('[TokenRotation] Error cleaning up tokens:', error);
    return {
      removedCount: 0,
      expiredCount: 0,
      invalidatedCount: 0,
      error: error.message,
    };
  }
}
