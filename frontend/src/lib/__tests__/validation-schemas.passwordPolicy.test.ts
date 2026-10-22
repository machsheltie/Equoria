/**
 * The client password rule is the server's rule (Equoria-hh4dc, Equoria-oey96.39).
 *
 * Register, reset-password and change-password all run
 * backend/modules/auth/validators/strongPasswordChain.mjs: 12-128 characters
 * with a lowercase letter, an uppercase letter, a digit and one of @$!%*?&.
 * The client advertised and accepted 8+, so a player who followed the
 * on-screen rule got a server 400.
 */

import { describe, it, expect } from 'vitest';
import { passwordSchema, calculatePasswordStrength } from '../validation-schemas';
import { VALIDATION_RULES, PASSWORD_STRENGTH } from '../constants';

describe('passwordSchema matches the server password policy', () => {
  it('rejects an 11-character password that has every character class', () => {
    expect(passwordSchema.safeParse('Abcdefg1!xy').success).toBe(false);
  });

  it('accepts a 12-character password that has every character class', () => {
    expect(passwordSchema.safeParse('Abcdefg1!xyz').success).toBe(true);
  });

  it('names 12 in the length message', () => {
    const result = passwordSchema.safeParse('Abc1!');
    expect(result.success).toBe(false);
    const messages = result.success ? [] : result.error.issues.map((issue) => issue.message);
    expect(messages).toContain('Password must be at least 12 characters');
  });

  it('rejects a password over the server maximum of 128 characters', () => {
    expect(passwordSchema.safeParse(`Aa1!${'x'.repeat(125)}`).success).toBe(false);
    expect(passwordSchema.safeParse(`Aa1!${'x'.repeat(124)}`).success).toBe(true);
  });
});

describe('the strength meter reflects the 12-character rule', () => {
  it('never rates an 11-character password above fair', () => {
    expect(['weak', 'fair']).toContain(calculatePasswordStrength('Abcdefg1!xy').label);
  });

  it('rates a 12-character password with every class as acceptable', () => {
    expect(['good', 'strong']).toContain(calculatePasswordStrength('Abcdefg1!xyz').label);
  });
});

describe('shared client password constants', () => {
  it('state the server minimum', () => {
    expect(VALIDATION_RULES.password.minLength).toBe(12);
    expect(VALIDATION_RULES.password.maxLength).toBe(128);
    const length = PASSWORD_STRENGTH.requirements.find((r) => r.key === 'minLength');
    expect(length?.label).toBe('12+ characters');
    expect(length?.check('a'.repeat(11))).toBe(false);
    expect(length?.check('a'.repeat(12))).toBe(true);
  });
});
