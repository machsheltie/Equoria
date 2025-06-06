import jwt from 'jsonwebtoken';
import { AppError } from '../errors/index.mjs';
import logger from '../utils/logger.mjs';

/**
 * JWT Authentication Middleware
 * Verifies JWT tokens and adds user information to request object
 */
export const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      logger.warn(`[auth] Missing token for ${req.method} ${req.path} from ${req.ip}`);
      throw new AppError('Access token is required', 401);
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      logger.error('[auth] JWT_SECRET not configured');
      throw new AppError('Authentication configuration error', 500);
    }

    jwt.verify(token, secret, (err, user) => {
      if (err) {
        logger.warn(
          `[auth] Invalid token for ${req.method} ${req.path} from ${req.ip}: ${err.message}`,
        );

        if (err.name === 'TokenExpiredError') {
          throw new AppError('Token expired', 401);
        } else if (err.name === 'JsonWebTokenError') {
          throw new AppError('Invalid or expired token', 401);
        } else {
          throw new AppError('Token verification failed', 401);
        }
      }

      req.user = user;
      logger.info(`[auth] Authenticated user ${user.id} for ${req.method} ${req.path}`);
      next();
    });
  } catch (error) {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        status: error.status,
      });
    }

    logger.error(`[auth] Unexpected error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
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
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return next(); // No token, continue without user
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      logger.error('[auth] JWT_SECRET not configured');
      return next(); // Continue without user if JWT not configured
    }

    jwt.verify(token, secret, (err, user) => {
      if (!err && user) {
        req.user = user;
        logger.info(`[auth] Optional auth: authenticated user ${user.id}`);
      }
      next();
    });
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
 */
export const generateToken = (payload, expiresIn = '24h') => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new AppError('JWT_SECRET not configured', 500);
  }

  return jwt.sign(payload, secret, { expiresIn });
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

// Export authenticateToken as the default export for backward compatibility
export default authenticateToken;
