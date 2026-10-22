import { describe, it, expect } from '@jest/globals';
import { sanitizeLogData } from '../middleware/auditLog.mjs';

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
// Equoria-hjnrc — the unmounted audit pipeline stays deleted
// ---------------------------------------------------------------------------
describe('auditLog module surface (Equoria-hjnrc)', () => {
  it('exports only the live audit trail and the redactor', async () => {
    const mod = await import('../middleware/auditLog.mjs');
    expect(Object.keys(mod).sort()).toEqual(
      ['classifyAuditAction', 'default', 'globalAuditTrail', 'sanitizeLogData', 'storeAuditLog'].sort(),
    );
    expect(Object.keys(mod.default).sort()).toEqual(
      ['classifyAuditAction', 'globalAuditTrail', 'storeAuditLog'].sort(),
    );
  });
});
