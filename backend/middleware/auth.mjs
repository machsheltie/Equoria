import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import { verifyWithKeyRing, getSigningSecret } from '../utils/jwtKeyRing.mjs';
import { AppError } from '../errors/index.mjs';
import logger from '../utils/logger.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
import { MS_PER_WEEK } from '../constants/time.mjs';
import { cachedAccountStanding, satisfiesRole, standingRefusal } from '../modules/staff/index.mjs';

/**
 * In-memory TTL cache for User.passwordChangedAt — Equoria-2bbf.
 * Removes the per-request DB lookup the CWE-613 check (Equoria-39r5) would
 * otherwise perform on every authenticated route.
 *
 * Entry shape: { value: Date | null, expiresAt: number }
 *   value === null → user has never rotated; no constraint.
 *   value === Date → reject tokens with iat < floor(value/1000) seconds.
 *
 * Eviction:
 * - On every successful changePassword / resetPassword (explicit eviction
 *   so the next request reads the fresh DB value immediately).
 * - On TTL expiry (~30s) for resilience against missed evictions.
 */
const PASSWORD_CHANGED_AT_CACHE_TTL_MS = 30_000;
const passwordChangedAtCache = new Map();

const getCachedPasswordChangedAt = userId => {
  const entry = passwordChangedAtCache.get(userId);
  if (!entry) {
    return undefined;
  } // miss
  if (entry.expiresAt <= Date.now()) {
    passwordChangedAtCache.delete(userId); // lazy expiry
    return undefined; // miss
  }
  return entry.value; // hit (Date or null)
};

const setCachedPasswordChangedAt = (userId, value) => {
  passwordChangedAtCache.set(userId, {
    value,
    expiresAt: Date.now() + PASSWORD_CHANGED_AT_CACHE_TTL_MS,
  });
};

/**
 * Evict a user's passwordChangedAt cache entry.
 * MUST be called by changePassword / resetPassword after a successful DB
 * update so the next authenticated request reads the freshly-stamped value.
 */
export const evictPasswordChangedAtCache = userId => {
  if (typeof userId === 'string' && userId.length > 0) {
    passwordChangedAtCache.delete(userId);
  }
};

/**
 * Presence (Equoria-vc5x1): record when an account was last active, at most once
 * a minute per account, so the Need Help? page can show who is online.
 *
 * Best-effort and off the request path: it writes the separate user_presence
 * table (never the User row, never inside another transaction), is not awaited,
 * and a failure only logs. The User row is deliberately left alone: a write to
 * it from every request would interfere with the lock-order and settings
 * compare-and-swap guarantees player-state transactions depend on.
 */
const lastActiveStampIntervalMs = 60_000;
const lastActiveStamped = new Map();

const stampLastActive = (userId, requestId) => {
  const nowMs = Date.now();
  const stampedAt = lastActiveStamped.get(userId);
  if (stampedAt !== undefined && nowMs - stampedAt < lastActiveStampIntervalMs) {
    return;
  }
  lastActiveStamped.set(userId, nowMs);
  const now = new Date(nowMs);
  Promise.resolve()
    .then(() =>
      prisma.userPresence.upsert({
        where: { userId },
        create: { userId, lastActiveAt: now },
        update: { lastActiveAt: now },
      }),
    )
    .catch(stampError => {
      // Presence is a convenience: a failed stamp must never fail authentication.
      lastActiveStamped.delete(userId);
      logger.warn(`[auth:${requestId}] presence stamp failed: ${stampError.message}`);
    });
};

/**
 * Generate a per-request correlation ID for auth log lines (Equoria-dew6i).
 *
 * Uses a CSPRNG (`crypto.randomBytes`) rather than `Math.random()`. The
 * previous `Math.random().toString(36).substring(7)` form (V8 Xorshift128+)
 * is not cryptographically secure and produces a short, variable-length,
 * non-uniform token. Request/correlation IDs that surface in auth logs must
 * be unpredictable so they cannot be guessed/forged to spoof or correlate
 * against a victim's log trail. Returns a fixed-length 16-char lowercase hex
 * string (8 bytes of entropy).
 */
export const generateRequestId = () => randomBytes(8).toString('hex');

