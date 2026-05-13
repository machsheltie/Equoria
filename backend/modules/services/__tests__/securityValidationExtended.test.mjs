/**
 * Extended tests for securityValidation utility — covers functions missing from
 * the existing securityValidation.test.mjs: validatePlayerData, validateBreedingData,
 * validateRateLimit.
 * Equoria-rr7 coverage sprint. Pure functions — no DB, no mocks needed.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { validatePlayerData, validateBreedingData, validateRateLimit } from '../../../utils/securityValidation.mjs';

// ─── validatePlayerData ───────────────────────────────────────────────────────

describe('validatePlayerData', () => {
  it('returns isValid true for empty object (all fields optional)', () => {
    const result = validatePlayerData({});
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts valid name', () => {
    const result = validatePlayerData({ name: 'ValidName' });
    expect(result.isValid).toBe(true);
    expect(result.sanitized.name).toBe('ValidName');
  });

  it('returns error for name shorter than 2 chars', () => {
    const result = validatePlayerData({ name: 'A' });
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toMatch(/2 and 30/);
  });

  it('returns error for name longer than 30 chars', () => {
    const result = validatePlayerData({ name: 'A'.repeat(31) });
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toMatch(/2 and 30/);
  });

  it('returns error for name with invalid characters', () => {
    const result = validatePlayerData({ name: 'Bad<Name>' });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => /invalid character/i.test(e))).toBe(true);
  });

  it('accepts valid email', () => {
    const result = validatePlayerData({ email: 'user@example.com' });
    expect(result.isValid).toBe(true);
    expect(result.sanitized.email).toBe('user@example.com');
  });

  it('returns error for invalid email format', () => {
    const result = validatePlayerData({ email: 'not-an-email' });
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toMatch(/email/i);
  });

  it('lowercases and trims email', () => {
    const result = validatePlayerData({ email: '  USER@EXAMPLE.COM  ' });
    expect(result.sanitized.email).toBe('user@example.com');
  });

  it('accepts valid money value', () => {
    const result = validatePlayerData({ money: 500 });
    expect(result.isValid).toBe(true);
    expect(result.sanitized.money).toBe(500);
  });

  it('returns error for negative money', () => {
    const result = validatePlayerData({ money: -1 });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => /money/i.test(e))).toBe(true);
  });

  it('returns error for money exceeding 100M', () => {
    const result = validatePlayerData({ money: 100000001 });
    expect(result.isValid).toBe(false);
  });

  it('accepts valid level', () => {
    const result = validatePlayerData({ level: 5 });
    expect(result.isValid).toBe(true);
    expect(result.sanitized.level).toBe(5);
  });

  it('returns error for level < 1', () => {
    const result = validatePlayerData({ level: 0 });
    expect(result.isValid).toBe(false);
  });

  it('returns error for level > 100', () => {
    const result = validatePlayerData({ level: 101 });
    expect(result.isValid).toBe(false);
  });

  it('accepts valid xp', () => {
    const result = validatePlayerData({ xp: 1000 });
    expect(result.isValid).toBe(true);
    expect(result.sanitized.xp).toBe(1000);
  });

  it('returns error for negative xp', () => {
    const result = validatePlayerData({ xp: -100 });
    expect(result.isValid).toBe(false);
  });

  it('returns error for xp exceeding 10M', () => {
    const result = validatePlayerData({ xp: 10000001 });
    expect(result.isValid).toBe(false);
  });

  it('validates settings object — removes unknown keys', () => {
    const result = validatePlayerData({
      settings: { darkMode: true, hackKey: 'bad' },
    });
    expect(result.isValid).toBe(true);
    expect(result.sanitized.settings.darkMode).toBe(true);
    expect(result.sanitized.settings.hackKey).toBeUndefined();
  });

  it('returns error when settings is not an object', () => {
    const result = validatePlayerData({ settings: 'not-an-object' });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => /settings/i.test(e))).toBe(true);
  });

  it('accepts valid settings keys', () => {
    const result = validatePlayerData({
      settings: { darkMode: true, notifications: false, privacy: 'public', language: 'en' },
    });
    expect(result.isValid).toBe(true);
  });
});

// ─── validateBreedingData ─────────────────────────────────────────────────────

describe('validateBreedingData', () => {
  it('returns isValid true for valid sireId and damId', () => {
    const result = validateBreedingData({ sireId: 1, damId: 2 });
    expect(result.isValid).toBe(true);
    expect(result.sanitized.sireId).toBe(1);
    expect(result.sanitized.damId).toBe(2);
  });

  it('returns error when sireId is missing', () => {
    const result = validateBreedingData({ damId: 2 });
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toMatch(/sire.*dam/i);
  });

  it('returns error when damId is missing', () => {
    const result = validateBreedingData({ sireId: 1 });
    expect(result.isValid).toBe(false);
  });

  it('returns error for invalid sireId (non-numeric)', () => {
    const result = validateBreedingData({ sireId: 'abc', damId: 2 });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => /sire/i.test(e))).toBe(true);
  });

  it('returns error for invalid damId (negative)', () => {
    const result = validateBreedingData({ sireId: 1, damId: -5 });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => /dam/i.test(e))).toBe(true);
  });

  it('returns error when sireId === damId (self-breeding)', () => {
    const result = validateBreedingData({ sireId: 5, damId: 5 });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => /itself/i.test(e))).toBe(true);
  });

  it('accepts valid breedingFee', () => {
    const result = validateBreedingData({ sireId: 1, damId: 2, breedingFee: 500 });
    expect(result.isValid).toBe(true);
    expect(result.sanitized.breedingFee).toBe(500);
  });

  it('returns error for negative breedingFee', () => {
    const result = validateBreedingData({ sireId: 1, damId: 2, breedingFee: -100 });
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => /fee/i.test(e))).toBe(true);
  });

  it('returns error for breedingFee exceeding 1M', () => {
    const result = validateBreedingData({ sireId: 1, damId: 2, breedingFee: 1000001 });
    expect(result.isValid).toBe(false);
  });

  it('returns empty errors array on success', () => {
    const result = validateBreedingData({ sireId: 10, damId: 20 });
    expect(result.errors).toHaveLength(0);
  });
});

// ─── validateRateLimit ────────────────────────────────────────────────────────

describe('validateRateLimit', () => {
  beforeEach(() => {
    // Clear the global rateLimitStore between tests
    if (global.rateLimitStore) {
      global.rateLimitStore.clear();
    }
  });

  it('allows the first request', () => {
    const result = validateRateLimit('user1', 'test-op');
    expect(result.allowed).toBe(true);
    expect(typeof result.remaining).toBe('number');
  });

  it('decrements remaining count with each request', () => {
    const r1 = validateRateLimit('user2', 'dec-op', 5);
    const r2 = validateRateLimit('user2', 'dec-op', 5);
    expect(r1.remaining).toBe(4);
    expect(r2.remaining).toBe(3);
  });

  it('blocks after maxRequests is reached', () => {
    const maxRequests = 3;
    for (let i = 0; i < maxRequests; i++) {
      validateRateLimit('user3', 'block-op', maxRequests);
    }
    const result = validateRateLimit('user3', 'block-op', maxRequests);
    expect(result.allowed).toBe(false);
    expect(typeof result.resetTime).toBe('number');
  });

  it('different users are tracked independently', () => {
    validateRateLimit('userA', 'shared-op', 2);
    validateRateLimit('userA', 'shared-op', 2);
    const blockedA = validateRateLimit('userA', 'shared-op', 2);
    expect(blockedA.allowed).toBe(false);

    const userB = validateRateLimit('userB', 'shared-op', 2);
    expect(userB.allowed).toBe(true);
  });

  it('different operations for the same user are tracked independently', () => {
    validateRateLimit('user4', 'op1', 1);
    const op1Blocked = validateRateLimit('user4', 'op1', 1);
    expect(op1Blocked.allowed).toBe(false);

    const op2 = validateRateLimit('user4', 'op2', 1);
    expect(op2.allowed).toBe(true);
  });

  it('respects custom windowMs — old requests expire', async () => {
    const shortWindow = 50; // 50ms
    validateRateLimit('user5', 'window-op', 2, shortWindow);
    validateRateLimit('user5', 'window-op', 2, shortWindow);
    // Both slots used

    await new Promise(resolve => setTimeout(resolve, 60)); // wait for window to expire
    const result = validateRateLimit('user5', 'window-op', 2, shortWindow);
    expect(result.allowed).toBe(true);
  });

  it('initializes global.rateLimitStore if not present', () => {
    delete global.rateLimitStore;
    const result = validateRateLimit('user6', 'init-op');
    expect(result.allowed).toBe(true);
    expect(global.rateLimitStore).toBeDefined();
  });
});
