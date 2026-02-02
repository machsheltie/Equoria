/**
 * Session Management Middleware
 * Implements secure session handling to prevent session fixation and hijacking
 *
 * SECURITY: CWE-384 (Session Fixation), CWE-613 (Insufficient Session Expiration)
 */

import logger from '../utils/logger.mjs';
import prisma from '../db/index.mjs';

// Session timeout configuration (15 minutes of inactivity)
const SESSION_TIMEOUT_MS = parseInt(process.env.SESSION_TIMEOUT_MS || '900000', 10); // 15 minutes
const MAX_CONCURRENT_SESSIONS = parseInt(process.env.MAX_CONCURRENT_SESSIONS || '5', 10);

/**
 * Legacy in-memory session timeout middleware (used by unit tests)
 */
export const sessionTimeout = (timeoutMs = SESSION_TIMEOUT_MS) => (req, res, next) => {
  if (!req.session) {
    return next();
  }

  const createdAt = req.session.createdAt || Date.now();
  const lastActivity = req.session.lastActivity || createdAt;
  const age = Date.now() - lastActivity;

  if (age > timeoutMs) {
    return res.status(440).json({
      success: false,
      message: 'Session expired',
      status: 'error',
    });
  }

  req.session.lastActivity = Date.now();
  return next();
};

/**
 * Legacy in-memory session concurrency limiter (used by unit tests)
 */
export const sessionConcurrencyLimit = (maxSessions = MAX_CONCURRENT_SESSIONS, store = new Map()) => {
  return (req, res, next) => {
    if (!req.session || !req.session.userId || !maxSessions) {
      return next();
    }

    const sessions = store.get(req.session.userId) || [];
    if (!sessions.includes(req.session.sessionId) && sessions.length >= maxSessions) {
      return res.status(403).json({
        success: false,
        message: 'Maximum concurrent sessions exceeded',
        status: 'error',
      });
    }

    if (!sessions.includes(req.session.sessionId)) {
      store.set(req.session.userId, [...sessions, req.session.sessionId]);
    }

    return next();
  };
};

/**
 * Legacy in-memory session cleanup middleware (used by unit tests)
 */
export const sessionCleanup = (timeoutMs = SESSION_TIMEOUT_MS, store = new Map()) => {
  return (req, res, next) => {
    const now = Date.now();
    for (const [sessionId, session] of store.entries()) {
      const lastActivity = session.lastActivity || session.createdAt || now;
      if (now - lastActivity > timeoutMs) {
        store.delete(sessionId);
      }
    }

    if (req.session && req.session.sessionId && req.session.userId) {
      store.set(req.session.sessionId, {
        userId: req.session.userId,
        lastActivity: now,
      });
    }

    return next();
  };
};

/**
 * Track last activity time for session timeout
 * Automatically logs out users after period of inactivity
 */
export const trackSessionActivity = async (req, res, next) => {
  // Only track for authenticated requests
  if (!req.user || !req.user.id) {
    return next();
  }

  const userId = req.user.id;
  const now = Date.now();

  // Get refresh token from cookie
  const refreshToken = req.cookies?.refreshToken;

  if (refreshToken) {
    try {
      // Update last activity timestamp
      const storedToken = await prisma.refreshToken.findFirst({
        where: {
          token: refreshToken,
          userId,
        },
      });

      if (storedToken) {
        const lastActivity = storedToken.lastActivityAt
          ? new Date(storedToken.lastActivityAt).getTime()
          : storedToken.createdAt.getTime();

        const inactiveDuration = now - lastActivity;

        // Check if session has expired due to inactivity
        if (inactiveDuration > SESSION_TIMEOUT_MS) {
          logger.warn('[Session] Session expired due to inactivity', {
            userId,
            inactiveDuration: `${Math.floor(inactiveDuration / 1000)}s`,
            threshold: `${Math.floor(SESSION_TIMEOUT_MS / 1000)}s`,
          });

          // Delete expired session
          await prisma.refreshToken.delete({
            where: { id: storedToken.id },
          });

          // Clear cookies
          res.clearCookie('accessToken');
          res.clearCookie('refreshToken');

          return res.status(401).json({
            success: false,
            error: 'Session expired due to inactivity. Please login again.',
            code: 'SESSION_TIMEOUT',
          });
        }

        // Update last activity timestamp
        await prisma.refreshToken.update({
          where: { id: storedToken.id },
          data: { lastActivityAt: new Date() },
        });

        logger.debug('[Session] Activity tracked', {
          userId,
          lastActivity: new Date(lastActivity).toISOString(),
        });
      }
    } catch (error) {
      logger.error('[Session] Error tracking session activity:', error);
      // Don't fail the request, just log the error
    }
  }

  next();
};

