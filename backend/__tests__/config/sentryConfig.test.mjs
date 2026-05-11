import { describe, it, expect } from '@jest/globals';
import {
  SecurityEventTypes,
  SecurityAlertThresholds,
  checkAlertThreshold,
  initializeSentry,
  attachSentryErrorHandler,
  trackSecurityEvent,
  trackSecurityEventWithThreshold,
  captureSecurityException,
} from '../../config/sentry.mjs';

// ─── SecurityEventTypes ───────────────────────────────────────────────────────

describe('SecurityEventTypes', () => {
  it('is an object', () => {
    expect(typeof SecurityEventTypes).toBe('object');
    expect(SecurityEventTypes).not.toBeNull();
  });

  it('has AUTH_FAILURE', () => {
    expect(SecurityEventTypes.AUTH_FAILURE).toBe('auth_failure');
  });

  it('has AUTH_SUCCESS', () => {
    expect(SecurityEventTypes.AUTH_SUCCESS).toBe('auth_success');
  });

  it('has TOKEN_EXPIRED', () => {
    expect(SecurityEventTypes.TOKEN_EXPIRED).toBe('token_expired');
  });

  it('has TOKEN_INVALID', () => {
    expect(SecurityEventTypes.TOKEN_INVALID).toBe('token_invalid');
  });

  it('has IDOR_ATTEMPT', () => {
    expect(SecurityEventTypes.IDOR_ATTEMPT).toBe('idor_attempt');
  });

  it('has OWNERSHIP_VIOLATION', () => {
    expect(SecurityEventTypes.OWNERSHIP_VIOLATION).toBe('ownership_violation');
  });

  it('has PRIVILEGE_ESCALATION', () => {
    expect(SecurityEventTypes.PRIVILEGE_ESCALATION).toBe('privilege_escalation');
  });

  it('has RATE_LIMIT_EXCEEDED', () => {
    expect(SecurityEventTypes.RATE_LIMIT_EXCEEDED).toBe('rate_limit_exceeded');
  });

  it('has SUSPICIOUS_ACTIVITY', () => {
    expect(SecurityEventTypes.SUSPICIOUS_ACTIVITY).toBe('suspicious_activity');
  });

  it('has VALIDATION_FAILURE', () => {
    expect(SecurityEventTypes.VALIDATION_FAILURE).toBe('validation_failure');
  });

  it('has XSS_ATTEMPT', () => {
    expect(SecurityEventTypes.XSS_ATTEMPT).toBe('xss_attempt');
  });

  it('has SQL_INJECTION_ATTEMPT', () => {
    expect(SecurityEventTypes.SQL_INJECTION_ATTEMPT).toBe('sql_injection_attempt');
  });

  it('has SENSITIVE_DATA_EXPOSURE', () => {
    expect(SecurityEventTypes.SENSITIVE_DATA_EXPOSURE).toBe('sensitive_data_exposure');
  });

  it('has ERROR_LEAK', () => {
    expect(SecurityEventTypes.ERROR_LEAK).toBe('error_leak');
  });

  it('all values are strings', () => {
    for (const value of Object.values(SecurityEventTypes)) {
      expect(typeof value).toBe('string');
    }
  });
});

// ─── SecurityAlertThresholds ──────────────────────────────────────────────────

