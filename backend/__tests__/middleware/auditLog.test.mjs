import { describe, it, expect } from '@jest/globals';
import auditLogDefault, {
  auditLog,
  auditBreeding,
  auditTraining,
  auditTransaction,
  auditStatModification,
  auditAuth,
  auditAdmin,
  sanitizeLogData,
  detectSuspiciousPatterns,
} from '../../middleware/auditLog.mjs';

// All tests run in NODE_ENV=test, so auditLog middleware calls next() immediately.

function makeReq(overrides = {}) {
  return {
    method: 'GET',
    path: '/test',
    ip: '127.0.0.1',
    get: () => null,
    user: null,
    body: {},
    params: {},
    query: {},
    ...overrides,
  };
}

function makeRes(overrides = {}) {
  return {
    statusCode: 200,
    send: function (data) {
      this._data = data;
    },
    ...overrides,
  };
}

// ─── auditLog factory ─────────────────────────────────────────────────────────

describe('auditLog factory', () => {
  it('returns a function', () => {
    const mw = auditLog('breeding', 'high');
    expect(typeof mw).toBe('function');
  });

  it('returned middleware is async', () => {
    const mw = auditLog('auth', 'medium');
    expect(mw.constructor.name).toBe('AsyncFunction');
  });

  it('calls next() in test mode without throwing', async () => {
    const mw = auditLog('training', 'medium');
    const req = makeReq();
    const res = makeRes();
    let called = false;
    await mw(req, res, () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('does not modify res.send in test mode', async () => {
    const mw = auditLog('transaction', 'high');
    const req = makeReq();
    const originalSend = () => {};
    const res = makeRes({ send: originalSend });
    await mw(req, res, () => {});
    // In test mode, res.send is NOT overridden (next() called before override)
    expect(res.send).toBe(originalSend);
  });

  it('works with default sensitivityLevel', async () => {
    const mw = auditLog('any_operation');
    const req = makeReq();
    const res = makeRes();
    let called = false;
    await mw(req, res, () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('works with req.user set', async () => {
    const mw = auditLog('authentication', 'high');
    const req = makeReq({ user: { id: 42, email: 'test@equoria.test', role: 'admin' } });
    const res = makeRes();
    await expect(mw(req, res, () => {})).resolves.toBeUndefined();
  });
});

// ─── Pre-built audit middlewares ──────────────────────────────────────────────

describe('Pre-built audit middlewares', () => {
  it('auditBreeding is a function', () => {
    expect(typeof auditBreeding).toBe('function');
  });

  it('auditTraining is a function', () => {
    expect(typeof auditTraining).toBe('function');
  });

  it('auditTransaction is a function', () => {
    expect(typeof auditTransaction).toBe('function');
  });

  it('auditStatModification is a function', () => {
    expect(typeof auditStatModification).toBe('function');
  });

  it('auditAuth is a function', () => {
    expect(typeof auditAuth).toBe('function');
  });

  it('auditAdmin is a function', () => {
    expect(typeof auditAdmin).toBe('function');
  });

  it('auditBreeding calls next() in test mode', async () => {
    let called = false;
    await auditBreeding(makeReq(), makeRes(), () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('auditAuth calls next() in test mode', async () => {
    let called = false;
    await auditAuth(makeReq(), makeRes(), () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it('auditAdmin calls next() in test mode', async () => {
    let called = false;
    await auditAdmin(makeReq(), makeRes(), () => {
      called = true;
    });
    expect(called).toBe(true);
  });
});

// ─── Default export ───────────────────────────────────────────────────────────

describe('auditLog default export', () => {
  it('is an object', () => {
    expect(typeof auditLogDefault).toBe('object');
    expect(auditLogDefault).not.toBeNull();
  });

  it('has auditLog property', () => {
    expect(typeof auditLogDefault.auditLog).toBe('function');
  });

  it('has auditBreeding property', () => {
    expect(typeof auditLogDefault.auditBreeding).toBe('function');
  });

  it('has auditTraining property', () => {
    expect(typeof auditLogDefault.auditTraining).toBe('function');
  });

  it('has auditTransaction property', () => {
    expect(typeof auditLogDefault.auditTransaction).toBe('function');
  });

  it('has auditStatModification property', () => {
    expect(typeof auditLogDefault.auditStatModification).toBe('function');
  });

  it('has auditAuth property', () => {
    expect(typeof auditLogDefault.auditAuth).toBe('function');
  });

  it('has auditAdmin property', () => {
    expect(typeof auditLogDefault.auditAdmin).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// sanitizeLogData — pure function branch coverage
// ---------------------------------------------------------------------------
describe('sanitizeLogData', () => {
  it('returns null as-is (falsy branch)', () => {
    expect(sanitizeLogData(null)).toBeNull();
  });

  it('returns undefined as-is', () => {
    expect(sanitizeLogData(undefined)).toBeUndefined();
  });

  it('returns a string as-is (typeof !== object branch)', () => {
    expect(sanitizeLogData('hello')).toBe('hello');
  });

  it('returns a number as-is', () => {
    expect(sanitizeLogData(42)).toBe(42);
  });

  it('returns clean object unchanged', () => {
    const obj = { name: 'Alice', age: 30 };
    expect(sanitizeLogData(obj)).toEqual({ name: 'Alice', age: 30 });
  });

  it('redacts a field containing "password"', () => {
    const result = sanitizeLogData({ password: 'secret123', name: 'Alice' });
    expect(result.password).toBe('[REDACTED]');
    expect(result.name).toBe('Alice');
  });

  it('redacts a field containing "token" (case-insensitive via lower)', () => {
    const result = sanitizeLogData({ accessToken: 'jwt.value.here' });
    expect(result.accessToken).toBe('[REDACTED]');
  });

  it('redacts a field containing "secret"', () => {
    const result = sanitizeLogData({ jwtSecret: 'abc', foo: 'bar' });
    expect(result.jwtSecret).toBe('[REDACTED]');
    expect(result.foo).toBe('bar');
  });

  it('redacts a field containing "key"', () => {
    const result = sanitizeLogData({ apiKey: '12345' });
    expect(result.apiKey).toBe('[REDACTED]');
  });

  it('redacts a field containing "auth"', () => {
    const result = sanitizeLogData({ authorization: 'Bearer xyz' });
    expect(result.authorization).toBe('[REDACTED]');
  });

  it('redacts a field containing "credential"', () => {
    const result = sanitizeLogData({ userCredential: 'val' });
    expect(result.userCredential).toBe('[REDACTED]');
  });

  it('redacts a field containing "ssn"', () => {
    const result = sanitizeLogData({ ssn: '123-45-6789' });
    expect(result.ssn).toBe('[REDACTED]');
  });

  it('redacts a field containing "credit"', () => {
    const result = sanitizeLogData({ creditCard: '4111111111111111' });
    expect(result.creditCard).toBe('[REDACTED]');
  });

  it('redacts a field containing "cvv"', () => {
    const result = sanitizeLogData({ cvvCode: '123' });
    expect(result.cvvCode).toBe('[REDACTED]');
  });

  it('redacts a field containing "pin"', () => {
    const result = sanitizeLogData({ pinNumber: '0000' });
    expect(result.pinNumber).toBe('[REDACTED]');
  });

  it('does not mutate the original object', () => {
    const original = { password: 'secret' };
    sanitizeLogData(original);
    expect(original.password).toBe('secret');
  });

  it('handles object with no sensitive fields — returns copy', () => {
    const obj = { username: 'alice', role: 'user' };
    const result = sanitizeLogData(obj);
    expect(result).toEqual(obj);
    expect(result).not.toBe(obj);
  });
});

// ---------------------------------------------------------------------------
// detectSuspiciousPatterns — pure function branch coverage
// ---------------------------------------------------------------------------

function makeActivity(overrides = {}) {
  return {
    timestamp: Date.now(),
    operationType: 'view',
    statusCode: 200,
    ip: '127.0.0.1',
    path: '/api/test',
    ...overrides,
  };
}

describe('detectSuspiciousPatterns', () => {
  it('returns empty array for no activity', () => {
    expect(detectSuspiciousPatterns([])).toEqual([]);
  });

  it('returns empty array for small clean activity', () => {
    const activity = [makeActivity(), makeActivity(), makeActivity()];
    expect(detectSuspiciousPatterns(activity)).toEqual([]);
  });

  // Pattern 1: excessive_failures (>= 10 failed requests)
  it('detects excessive_failures when >= 10 failed requests', () => {
    const activity = Array.from({ length: 10 }, () => makeActivity({ statusCode: 404 }));
    const patterns = detectSuspiciousPatterns(activity);
    expect(patterns.some(p => p.type === 'excessive_failures')).toBe(true);
  });

  it('does NOT detect excessive_failures when < 10 failed requests', () => {
    const activity = Array.from({ length: 9 }, () => makeActivity({ statusCode: 401 }));
    const patterns = detectSuspiciousPatterns(activity);
    expect(patterns.some(p => p.type === 'excessive_failures')).toBe(false);
  });

  // Pattern 2: rapid_fire_requests (>= 20 in last 30 seconds)
  it('detects rapid_fire_requests when >= 20 recent entries', () => {
    const now = Date.now();
    const activity = Array.from({ length: 20 }, () => makeActivity({ timestamp: now - 1000 }));
    const patterns = detectSuspiciousPatterns(activity);
    expect(patterns.some(p => p.type === 'rapid_fire_requests')).toBe(true);
  });

  it('does NOT detect rapid_fire_requests when < 20 recent entries', () => {
    const now = Date.now();
    const activity = Array.from({ length: 10 }, () => makeActivity({ timestamp: now - 1000 }));
    const patterns = detectSuspiciousPatterns(activity);
    expect(patterns.some(p => p.type === 'rapid_fire_requests')).toBe(false);
  });

  it('does NOT flag old rapid requests (> 30s ago)', () => {
    const old = makeActivity({ timestamp: Date.now() - 31000 });
    const activity = Array.from({ length: 20 }, () => old);
    const patterns = detectSuspiciousPatterns(activity);
    expect(patterns.some(p => p.type === 'rapid_fire_requests')).toBe(false);
  });

  // Pattern 3: multiple_ip_addresses (>= 3 unique IPs)
  it('detects multiple_ip_addresses when >= 3 unique IPs', () => {
    const activity = [
      makeActivity({ ip: '1.1.1.1' }),
      makeActivity({ ip: '2.2.2.2' }),
      makeActivity({ ip: '3.3.3.3' }),
    ];
    const patterns = detectSuspiciousPatterns(activity);
    const ipPat = patterns.find(p => p.type === 'multiple_ip_addresses');
    expect(ipPat).toBeDefined();
    expect(ipPat.ipCount).toBe(3);
  });

  it('does NOT detect multiple_ip_addresses when < 3 unique IPs', () => {
    const activity = [
      makeActivity({ ip: '1.1.1.1' }),
      makeActivity({ ip: '1.1.1.1' }),
      makeActivity({ ip: '2.2.2.2' }),
    ];
    const patterns = detectSuspiciousPatterns(activity);
    expect(patterns.some(p => p.type === 'multiple_ip_addresses')).toBe(false);
  });

  // Pattern 4: excessive_sensitive_operations (>= 15)
  it('detects excessive_sensitive_operations when >= 15 sensitive ops', () => {
    const activity = Array.from({ length: 15 }, () => makeActivity({ operationType: 'breeding' }));
    const patterns = detectSuspiciousPatterns(activity);
    expect(patterns.some(p => p.type === 'excessive_sensitive_operations')).toBe(true);
  });

  it('does NOT detect excessive_sensitive_operations when < 15', () => {
    const activity = Array.from({ length: 14 }, () => makeActivity({ operationType: 'training' }));
    const patterns = detectSuspiciousPatterns(activity);
    expect(patterns.some(p => p.type === 'excessive_sensitive_operations')).toBe(false);
  });

  it('counts training as a sensitive operation type', () => {
    const activity = Array.from({ length: 15 }, () => makeActivity({ operationType: 'training' }));
    expect(detectSuspiciousPatterns(activity).some(p => p.type === 'excessive_sensitive_operations')).toBe(true);
  });

  it('counts transaction as a sensitive operation type', () => {
    const activity = Array.from({ length: 15 }, () => makeActivity({ operationType: 'transaction' }));
    expect(detectSuspiciousPatterns(activity).some(p => p.type === 'excessive_sensitive_operations')).toBe(true);
  });

  it('does NOT count view as a sensitive operation type', () => {
    const activity = Array.from({ length: 20 }, () => makeActivity({ operationType: 'view' }));
    expect(detectSuspiciousPatterns(activity).some(p => p.type === 'excessive_sensitive_operations')).toBe(false);
  });

  // Pattern 5: error_then_success_pattern
  it('detects error_then_success_pattern in recent entries', () => {
    const activity = [
      makeActivity({ statusCode: 401, operationType: 'authentication' }),
      makeActivity({ statusCode: 200, operationType: 'authentication' }),
    ];
    const patterns = detectSuspiciousPatterns(activity);
    expect(patterns.some(p => p.type === 'error_then_success_pattern')).toBe(true);
  });

  it('does NOT detect error_then_success when operation types differ', () => {
    const activity = [
      makeActivity({ statusCode: 401, operationType: 'authentication' }),
      makeActivity({ statusCode: 200, operationType: 'view' }),
    ];
    const patterns = detectSuspiciousPatterns(activity);
    expect(patterns.some(p => p.type === 'error_then_success_pattern')).toBe(false);
  });

  it('does NOT detect error_then_success when both succeed', () => {
    const activity = [
      makeActivity({ statusCode: 200, operationType: 'authentication' }),
      makeActivity({ statusCode: 200, operationType: 'authentication' }),
    ];
    const patterns = detectSuspiciousPatterns(activity);
    expect(patterns.some(p => p.type === 'error_then_success_pattern')).toBe(false);
  });

  it('does NOT detect error_then_success when both fail', () => {
    const activity = [
      makeActivity({ statusCode: 401, operationType: 'authentication' }),
      makeActivity({ statusCode: 403, operationType: 'authentication' }),
    ];
    const patterns = detectSuspiciousPatterns(activity);
    expect(patterns.some(p => p.type === 'error_then_success_pattern')).toBe(false);
  });

  it('index===0 branch: single-entry activity never triggers error_then_success', () => {
    const activity = [makeActivity({ statusCode: 401, operationType: 'authentication' })];
    const patterns = detectSuspiciousPatterns(activity);
    expect(patterns.some(p => p.type === 'error_then_success_pattern')).toBe(false);
  });

  it('returns multiple pattern types simultaneously', () => {
    const now = Date.now();
    const activity = [
      ...Array.from({ length: 10 }, () => makeActivity({ statusCode: 500 })),
      ...Array.from({ length: 10 }, () => makeActivity({ timestamp: now - 500, ip: '1.1.1.1' })),
      makeActivity({ ip: '2.2.2.2', timestamp: now - 500 }),
      makeActivity({ ip: '3.3.3.3', timestamp: now - 500 }),
    ];
    const patterns = detectSuspiciousPatterns(activity);
    expect(patterns.length).toBeGreaterThanOrEqual(2);
  });
});
