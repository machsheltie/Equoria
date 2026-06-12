import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import { verifyWithKeyRing, getSigningSecret } from '../utils/jwtKeyRing.mjs';
import { AppError } from '../errors/index.mjs';
import logger from '../utils/logger.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
import { MS_PER_WEEK } from '../constants/time.mjs';

/**
 * Suspicious Activity Cache
 * Tracks suspicious authentication patterns for rate limiting
 */
const suspiciousActivityCache = new Map();

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

    req.user = user;
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

      if (!req.user.role || !roles.includes(req.user.role)) {
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
 * Admin MFA Enforcement Middleware (Equoria-te21j, OWASP A07)
 *
 * Optional policy: when `ADMIN_MFA_REQUIRED` is enabled, a user with
 * role=admin MUST have `mfaEnabled` to perform admin actions. Mount this
 * AFTER `requireRole('admin')` on the admin router so:
 *   - non-admins are already rejected by requireRole (this never runs for them)
 *   - only authenticated admins reach this gate
 *
 * Default OFF (flag unset/false) so existing admins are NOT locked out the
 * moment this ships — operators opt in deliberately after admins enroll.
 * To enable: set env `ADMIN_MFA_REQUIRED=true` (or `1`). Document the rollout
 * step (have all admins complete /api/v1/auth/mfa/enroll +
 * /mfa/verify-enrollment) BEFORE flipping the flag, or those admins will be
 * locked out of admin routes (login itself is unaffected — only admin-scoped
 * routes are gated, and they can still enroll via the authenticated MFA
 * endpoints).
 *
 * Fail-closed: a DB lookup error returns 500 (does NOT fall through to allow),
 * mirroring requireRole's Equoria-f8bp fail-closed contract.
 */
const ADMIN_MFA_REQUIRED_VALUES = new Set(['true', '1', 'yes', 'on']);

export function isAdminMfaEnforced(env = process.env.ADMIN_MFA_REQUIRED) {
  return typeof env === 'string' && ADMIN_MFA_REQUIRED_VALUES.has(env.trim().toLowerCase());
}

export const requireAdminMfa = async (req, res, next) => {
  try {
    if (!isAdminMfaEnforced()) {
      return next(); // policy disabled — no behavioral change
    }
    if (!req.user || !req.user.id) {
      // Should never happen (authenticateToken + requireRole ran first), but
      // fail closed rather than assume.
      throw new AppError('Authentication required', 401);
    }

    let user;
    try {
      user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { mfaEnabled: true },
      });
    } catch (lookupError) {
      logger.error(
        `[auth] requireAdminMfa DB lookup failed for user ${req.user.id}: ${lookupError.message}`,
      );
      return res.status(500).json({
        success: false,
        message: 'MFA verification unavailable. Please retry.',
        status: 'error',
      });
    }

    if (!user || user.mfaEnabled !== true) {
      logger.warn(
        `[auth] Admin ${req.user.id} blocked from ${req.method} ${req.path}: ADMIN_MFA_REQUIRED is on and MFA is not enabled for this account`,
      );
      throw new AppError(
        'Admin MFA required. Enroll a TOTP authenticator (POST /api/v1/auth/mfa/enroll then /mfa/verify-enrollment) before performing admin actions.',
        403,
      );
    }

    return next();
  } catch (error) {
    if (AppError.isAppError(error)) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        status: error.status,
      });
    }
    logger.error(`[auth] requireAdminMfa error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Authorization error',
      status: 'error',
    });
  }
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

/**
 * Clean up old cache entries periodically
 */
if (process.env.NODE_ENV !== 'test') {
  setInterval(
    () => {
      const now = Date.now();
      const maxAge = 10 * 60 * 1000; // 10 minutes

      for (const [userId, activities] of suspiciousActivityCache.entries()) {
        const recentActivities = activities.filter(activity => now - activity.timestamp < maxAge);

        if (recentActivities.length === 0) {
          suspiciousActivityCache.delete(userId);
        } else {
          suspiciousActivityCache.set(userId, recentActivities);
        }
      }
    },
    5 * 60 * 1000,
  ); // Clean every 5 minutes
}

// Export authenticateToken as the default export for backward compatibility
export default authenticateToken;
