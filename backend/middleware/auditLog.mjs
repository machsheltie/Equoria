import logger from '../utils/logger.mjs';
// import prisma from '../db/index.mjs'; // TODO: Implement audit logging

/**
 * Audit Logging Middleware
 * Tracks sensitive operations and detects suspicious patterns
 */

/**
 * Comprehensive audit logging for sensitive operations
 */
export const auditLog = (operationType, sensitivityLevel = 'medium') => {
  return async (req, res, next) => {
    // Skip audit logging in test environment
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined) {
      return next();
    }

    const startTime = Date.now();
    const originalSend = res.send;

    // Capture response data
    res.send = function (data) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Log the operation
      logOperation(req, res, operationType, sensitivityLevel, duration, data);

      // Call original send
      originalSend.call(this, data);
    };

    next();
  };
};

/**
 * Log operation details
 */
async function logOperation(req, res, operationType, sensitivityLevel, duration, responseData) {
  try {
    const logEntry = {
      timestamp: new Date(),
      userId: req.user?.id || null,
      userEmail: req.user?.email || null,
      userRole: req.user?.role || 'anonymous',
      operationType,
      sensitivityLevel,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      statusCode: res.statusCode,
      duration,
      requestBody: sanitizeLogData(req.body),
      requestParams: req.params,
      requestQuery: req.query,
      success: res.statusCode < 400,
    };

    // Add response data for failed operations
    if (res.statusCode >= 400) {
      logEntry.errorResponse = sanitizeLogData(responseData);
    }

    // Log to different levels based on sensitivity
    if (sensitivityLevel === 'high' || res.statusCode >= 400) {
      logger.warn('[audit] Sensitive operation:', logEntry);
    } else {
      logger.info('[audit] Operation logged:', {
        userId: logEntry.userId,
        operationType: logEntry.operationType,
        method: logEntry.method,
        path: logEntry.path,
        statusCode: logEntry.statusCode,
        duration: logEntry.duration,
      });
    }

    // Store in database for high-sensitivity operations
    if (sensitivityLevel === 'high') {
      await storeAuditLog(logEntry);
    }

    // Check for suspicious patterns
    await checkSuspiciousActivity(logEntry);
  } catch (error) {
    logger.error('[audit] Failed to log operation:', error);
  }
}

/**
 * Store audit log in database
 */
async function storeAuditLog(logEntry) {
  try {
    // Note: You'll need to create an audit_logs table in your schema
    // For now, we'll just log to file
    logger.warn('[audit] HIGH SENSITIVITY OPERATION:', logEntry);

    // TODO: Implement database storage
    // await prisma.auditLog.create({
    //   data: {
    //     userId: logEntry.userId,
    //     operationType: logEntry.operationType,
    //     method: logEntry.method,
    //     path: logEntry.path,
    //     ip: logEntry.ip,
    //     statusCode: logEntry.statusCode,
    //     duration: logEntry.duration,
    //     requestData: JSON.stringify(logEntry.requestBody),
    //     success: logEntry.success,
    //     timestamp: logEntry.timestamp
    //   }
    // });
  } catch (error) {
    logger.error('[audit] Failed to store audit log:', error);
  }
}

/**
 * Check for suspicious activity patterns
 */
const suspiciousActivityCache = new Map();

