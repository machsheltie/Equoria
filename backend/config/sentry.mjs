/**
 * Sentry Error Tracking and Security Monitoring Configuration
 *
 * Provides centralized error tracking, performance monitoring, and security event alerting.
 * Integrates with the audit log system to track security-critical events.
 *
 * Features:
 * - Error tracking with stack traces and context
 * - Performance monitoring and profiling
 * - Security event tracking (auth failures, IDOR attempts, rate limits)
 * - Custom alert thresholds for critical events
 * - Release tracking and source maps
 *
 * @module config/sentry
 */

// Equoria-k09r9 (2026-09-14): the SDK is loaded on demand. `@sentry/node` and
// `@sentry/profiling-node` cost ~0.6s to import, and this module sits in the
// shared core of every app-importing test file (through rateLimiting.mjs and
// auditLog.mjs), which paid that price ~280 times per gate without ever
// initializing Sentry. Without a DSN nothing here needs the SDK: every capture
// below is a no-op until initializeSentry() has loaded it, which is exactly
// what an uninitialized SDK did before (captures were dropped).
let sdk = null;
import logger from '../utils/logger.mjs';

/**
 * Initialize Sentry SDK with security monitoring configuration
 *
 * @param {Object} app - Express app instance
 */
// The app argument is retained for the call-site contract; @sentry/node >= 8
// instruments Express itself after init() rather than through app.use().
export async function initializeSentry(_app) {
  // Only initialize Sentry in production or if explicitly enabled
  const sentryDsn = process.env.SENTRY_DSN;
  const environment = process.env.NODE_ENV || 'development';

  if (!sentryDsn) {
    logger.info('[Sentry] Sentry DSN not configured. Skipping initialization.');
    return;
  }

  const [Sentry, { nodeProfilingIntegration }] = await Promise.all([
    import('@sentry/node'),
    import('@sentry/profiling-node'),
  ]);
  sdk = Sentry;

  Sentry.init({
    dsn: sentryDsn,
    environment,

    // Performance monitoring
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0, // 10% in prod, 100% in dev

    // Profiling
    profilesSampleRate: environment === 'production' ? 0.1 : 1.0,
    integrations: [nodeProfilingIntegration()],

    // Release tracking
    release:
      process.env.SENTRY_RELEASE || `equoria@${process.env.npm_package_version || 'unknown'}`,

    // Error filtering
    beforeSend(event, hint) {
      // Don't send errors from test environment
      if (environment === 'test') {
        return null;
      }

      // Add security context if available
      if (hint.originalException && hint.originalException.securityContext) {
        event.contexts = event.contexts || {};
        event.contexts.security = hint.originalException.securityContext;
      }

      return event;
    },

    // Ignore common non-critical errors
    ignoreErrors: ['AbortError', 'Network request failed', 'Failed to fetch', 'NetworkError'],
  });

  // @sentry/node >= 8 removed Handlers.requestHandler/tracingHandler (absent in
  // the installed 10.x, so both calls threw here whenever a DSN was set); the
  // SDK now instruments Express through its default integrations once init()
  // has run, and the error handler is attached by attachSentryErrorHandler().

  logger.info(`[Sentry] Initialized for environment: ${environment}`);
}

/**
 * Attach Sentry error handler middleware (must be after all routes)
 *
 * @param {Object} app - Express app instance
 */
export function attachSentryErrorHandler(app) {
  const sentryDsn = process.env.SENTRY_DSN;

  // Only attach error handler if Sentry is initialized
  if (!sentryDsn) {
    logger.info('[Sentry] Sentry error handler not attached (DSN not configured).');
    return;
  }

  // Sentry error handler must be before any other error middleware
  if (!sdk) {
    logger.warn('[Sentry] Error handler not attached: initializeSentry() has not loaded the SDK.');
    return;
  }
  // @sentry/node >= 8 replaced Handlers.errorHandler (absent in the installed
  // 10.x, so the old call threw at boot whenever a DSN was set) with
  // setupExpressErrorHandler, which registers the middleware on the app itself.
  sdk.setupExpressErrorHandler(app, {
    shouldHandleError(error) {
      return error.status >= 400;
    },
  });

  logger.info('[Sentry] Error handler attached successfully.');
}

/**
 * Track a security event in Sentry
 *
 * @param {string} eventType - Type of security event (e.g., 'auth_failure', 'idor_attempt')
 * @param {Object} context - Event context and metadata
 * @param {string} severity - Event severity ('info', 'warning', 'error', 'critical')
 */
export function trackSecurityEvent(eventType, context = {}, severity = 'warning') {
  sdk?.withScope(scope => {
    // Set security event tags
    scope.setTag('event_type', 'security');
    scope.setTag('security_event', eventType);
    scope.setLevel(severity);

    // Add security context
    scope.setContext('security', {
      eventType,
      timestamp: new Date().toISOString(),
      ...context,
    });

    // Add user context if available
    if (context.userId) {
      scope.setUser({
        id: context.userId,
        ip_address: context.ipAddress,
      });
    }

    // Create a message for the security event
    const message = `Security Event: ${eventType}`;

    // Send to Sentry based on severity
    if (severity === 'error' || severity === 'critical') {
      sdk.captureException(new Error(message));
    } else {
      sdk.captureMessage(message, severity);
    }
  });

  logger.info(`[Sentry] Tracked security event: ${eventType}`, { severity, context });
}

/**
 * Security event types for monitoring
 */