/**
 * JWT Authentication Middleware
 * Verifies JWT tokens and adds user information to request object.
 * CWE-613 mitigation: rejects tokens whose `iat` predates the user's
 * passwordChangedAt timestamp — closes the residual access-token-TTL window
 * after a password rotation.
 */
export const authenticateToken = async (req, res, next) => {
  const requestId = generateRequestId();
  logger.debug(`[auth:${requestId}] Starting auth for ${req.method} ${req.path}`);
  try {
    const respondUnauthorized = (message, logFn = 'warn') => {
      logger[logFn](`[auth:${requestId}] ${message} for ${req.method} ${req.path} from ${req.ip}`);
      return res.status(401).json({
        success: false,
        message,
        status: 'error',
      });
    };

    // Read token from httpOnly cookie (primary method)
    let token = req.cookies?.accessToken;
    // Equoria-lax36: record HOW the JWT was presented so the CSRF middleware
    // (resolveSessionIdentifier) can tell a cookie-based session (CSRF-able →
    // bind the CSRF token to req.user.id) from a Bearer-HEADER session
    // (not CSRF-able → must NOT bind to req.user.id, since the CSRF token was
    // issued under the salt/refresh identifier). See csrf.mjs.
    let authTokenSource = token ? 'cookie' : null;
    logger.debug(`[auth:${requestId}] Token from cookie: ${!!token}`);

    // Fallback to Authorization header for backward compatibility, but require Bearer scheme
    if (!token) {
      const authHeader = req.headers?.authorization;
      const hasBearerPrefix = typeof authHeader === 'string' && authHeader.startsWith('Bearer ');
      if (hasBearerPrefix) {
        const headerToken = authHeader.substring('Bearer '.length).trim();
        if (headerToken) {
          token = headerToken;
          authTokenSource = 'header';
          logger.debug(`[auth:${requestId}] Token from header: ${!!token}`);
        }
      } else if (authHeader) {
        return respondUnauthorized('Access token is required');
      }
    }

    if (!token || token === 'null' || token === 'undefined') {
      return respondUnauthorized('Access token is required');
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      logger.error(`[auth:${requestId}] JWT_SECRET not configured`);
      return res.status(500).json({
        success: false,
        message: 'Authentication configuration error',
        status: 'error',
      });
    }

    // Pre-decode to check expiration without throwing for known expired tokens
    let decodedPreview = null;
    try {
      decodedPreview = jwt.decode(token);
    } catch (err) {
      logger.warn(`[auth:${requestId}] Token decode failed: ${err.message}`);
      return respondUnauthorized('Invalid or expired token');
    }

    if (!decodedPreview) {
      return respondUnauthorized('Invalid or expired token');
    }

    if (decodedPreview?.exp && decodedPreview.exp * 1000 <= Date.now()) {
      logger.warn(`[auth:${requestId}] Token expired (precheck)`);
      return respondUnauthorized('Token expired');
    }

    // SECURITY: Strict JWT algorithm enforcement to prevent algorithm confusion attacks (CWE-327)
    // Only accept HS256 - the exact algorithm used for token generation
    // This prevents:
    // 1. Algorithm "none" attacks (token forgery without signature)
    // 2. Algorithm confusion attacks (HS256 vs RS256)
    // 3. Algorithm upgrade attacks (attacker using HS384/HS512 to bypass validation)
    // CRITICAL: Must match the algorithm used in generateToken() and tokenRotationService.mjs
    const SAFE_JWT_ALGORITHMS = ['HS256'];

    let decoded;
    try {
      // Equoria-gjdj: verify against the JWT key ring (current secret first,
      // then optional JWT_SECRET_PREVIOUS during a rotation overlap window).
      // Signing still uses the CURRENT secret only — see jwtKeyRing.mjs.
      decoded = verifyWithKeyRing(token, 'access', {
        algorithms: SAFE_JWT_ALGORITHMS,
        ignoreExpiration: false,
        ignoreNotBefore: false,
      });
    } catch (err) {
      logger.warn(`[auth:${requestId}] Verify failed: ${err.message}`);

      const isExpired =
        err.name === 'TokenExpiredError' || err.message?.toLowerCase().includes('expired');

      return respondUnauthorized(isExpired ? 'Token expired' : 'Invalid or expired token');
    }

    // Equoria-hd3sq: Reject tokens that are not access tokens.
    // Challenge tokens (type='mfa_challenge'), refresh tokens (type='refresh'),
    // and any other token types must NOT be accepted as full access.
    // This prevents MFA bypass via challenge-token confusion.
    if (decoded.type && decoded.type !== 'access') {
      logger.warn(
        `[auth:${requestId}] Token rejected: invalid type '${decoded.type}' (expected 'access')`,
      );
      return respondUnauthorized('Invalid or expired token');
    }

    // CWE-613 MITIGATION: Enforce absolute 7-day maximum session age
    const MAX_SESSION_AGE_MS = MS_PER_WEEK; // 7 days
    const SESSION_CLOCK_SKEW_MS = 10000; // 10 seconds tolerance for clock drift
    const tokenAge = decoded.iat ? Date.now() - decoded.iat * 1000 : 0;

    if (tokenAge - SESSION_CLOCK_SKEW_MS > MAX_SESSION_AGE_MS) {
      logger.warn(`[auth:${requestId}] Session too old`);
      return respondUnauthorized('Session expired. Please login again.');
    }

    // Map userId to id for backward compatibility
    const user = {
      ...decoded,
      id: decoded.userId || decoded.id,
    };

    // CWE-613 MITIGATION: reject access tokens issued before the user's
    // last password rotation. Tokens are signed with iat in SECONDS; the DB
    // column `passwordChangedAt` is millisecond-precision. We floor the DB
    // value to whole seconds so a same-second login (iat = N) immediately
    // after a password change at N.500 is still accepted — the granularity
    // of iat means tokens issued anywhere within a single second are
    // indistinguishable. The 1-second window of legacy-token validity at
    // change time is the unavoidable cost of second-precision iat; in
    // practice the user takes far longer than 1s to re-authenticate.
    // Null `passwordChangedAt` (users who have never rotated) = no constraint.
    // The User.id column is a string UUID — skip the lookup for non-string ids
    // (forged or unit-test mock tokens). Downstream handlers will reject any
    // malformed id when they try their own DB lookups.
    if (decoded.iat && typeof user.id === 'string' && user.id.length > 0) {
      // Equoria-2bbf: read cache first; fall back to DB on miss/expiry.
      // Eviction is performed by changePassword/resetPassword on rotation.
      let passwordChangedAt = getCachedPasswordChangedAt(user.id);
      if (passwordChangedAt === undefined) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { passwordChangedAt: true },
          });
          // Cache the value (may be null for users who have never rotated).
          // Only populate when we successfully read; on lookup error we
          // fail-closed below without touching the cache.
          passwordChangedAt = dbUser ? dbUser.passwordChangedAt : null;
          setCachedPasswordChangedAt(user.id, passwordChangedAt);
        } catch (lookupError) {
          // Fail-closed on DB lookup errors in this security-critical check.
          // (Per security boundary discipline: a transient DB failure must not
          // become an authentication bypass for stale tokens.)
          logger.error(
            `[auth:${requestId}] passwordChangedAt lookup failed for user ${user.id}: ${lookupError.message}`,
          );
          return respondUnauthorized('Authentication unavailable. Please retry.');
        }
      }
      if (passwordChangedAt && decoded.iat < Math.floor(passwordChangedAt.getTime() / 1000)) {
        logger.warn(
          `[auth:${requestId}] Token rejected: iat predates passwordChangedAt for user ${user.id}`,
        );
        return respondUnauthorized('Session invalidated. Please login again.');
      }
    }

    // Equoria-w47x7: a frozen or banned account cannot act. Read through a short
    // cache that every conduct action evicts, so it bites on the next request.
    if (typeof user.id === 'string' && user.id.length > 0) {
      let standing;
      try {
        standing = await cachedAccountStanding(user.id);
      } catch (standingError) {
        logger.error(
          `[auth:${requestId}] conduct standing lookup failed for user ${user.id}: ${standingError.message}`,
        );
        return respondUnauthorized('Authentication unavailable. Please retry.');
      }
      const refusal = standingRefusal(standing);
      if (refusal) {
        logger.warn(
          `[auth:${requestId}] Request refused: account ${standing.state} for user ${user.id}`,
        );
        return res.status(refusal.status).json(refusal.body);
      }
    }

    req.user = user;
    if (typeof user.id === 'string' && user.id.length > 0) {
      stampLastActive(user.id, requestId);
    }
    // Equoria-lax36: expose the token source for the CSRF session-identifier
    // resolver. 'cookie' → CSRF-able session, bind to user.id; 'header' →
    // not CSRF-able, do NOT bind to user.id (see csrf.mjs resolveSessionIdentifier).
    req.authTokenSource = authTokenSource;
    logger.debug(`[auth:${requestId}] Authenticated user ${user.id}`);
    next();
  } catch (error) {
    logger.error(`[auth:${requestId}] Unexpected error: ${error.message}`);
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
      status: 'error',
    });
  }
};

