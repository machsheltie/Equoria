import logger from '../utils/logger.mjs';
import prisma from '../../packages/database/prismaClient.mjs';
import { trackSecurityEventWithThreshold, SecurityEventTypes } from '../config/sentry.mjs';

/**
 * Audit Logging Middleware
 * Tracks sensitive operations and detects suspicious patterns.
 *
 * Equoria-jw10w (OWASP A09): sensitive mutating operations are persisted to a
 * tamper-evident, queryable `AuditLog` DB table (see storeAuditLog below) and
 * enforced globally by construction via `globalAuditTrail` — NOT opt-in
 * per-route. Read (GET/HEAD/OPTIONS) traffic is intentionally NOT persisted:
 * the audit trail scopes to state-changing verbs (POST/PUT/PATCH/DELETE) on
 * the sensitive prefixes enumerated in SENSITIVE_AUDIT_PREFIXES. Audit writes
 * are best-effort/fail-soft: a write failure logs and is swallowed — it must
 * never break, delay-block, or 500 the underlying request.
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

      // Track authentication failures in Sentry
      if (operationType === 'authentication' && res.statusCode === 401) {
        trackSecurityEventWithThreshold(
          SecurityEventTypes.AUTH_FAILURE,
          {
            userId: logEntry.userId,
            userEmail: logEntry.userEmail,
            ip: logEntry.ip,
            path: logEntry.path,
            statusCode: logEntry.statusCode,
          },
          logEntry.ip, // Use IP as identifier for threshold tracking
        );
      }

      // Track ownership violations in Sentry
      if (operationType === 'ownership_check' && res.statusCode === 403) {
        trackSecurityEventWithThreshold(
          SecurityEventTypes.OWNERSHIP_VIOLATION,
          {
            userId: logEntry.userId,
            userEmail: logEntry.userEmail,
            ip: logEntry.ip,
            path: logEntry.path,
            statusCode: logEntry.statusCode,
          },
          logEntry.userId || logEntry.ip, // Use userId or IP as identifier
        );
      }
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
 * Derive the logical resource + (best-effort) resource id from a request path.
 * `/api/auth/register` -> { resource: 'auth' }
 * `/api/v1/horses/42`  -> { resource: 'horses', resourceId: '42' }
 */
function deriveResource(path) {
  if (!path || typeof path !== 'string') {
    return { resource: null, resourceId: null };
  }
  const segments = path.split('?')[0].split('/').filter(Boolean);
  // Drop leading 'api' and an optional version segment ('v1', 'v2', …).
  let idx = 0;
  if (segments[idx] === 'api') {
    idx += 1;
  }
  if (segments[idx] && /^v\d+$/.test(segments[idx])) {
    idx += 1;
  }
  const resource = segments[idx] || null;
  // A numeric / uuid-ish segment immediately after the resource is its id.
  const candidate = segments[idx + 1];
  const looksLikeId =
    candidate &&
    (/^\d+$/.test(candidate) ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidate));
  return { resource, resourceId: looksLikeId ? candidate : null };
}

/**
 * Store audit log in the database (Equoria-jw10w).
 *
 * Best-effort / fail-soft: ANY error (validation, connectivity, schema) is
 * caught and logged — this function never throws and never rejects. It is
 * called off the request's critical path so an audit-subsystem outage cannot
 * break, delay-block, or 500 a user request. Exported for integration tests.
 *
 * Secrets in `logEntry.requestBody` / `.errorResponse` are already redacted by
 * `sanitizeLogData()` upstream; this function does not re-handle raw secrets.
 */
export async function storeAuditLog(logEntry) {
  try {
    const safeEntry = logEntry || {};
    const { resource, resourceId } = deriveResource(safeEntry.path);

    // Build a redacted metadata blob. requestBody/errorResponse are already
    // sanitized by sanitizeLogData(); params/query are low-risk but we still
    // pass them through sanitizeLogData for defence-in-depth.
    const metadata = {
      sensitivityLevel: safeEntry.sensitivityLevel ?? null,
      userEmail: safeEntry.userEmail ?? null,
      userRole: safeEntry.userRole ?? null,
      duration: typeof safeEntry.duration === 'number' ? safeEntry.duration : null,
      username:
        safeEntry.requestBody && typeof safeEntry.requestBody === 'object'
          ? (safeEntry.requestBody.username ?? null)
          : null,
      body: sanitizeLogData(safeEntry.requestBody),
      params: sanitizeLogData(safeEntry.requestParams),
      query: sanitizeLogData(safeEntry.requestQuery),
      errorResponse: safeEntry.errorResponse ?? null,
    };

    const statusCode = typeof safeEntry.statusCode === 'number' ? safeEntry.statusCode : 0;

    await prisma.auditLog.create({
      data: {
        userId: typeof safeEntry.userId === 'string' ? safeEntry.userId : null,
        action: typeof safeEntry.operationType === 'string' ? safeEntry.operationType : 'mutation',
        resource,
        resourceId,
        method: typeof safeEntry.method === 'string' ? safeEntry.method : 'UNKNOWN',
        path: typeof safeEntry.path === 'string' ? safeEntry.path : 'UNKNOWN',
        statusCode,
        ip: typeof safeEntry.ip === 'string' ? safeEntry.ip : null,
        userAgent: typeof safeEntry.userAgent === 'string' ? safeEntry.userAgent : null,
        success: statusCode > 0 ? statusCode < 400 : Boolean(safeEntry.success),
        metadata,
      },
    });
  } catch (error) {
    // Fail-soft: never propagate. A09 audit must not be on the critical path.
    logger.error('[audit] Failed to persist audit log to DB:', error?.message || error);
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

      // Track security event in Sentry with automatic threshold monitoring
      trackSecurityEventWithThreshold(
        SecurityEventTypes.SUSPICIOUS_ACTIVITY,
        {
          userId,
          userEmail: logEntry.userEmail,
          patterns: suspiciousPatterns,
          recentActivityCount: userActivity.length,
          ip: logEntry.ip,
          userAgent: logEntry.userAgent,
        },
        userId, // Use userId as identifier for threshold tracking
      );
    }
  } catch (error) {
    logger.error('[audit] Failed to check suspicious activity:', error);
  }
}