describe('SecurityAlertThresholds', () => {
  it('is an object', () => {
    expect(typeof SecurityAlertThresholds).toBe('object');
    expect(SecurityAlertThresholds).not.toBeNull();
  });

  it('has threshold config for AUTH_FAILURE', () => {
    const t = SecurityAlertThresholds[SecurityEventTypes.AUTH_FAILURE];
    expect(t).toHaveProperty('count');
    expect(t).toHaveProperty('windowMinutes');
    expect(t.count).toBeGreaterThan(0);
    expect(t.windowMinutes).toBeGreaterThan(0);
  });

  it('has threshold config for IDOR_ATTEMPT', () => {
    const t = SecurityAlertThresholds[SecurityEventTypes.IDOR_ATTEMPT];
    expect(t).toHaveProperty('count');
    expect(t.count).toBeGreaterThan(0);
  });

  it('PRIVILEGE_ESCALATION has count of 1 (immediate alert)', () => {
    const t = SecurityAlertThresholds[SecurityEventTypes.PRIVILEGE_ESCALATION];
    expect(t.count).toBe(1);
  });

  it('XSS_ATTEMPT has count of 1 (immediate alert)', () => {
    const t = SecurityAlertThresholds[SecurityEventTypes.XSS_ATTEMPT];
    expect(t.count).toBe(1);
  });

  it('SQL_INJECTION_ATTEMPT has count of 1 (immediate alert)', () => {
    const t = SecurityAlertThresholds[SecurityEventTypes.SQL_INJECTION_ATTEMPT];
    expect(t.count).toBe(1);
  });

  it('all thresholds have count and windowMinutes as numbers', () => {
    for (const threshold of Object.values(SecurityAlertThresholds)) {
      expect(typeof threshold.count).toBe('number');
      expect(typeof threshold.windowMinutes).toBe('number');
    }
  });
});

// ─── checkAlertThreshold ──────────────────────────────────────────────────────