/**
 * Role-based Authorization Middleware
 * Requires specific roles to access endpoints
 */
export const requireRole = (...roles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      // Equoria-ovp9: `createTokenPair` now embeds `role` in the access-token
      // payload, so `req.user.role` is already populated by `authenticateToken`
      // for tokens issued after this change. Skip the DB lookup when the role
      // is present. Retain the fallback lookup for stale tokens (issued before
      // the role field was added) so they continue to work through their TTL.
      if (!req.user.role && req.user.id) {
        try {
          const record = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { role: true },
          });
          if (record?.role) {
            req.user.role = record.role;
          }
        } catch (lookupError) {
          // Fail-closed on DB lookup errors — consistent with the passwordChangedAt
          // catch block in authenticateToken above. A transient DB failure must not
          // silently fall through to the role-check, which would return a misleading
          // 403 "Insufficient permissions" to a valid admin user (Equoria-f8bp).
          logger.error(
            `[auth] requireRole DB lookup failed for user ${req.user.id}: ${lookupError.message}`,
          );
          return res.status(500).json({
            success: false,
            message: 'Role verification unavailable. Please retry.',
            status: 'error',
          });
        }
      }

      // Equoria-4tleh: the staff policy decides whether the account's role
      // satisfies a named role, so the owner passes every admin gate.
      if (!req.user.role || !roles.some(role => satisfiesRole(req.user.role, role))) {
        logger.warn(
          `[auth] User ${req.user.id} with role '${req.user.role}' attempted to access ${req.method} ${req.path} (requires: ${roles.join(', ')})`,
        );
        throw new AppError('Insufficient permissions', 403);
      }

      logger.debug(
        `[auth] Authorized user ${req.user.id} with role '${req.user.role}' for ${req.method} ${req.path}`,
      );
      next();
    } catch (error) {
      // Symbol-marker check survives module-cache duplication
      // (jest.unstable_mockModule etc.); see errors/AppError.mjs comment.
      if (AppError.isAppError(error)) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
          status: error.status,
        });
      }

      logger.error(`[auth] Authorization error: ${error.message}`);
      return res.status(500).json({
        success: false,
        message: 'Authorization error',
        status: 'error',
      });
    }
  };
};

