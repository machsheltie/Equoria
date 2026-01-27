import jwt from 'jsonwebtoken';
import { AppError } from '../errors/index.mjs';
import logger from '../utils/logger.mjs';

/**
 * JWT Authentication Middleware
 * Verifies JWT tokens and adds user information to request object
 */
export const authenticateToken = (req, res, next) => {
  const requestId = Math.random().toString(36).substring(7);
  logger.info(`[auth:${requestId}] Starting auth for ${req.method} ${req.path}`);
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
    logger.info(`[auth:${requestId}] Token from cookie: ${!!token}`);

    // Fallback to Authorization header for backward compatibility, but require Bearer scheme
    if (!token) {
      const authHeader = req.headers?.authorization;
      const hasBearerPrefix = typeof authHeader === 'string' && authHeader.startsWith('Bearer ');
      if (hasBearerPrefix) {
        const headerToken = authHeader.substring('Bearer '.length).trim();
        if (headerToken) {
          token = headerToken;
          logger.info(`[auth:${requestId}] Token from header: ${!!token}`);
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
      decoded = jwt.verify(token, secret, {
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
    const MAX_SESSION_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
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

    req.user = user;
    logger.info(`[auth:${requestId}] Authenticated user ${user.id}`);
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
 * Optional Authentication Middleware
 * Adds user information if token is present, but doesn't require it
 */
export const optionalAuth = (req, res, next) => {
  try {
    // Read token from httpOnly cookie (primary method)
    let token = req.cookies?.accessToken;

    // Fallback to Authorization header
    if (!token) {
      const authHeader = req.headers['authorization'];
      token = authHeader && authHeader.split(' ')[1];
    }

    if (!token) {
      return next(); // No token, continue without user
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      logger.error('[auth] JWT_SECRET not configured');
      return next(); // Continue without user if JWT not configured
    }

    // SECURITY: Strict JWT algorithm enforcement (must match authenticateToken)
    const SAFE_JWT_ALGORITHMS = ['HS256'];

    jwt.verify(
      token,
      secret,
      {
        algorithms: SAFE_JWT_ALGORITHMS,
        ignoreExpiration: false,
        ignoreNotBefore: false,
      },
      (err, decoded) => {
        if (!err && decoded) {
          // Map userId to id for backward compatibility
          const user = {
            ...decoded,
            id: decoded.userId || decoded.id,
          };
          req.user = user;
          logger.info(`[auth] Optional auth: authenticated user ${user.id}`);
        }
        next();
      },
    );
  } catch (error) {
    logger.warn(`[auth] Optional auth error: ${error.message}`);
    next(); // Continue without user on error
  }
};

/**
 * Role-based Authorization Middleware
 * Requires specific roles to access endpoints
 */
export const requireRole = (...roles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401);
      }

      if (!req.user.role || !roles.includes(req.user.role)) {
        logger.warn(
          `[auth] User ${req.user.id} with role '${req.user.role}' attempted to access ${req.method} ${req.path} (requires: ${roles.join(', ')})`,
        );
        throw new AppError('Insufficient permissions', 403);
      }

      logger.info(
        `[auth] Authorized user ${req.user.id} with role '${req.user.role}' for ${req.method} ${req.path}`,
      );
      next();
    } catch (error) {
      if (error instanceof AppError) {
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
  const secret = process.env.JWT_SECRET;
  if (!secret) {
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
 */
export const generateRefreshToken = payload => {
  // Add timestamp and random component to ensure uniqueness
  const uniquePayload = {
    ...payload,
    timestamp: Date.now(),
    random: Math.random().toString(36).substring(2),
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