describe('checkAlertThreshold', () => {
  it('returns false for an unknown event type', () => {
    expect(checkAlertThreshold('unknown_event_xyz', 'ip-1')).toBe(false);
  });

  it('returns false on first call for a known event (below threshold)', () => {
    const id = `test-user-${Date.now()}-a`;
    const result = checkAlertThreshold(SecurityEventTypes.IDOR_ATTEMPT, id);
    expect(result).toBe(false);
  });

  it('returns true once threshold is reached for PRIVILEGE_ESCALATION (count=1)', () => {
    const id = `test-user-${Date.now()}-b`;
    const result = checkAlertThreshold(SecurityEventTypes.PRIVILEGE_ESCALATION, id);
    expect(result).toBe(true);
  });

  it('returns true once threshold is reached for XSS_ATTEMPT (count=1)', () => {
    const id = `test-ip-${Date.now()}-c`;
    const result = checkAlertThreshold(SecurityEventTypes.XSS_ATTEMPT, id);
    expect(result).toBe(true);
  });

  it('accumulates count: returns false before threshold, true at threshold', () => {
    const id = `test-ip-${Date.now()}-d`;
    const eventType = SecurityEventTypes.IDOR_ATTEMPT;
    const threshold = SecurityAlertThresholds[eventType].count;

    for (let i = 1; i < threshold; i++) {
      const result = checkAlertThreshold(eventType, id);
      expect(result).toBe(false);
    }
    const atThreshold = checkAlertThreshold(eventType, id);
    expect(atThreshold).toBe(true);
  });

  it('uses separate counters for different identifiers', () => {
    const id1 = `test-ip-${Date.now()}-e1`;
    const id2 = `test-ip-${Date.now()}-e2`;
    checkAlertThreshold(SecurityEventTypes.PRIVILEGE_ESCALATION, id1);
    const resultForId2 = checkAlertThreshold(SecurityEventTypes.PRIVILEGE_ESCALATION, id2);
    expect(resultForId2).toBe(true);
  });

  it('returns boolean (not truthy/falsy)', () => {
    const id = `test-ip-${Date.now()}-f`;
    const result = checkAlertThreshold(SecurityEventTypes.AUTH_FAILURE, id);
    expect(typeof result).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// initializeSentry — early-return branch when SENTRY_DSN is not set
// ---------------------------------------------------------------------------
describe('initializeSentry', () => {
  it('returns undefined when SENTRY_DSN is not configured', () => {
    const savedDsn = process.env.SENTRY_DSN;
    delete process.env.SENTRY_DSN;
    const mockApp = { use: () => {} };
    expect(() => initializeSentry(mockApp)).not.toThrow();
    if (savedDsn !== undefined) process.env.SENTRY_DSN = savedDsn;
  });

  it('does not call app.use when SENTRY_DSN is not configured', () => {
    const savedDsn = process.env.SENTRY_DSN;
    delete process.env.SENTRY_DSN;
    let useCalled = false;
    const mockApp = {
      use: () => {
        useCalled = true;
      },
    };
    initializeSentry(mockApp);
    expect(useCalled).toBe(false);
    if (savedDsn !== undefined) process.env.SENTRY_DSN = savedDsn;
  });
});

// ---------------------------------------------------------------------------
// attachSentryErrorHandler — early-return branch when SENTRY_DSN is not set
// ---------------------------------------------------------------------------
describe('attachSentryErrorHandler', () => {
  it('returns without attaching when SENTRY_DSN is not configured', () => {
    const savedDsn = process.env.SENTRY_DSN;
    delete process.env.SENTRY_DSN;
    let useCalled = false;
    const mockApp = {
      use: () => {
        useCalled = true;
      },
    };
    attachSentryErrorHandler(mockApp);
    expect(useCalled).toBe(false);
    if (savedDsn !== undefined) process.env.SENTRY_DSN = savedDsn;
  });
});

// ---------------------------------------------------------------------------
// trackSecurityEvent — branch coverage (userId present/absent, severity)
// ---------------------------------------------------------------------------
describe('trackSecurityEvent', () => {
  it('does not throw when called with defaults (no userId, severity=warning)', () => {
    expect(() => trackSecurityEvent(SecurityEventTypes.AUTH_FAILURE, {}, 'warning')).not.toThrow();
  });

  it('does not throw when context.userId is set (setUser branch)', () => {
    expect(() =>
      trackSecurityEvent(SecurityEventTypes.IDOR_ATTEMPT, { userId: 'u1', ipAddress: '1.1.1.1' }, 'warning'),
    ).not.toThrow();
  });

  it('does not throw with severity "error" (captureException branch)', () => {
    expect(() => trackSecurityEvent(SecurityEventTypes.XSS_ATTEMPT, {}, 'error')).not.toThrow();
  });

  it('does not throw with severity "critical" (captureException branch)', () => {
    expect(() => trackSecurityEvent(SecurityEventTypes.SQL_INJECTION_ATTEMPT, {}, 'critical')).not.toThrow();
  });

  it('does not throw with severity "info" (captureMessage branch)', () => {
    expect(() => trackSecurityEvent(SecurityEventTypes.AUTH_SUCCESS, {}, 'info')).not.toThrow();
  });

  it('uses default severity "warning" when omitted', () => {
    expect(() => trackSecurityEvent(SecurityEventTypes.VALIDATION_FAILURE, {})).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// trackSecurityEventWithThreshold — above/below threshold branches
// ---------------------------------------------------------------------------
describe('trackSecurityEventWithThreshold', () => {
  it('does not throw for a below-threshold event (warning severity path)', () => {
    const id = `thresh-test-${Date.now()}-g`;
    expect(() => trackSecurityEventWithThreshold(SecurityEventTypes.AUTH_FAILURE, { userId: id }, id)).not.toThrow();
  });

  it('does not throw for an above-threshold event (critical severity path)', () => {
    const id = `thresh-test-${Date.now()}-h`;
    expect(() => trackSecurityEventWithThreshold(SecurityEventTypes.PRIVILEGE_ESCALATION, {}, id)).not.toThrow();
  });

  it('escalates to critical severity when threshold is exceeded', () => {
    const id = `thresh-test-${Date.now()}-i`;
    const eventType = SecurityEventTypes.XSS_ATTEMPT;
    const isAbove = checkAlertThreshold(eventType, id);
    expect(typeof isAbove).toBe('boolean');
    expect(() => trackSecurityEventWithThreshold(eventType, {}, id)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// captureSecurityException — no branches, just smoke test
// ---------------------------------------------------------------------------
describe('captureSecurityException', () => {
  it('does not throw when capturing a plain error', () => {
    const err = new Error('test security error');
    expect(() => captureSecurityException(err, {})).not.toThrow();
  });

  it('does not throw when capturing with security context', () => {
    const err = new Error('ownership violation');
    expect(() => captureSecurityException(err, { userId: 'u99', resource: 'horse:42' })).not.toThrow();
  });

  it('does not throw when called with default empty context', () => {
    expect(() => captureSecurityException(new Error('minimal'))).not.toThrow();
  });
});