/**
 * Generate JWT Token
 * SECURITY: Explicitly specifies HS256 algorithm to match verification requirements
 */
export const generateToken = (payload, expiresIn = '24h') => {
  // Equoria-gjdj: sign with the CURRENT access secret via the key ring.
  // The key ring never returns the previous secret for signing.
  let secret;
  try {
    secret = getSigningSecret('access');
  } catch {
    throw new AppError('JWT_SECRET not configured', 500);
  }

  // SECURITY: Explicitly specify algorithm to prevent any potential mismatch
  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    expiresIn,
  });
};

/**
 * Generate Refresh Token
 *
 * Adds a CSPRNG-derived uniqueness padding (16 random bytes / 32 hex chars)
 * so the resulting JWT — and downstream `tokenHash` columns — cannot be
 * predicted from clock-aligned guesses. `Math.random()` (V8 Xorshift128+)
 * was used here historically; it is not cryptographically secure and is
 * statistically attackable given the otherwise-known payload structure
 * (userId, role, familyId, iat, exp). See Equoria-hmp59.
 */
export const generateRefreshToken = payload => {
  const uniquePayload = {
    ...payload,
    timestamp: Date.now(),
    random: randomBytes(16).toString('hex'),
  };
  return generateToken(uniquePayload, '7d');
};

// Export authenticateToken as the default export for backward compatibility
export default authenticateToken;
