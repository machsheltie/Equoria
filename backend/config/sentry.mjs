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

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import logger from '../utils/logger.mjs';

/**
 * Initialize Sentry SDK with security monitoring configuration
 *
 * @param {Object} app - Express app instance
 */
export function initializeSentry(app) {
  // Only initialize Sentry in production or if explicitly enabled
  const sentryDsn = process.env.SENTRY_DSN;
  const environment = process.env.NODE_ENV || 'development';

  if (!sentryDsn) {
    logger.info('[Sentry] Sentry DSN not configured. Skipping initialization.');
    return;
  }

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

  // Attach Sentry request handler as the first middleware
  app.use(Sentry.Handlers.requestHandler());

  // Attach Sentry tracing middleware
  app.use(Sentry.Handlers.tracingHandler());

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
  app.use(
    Sentry.Handlers.errorHandler({
      shouldHandleError(error) {
        // Capture 4xx and 5xx errors
        return error.status >= 400;
      },
    }),
  );

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
  Sentry.withScope(scope => {
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
      Sentry.captureException(new Error(message));
    } else {
      Sentry.captureMessage(message, severity);
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
 * In-memory event counter for threshold monitoring
 * In production, this should use Redis for distributed tracking
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
  if (!threshold) { return false; }

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
  Sentry.withScope(scope => {
    scope.setContext('security', securityContext);
    scope.setTag('event_type', 'security');
    Sentry.captureException(error);
  });

  logger.error('[Sentry] Captured security exception', {
    error: error.message,
    context: securityContext,
  });
}

// Export Sentry for direct access if needed
export { Sentry };