export const SecurityEventTypes = {
  // Authentication events
  AUTH_FAILURE: 'auth_failure',
  AUTH_SUCCESS: 'auth_success',
  TOKEN_EXPIRED: 'token_expired',
  TOKEN_INVALID: 'token_invalid',

  // Authorization events
  IDOR_ATTEMPT: 'idor_attempt',
  OWNERSHIP_VIOLATION: 'ownership_violation',
  PRIVILEGE_ESCALATION: 'privilege_escalation',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  SUSPICIOUS_ACTIVITY: 'suspicious_activity',

  // Input validation
  VALIDATION_FAILURE: 'validation_failure',
  XSS_ATTEMPT: 'xss_attempt',
  SQL_INJECTION_ATTEMPT: 'sql_injection_attempt',

  // Information disclosure
  SENSITIVE_DATA_EXPOSURE: 'sensitive_data_exposure',
  ERROR_LEAK: 'error_leak',
};

/**
 * Alert threshold configuration for security events
 * Defines when to escalate security events to critical alerts
 */
export const SecurityAlertThresholds = {
  // Number of events within time window to trigger alert
  [SecurityEventTypes.AUTH_FAILURE]: { count: 5, windowMinutes: 15 },
  [SecurityEventTypes.IDOR_ATTEMPT]: { count: 3, windowMinutes: 10 },
  [SecurityEventTypes.RATE_LIMIT_EXCEEDED]: { count: 10, windowMinutes: 5 },
  [SecurityEventTypes.OWNERSHIP_VIOLATION]: { count: 3, windowMinutes: 10 },
  [SecurityEventTypes.PRIVILEGE_ESCALATION]: { count: 1, windowMinutes: 1 }, // Immediate alert
  [SecurityEventTypes.XSS_ATTEMPT]: { count: 1, windowMinutes: 1 },
  [SecurityEventTypes.SQL_INJECTION_ATTEMPT]: { count: 1, windowMinutes: 1 },
};

/**
 * In-memory event counter for threshold monitoring.
 *
 * ⚠️ PER-PROCESS, NOT SCALE-ACCURATE (Equoria-rqi7, 2026-05-18).
 * This is a plain in-process JS Map. Threshold *escalation* (the
 * count-within-window → critical decision in checkAlertThreshold) is therefore
 * single-process only:
 *   - Under horizontal scaling (multiple Railway instances) an attacker whose
 *     requests load-balance across N instances divides their per-instance
 *     count by N, so an aggregate-threshold-worth of activity may never trip
 *     on any single process.
 *   - The Map resets on every deploy / restart, so a slow attack spanning a
 *     deploy is not aggregated across the boundary.
 * Each individual security event is still captured to Sentry regardless; only
 * the escalation aggregation is best-effort. A Redis-backed shared counter is
 * the documented remediation if multi-instance escalation accuracy is required
 * (see docs/SENTRY_SETUP.md). Do NOT present threshold
 * escalation as a scale-accurate alerting control.
 */
const eventCounters = new Map();

/**
 * Check if security event exceeds alert threshold
 *
 * @param {string} eventType - Type of security event
 * @param {string} identifier - Unique identifier (e.g., IP address, user ID)
 * @returns {boolean} True if threshold exceeded
 */
export function checkAlertThreshold(eventType, identifier) {
  const threshold = SecurityAlertThresholds[eventType];
  if (!threshold) {
    return false;
  }

  const key = `${eventType}:${identifier}`;
  const now = Date.now();
  const windowMs = threshold.windowMinutes * 60 * 1000;

  // Get or initialize event history
  let events = eventCounters.get(key) || [];

  // Remove events outside the time window
  events = events.filter(timestamp => now - timestamp < windowMs);

  // Add current event
  events.push(now);
  eventCounters.set(key, events);

  // Check if threshold exceeded
  if (events.length >= threshold.count) {
    logger.warn(`[Sentry] Alert threshold exceeded for ${eventType}`, {
      identifier,
      count: events.length,
      threshold: threshold.count,
      windowMinutes: threshold.windowMinutes,
    });
    return true;
  }

  return false;
}

/**
 * Track security event with automatic threshold monitoring
 *
 * @param {string} eventType - Type of security event
 * @param {Object} context - Event context
 * @param {string} identifier - Unique identifier for threshold tracking
 */
export function trackSecurityEventWithThreshold(eventType, context, identifier) {
  // Track the event
  const isAboveThreshold = checkAlertThreshold(eventType, identifier);

  // Escalate severity if threshold exceeded
  const severity = isAboveThreshold ? 'critical' : 'warning';

  // Add threshold information to context
  const enrichedContext = {
    ...context,
    thresholdExceeded: isAboveThreshold,
    identifier,
  };

  trackSecurityEvent(eventType, enrichedContext, severity);
}

/**
 * Capture an exception with security context
 *
 * @param {Error} error - Error object
 * @param {Object} securityContext - Security-related context
 */
export function captureSecurityException(error, securityContext = {}) {
  sdk?.withScope(scope => {
    scope.setContext('security', securityContext);
    scope.setTag('event_type', 'security');
    sdk.captureException(error);
  });

  logger.error('[Sentry] Captured security exception', {
    error: error.message,
    context: securityContext,
  });
}

// Export Sentry for direct access if needed
// Facade for callers that alert through Sentry directly (cron monitor, show
// reaper). Each method is a no-op until initializeSentry() has loaded the SDK.
export const Sentry = {
  withScope(callback) {
    return sdk ? sdk.withScope(callback) : undefined;
  },
  captureMessage(...args) {
    return sdk ? sdk.captureMessage(...args) : undefined;
  },
  captureException(...args) {
    return sdk ? sdk.captureException(...args) : undefined;
  },
};