/**
 * Detect suspicious patterns in user activity
 * Exported for unit-testing pure branch coverage (Equoria-jkht)
 */
export function detectSuspiciousPatterns(userActivity) {
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
 * Exported for unit-testing pure branch coverage (Equoria-jkht)
 */
export function sanitizeLogData(data) {
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
    // Equoria-iqzn: date of birth is sensitive PII (COPPA age-gate input).
    // Substring match: redacts `dateOfBirth` (-> `dateofbirth` contains
    // `birth`) and any `dob`-named field from persisted audit metadata.
    'birth',
    'dob',
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
 * Equoria-jw10w — Global, enforced-by-construction audit trail.
 *
 * Mounted ONCE app-wide in app.mjs (not opt-in per route). Persists a DB
 * AuditLog row for every state-changing request (POST/PUT/PATCH/DELETE) whose
 * path begins with a sensitive prefix. Reads (GET/HEAD/OPTIONS) are NOT
 * persisted by design — the trail scopes to mutations (documented in
 * SECURITY.md A09). The classifier maps the prefix to a stable `action`.
 *
 * Path coverage rationale: auth (account/session), bank + transactions
 * (financial), breeding/breed, training, admin, and groom mutations are the
 * highest-value sensitive surfaces. Both the unversioned (`/api/...`) and
 * versioned (`/api/v1/...`) mounts are covered because authRouter is mounted
 * at BOTH in app.mjs.
 */
const AUDITED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Each entry: [pathTest, action]. pathTest runs against the request path with
// any leading `/api` and `/api/v1` stripped (normalized form).
const SENSITIVE_AUDIT_PREFIXES = [
  { match: p => p.startsWith('auth'), action: 'authentication' },
  // GDPR self-service account ops (Equoria-s3rf): data export + erasure are
  // among the highest-sensitivity operations a user can perform.
  { match: p => p.startsWith('account'), action: 'account_operation' },
  { match: p => p.startsWith('bank'), action: 'transaction' },
  { match: p => p.startsWith('transactions'), action: 'transaction' },
  { match: p => p.startsWith('breeding') || p.startsWith('breed'), action: 'breeding' },
  { match: p => p.startsWith('training'), action: 'training' },
  { match: p => p.startsWith('admin'), action: 'admin_operation' },
  { match: p => p.startsWith('grooms') || p.startsWith('groom-'), action: 'groom_operation' },
];

/**
 * Strip leading /api and /api/v1 from a path for prefix classification.
 * `/api/v1/auth/login` -> `auth/login`; `/api/bank/withdraw` -> `bank/withdraw`
 */
function normalizeAuditPath(path) {
  if (!path || typeof path !== 'string') {
    return '';
  }
  const segs = path.split('?')[0].split('/').filter(Boolean);
  let i = 0;
  if (segs[i] === 'api') {
    i += 1;
  }
  if (segs[i] && /^v\d+$/.test(segs[i])) {
    i += 1;
  }
  return segs.slice(i).join('/');
}

/**
 * Classify a request into an audit action, or null if it must not be audited.
 */
export function classifyAuditAction(method, path) {
  if (!AUDITED_METHODS.has(method)) {
    return null;
  }
  const normalized = normalizeAuditPath(path);
  for (const { match, action } of SENSITIVE_AUDIT_PREFIXES) {
    if (match(normalized)) {
      return action;
    }
  }
  return null;
}

/**
 * Global audit middleware. Unlike the per-route `auditLog()` factory this does
 * NOT short-circuit in the test environment — the DB trail must be verifiable
 * by real-DB integration tests and behave identically in prod and test.
 */
export const globalAuditTrail = (req, res, next) => {
  const action = classifyAuditAction(req.method, req.originalUrl || req.url || req.path);
  if (!action) {
    return next();
  }

  const startTime = Date.now();
  let audited = false;

  const persist = () => {
    if (audited) {
      return;
    }
    audited = true;
    // Fire-and-forget: storeAuditLog is fail-soft and never throws.
    storeAuditLog({
      timestamp: new Date(),
      userId: req.user?.id ?? null,
      userEmail: req.user?.email ?? null,
      userRole: req.user?.role ?? 'anonymous',
      operationType: action,
      sensitivityLevel: 'high',
      method: req.method,
      path: (req.originalUrl || req.url || req.path || '').split('?')[0],
      ip: req.ip,
      userAgent: req.get ? req.get('User-Agent') : undefined,
      statusCode: res.statusCode,
      duration: Date.now() - startTime,
      requestBody: sanitizeLogData(req.body),
      requestParams: req.params,
      requestQuery: req.query,
      success: res.statusCode < 400,
    });
  };

  // `finish` fires for normal responses; `close` covers aborted connections so
  // an attacker cannot evade the trail by killing the socket mid-response.
  res.on('finish', persist);
  res.on('close', persist);

  return next();
};

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

export default {
  auditLog,
  globalAuditTrail,
  storeAuditLog,
  classifyAuditAction,
  auditBreeding,
  auditTraining,
  auditTransaction,
  auditStatModification,
  auditAuth,
  auditAdmin,
};