/**
 * Enforce maximum concurrent sessions per user
 * Prevents session hijacking and credential sharing
 */
export const enforceConcurrentSessions = async (req, res, next) => {
  // Only enforce for authenticated requests
  if (!req.user || !req.user.id) {
    return next();
  }

  const userId = req.user.id;

  try {
    // Count active sessions
    const activeSessions = await prisma.refreshToken.count({
      where: { userId },
    });

    if (activeSessions > MAX_CONCURRENT_SESSIONS) {
      logger.warn('[Session] Too many concurrent sessions', {
        userId,
        activeSessions,
        maxAllowed: MAX_CONCURRENT_SESSIONS,
      });

      // Delete oldest sessions (keep only MAX_CONCURRENT_SESSIONS most recent)
      const oldestSessions = await prisma.refreshToken.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        take: activeSessions - MAX_CONCURRENT_SESSIONS,
      });

      if (oldestSessions.length > 0) {
        await prisma.refreshToken.deleteMany({
          where: {
            id: {
              in: oldestSessions.map((s) => s.id),
            },
          },
        });

        logger.info('[Session] Removed oldest sessions to enforce limit', {
          userId,
          removedCount: oldestSessions.length,
        });
      }
    }
  } catch (error) {
    logger.error('[Session] Error enforcing concurrent sessions:', error);
    // Don't fail the request, just log the error
  }

  next();
};

/**
 * Add session security headers to response
 */
export const addSessionSecurityHeaders = (req, res, next) => {
  // Prevent session fixation by setting new session ID on login
  // This is handled in authController by generating new tokens

  // Add cache control to prevent sensitive data caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  next();
};

/**
 * Get active sessions for current user (for account security page)
 */
export const getActiveSessions = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const sessions = await prisma.refreshToken.findMany({
      where: { userId: req.user.id },
      select: {
        id: true,
        createdAt: true,
        lastActivityAt: true,
        expiresAt: true,
        // Don't expose the actual token
      },
      orderBy: { lastActivityAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      data: {
        sessions: sessions.map((s) => ({
          id: s.id,
          createdAt: s.createdAt,
          lastActivity: s.lastActivityAt || s.createdAt,
          expiresAt: s.expiresAt,
          isCurrent: req.cookies?.refreshToken === s.token, // Can't check directly, approximate
        })),
        maxConcurrent: MAX_CONCURRENT_SESSIONS,
        sessionTimeout: SESSION_TIMEOUT_MS,
      },
    });
  } catch (error) {
    logger.error('[Session] Error fetching active sessions:', error);
    next(error);
  }
};

/**
 * Revoke specific session (logout from specific device)
 */
export const revokeSession = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID required',
      });
    }

    // Delete the session (only if it belongs to current user)
    const deletedSession = await prisma.refreshToken.deleteMany({
      where: {
        id: parseInt(sessionId, 10),
        userId: req.user.id,
      },
    });

    if (deletedSession.count === 0) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or already revoked',
      });
    }

    logger.info('[Session] Session revoked by user', {
      userId: req.user.id,
      sessionId,
    });

    res.status(200).json({
      success: true,
      message: 'Session revoked successfully',
    });
  } catch (error) {
    logger.error('[Session] Error revoking session:', error);
    next(error);
  }
};