async function checkSuspiciousActivity(logEntry) {
  try {
    const { userId } = logEntry;
    if (!userId) {
      return;
    }

    const now = Date.now();
    const windowMs = 5 * 60 * 1000; // 5 minutes

    // Get user's recent activity
    let userActivity = suspiciousActivityCache.get(userId) || [];

    // Clean old entries
    userActivity = userActivity.filter(entry => now - entry.timestamp < windowMs);

    // Add current entry
    userActivity.push({
      timestamp: now,
      operationType: logEntry.operationType,
      statusCode: logEntry.statusCode,
      ip: logEntry.ip,
      path: logEntry.path,
    });

    // Update cache
    suspiciousActivityCache.set(userId, userActivity);

    // Check for suspicious patterns
    const suspiciousPatterns = detectSuspiciousPatterns(userActivity, logEntry);

    if (suspiciousPatterns.length > 0) {
      logger.error('[audit] SUSPICIOUS ACTIVITY DETECTED:', {
        userId,
        userEmail: logEntry.userEmail,
        patterns: suspiciousPatterns,
        recentActivity: userActivity.slice(-10), // Last 10 activities
      });

      // TODO: Implement alerting system
      // await sendSecurityAlert(userId, suspiciousPatterns);
    }
  } catch (error) {
    logger.error('[audit] Failed to check suspicious activity:', error);
  }
}

/**
 * Detect suspicious patterns in user activity
 */
function detectSuspiciousPatterns(userActivity) {
  const patterns = [];
  const now = Date.now();

  // Pattern 1: Too many failed requests
  const failedRequests = userActivity.filter(entry => entry.statusCode >= 400);
  if (failedRequests.length >= 10) {
    patterns.push({
      type: 'excessive_failures',
      count: failedRequests.length,
      severity: 'high',
    });
  }

  // Pattern 2: Rapid-fire requests (potential automation)
  const rapidRequests = userActivity.filter(
    entry => now - entry.timestamp < 30000, // Last 30 seconds
  );
  if (rapidRequests.length >= 20) {
    patterns.push({
      type: 'rapid_fire_requests',
      count: rapidRequests.length,
      severity: 'medium',
    });
  }

  // Pattern 3: Multiple IP addresses (account sharing/compromise)
  const uniqueIPs = new Set(userActivity.map(entry => entry.ip));
  if (uniqueIPs.size >= 3) {
    patterns.push({
      type: 'multiple_ip_addresses',
      ipCount: uniqueIPs.size,
      ips: Array.from(uniqueIPs),
      severity: 'high',
    });
  }

  // Pattern 4: Unusual operation patterns
  const sensitiveOps = userActivity.filter(entry =>
    ['breeding', 'training', 'transaction', 'stat_modification'].includes(entry.operationType),
  );
  if (sensitiveOps.length >= 15) {
    patterns.push({
      type: 'excessive_sensitive_operations',
      count: sensitiveOps.length,
      severity: 'medium',
    });
  }

  // Pattern 5: Error followed by success (potential exploit attempt)
  const recentEntries = userActivity.slice(-5);
  const hasErrorThenSuccess = recentEntries.some((entry, index) => {
    if (index === 0) {
      return false;
    }
    const prevEntry = recentEntries[index - 1];
    return (
      prevEntry.statusCode >= 400 &&
      entry.statusCode < 400 &&
      prevEntry.operationType === entry.operationType
    );
  });

  if (hasErrorThenSuccess) {
    patterns.push({
      type: 'error_then_success_pattern',
      severity: 'high',
    });
  }

  return patterns;
}

/**
 * Sanitize sensitive data for logging
 */
function sanitizeLogData(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'key',
    'auth',
    'credential',
    'ssn',
    'social',
    'credit',
    'card',
    'cvv',
    'pin',
  ];

  const sanitized = { ...data };

  for (const field of Object.keys(sanitized)) {
    const fieldLower = field.toLowerCase();
    if (sensitiveFields.some(sensitive => fieldLower.includes(sensitive))) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Middleware for specific operation types
 */
export const auditBreeding = auditLog('breeding', 'high');
export const auditTraining = auditLog('training', 'medium');
export const auditTransaction = auditLog('transaction', 'high');
export const auditStatModification = auditLog('stat_modification', 'high');
export const auditAuth = auditLog('authentication', 'high');
export const auditAdmin = auditLog('admin_operation', 'high');

/**
 * Clean up old cache entries periodically
 */
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

export default {
  auditLog,
  auditBreeding,
  auditTraining,
  auditTransaction,
  auditStatModification,
  auditAuth,
  auditAdmin,
};
