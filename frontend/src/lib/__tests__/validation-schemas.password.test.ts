/**
 * passwordSchema + calculatePasswordStrength — direct unit tests (Equoria-8d5c)
 *
 * Source: sprint-change-proposal-2026-04-15.md 4.7 line 80. Previously the
 * schema + strength meter were only exercised indirectly via RegisterPage
 * form submission. This file tests them directly.
 *
 * AC (Equoria-8d5c):
 *  - hash-suffixed sample is NOT strong-valid and fails passwordSchema
 *  - bang-suffixed sample IS strong-valid and passes passwordSchema
 *  - the special-char set equals the schema set (@$!%*?&)
 *  - loop check: every input scored Strong also passes passwordSchema parse
 *
 * Equoria-49csj (RESOLVED): the meter/schema divergence Equoria-8d5c
 * surfaced — calculatePasswordStrength labelled a 12+ char password with no
 * @$!%*?& char 'strong' while passwordSchema rejects it — is now FIXED.
 * calculatePasswordStrength caps any schema-invalid password at 'fair'. The
 * former DEFECT LOCK test is replaced by two arbitrary-corpus invariant
 * tests (no schema-invalid input is ever 'strong'/'good'; every 'strong'/
 * 'good' input passes the schema) plus a reconciled regression test.
 */

import { describe, it, expect } from 'vitest';
import { passwordSchema, calculatePasswordStrength } from '../validation-schemas';

// The exact special-character class the schema enforces.
const SCHEMA_SPECIAL_CHARS = ['@', '$', '!', '%', '*', '?', '&'] as const;

describe('passwordSchema (Equoria-8d5c)', () => {
  it('special-char set equals the documented schema set @$!%*?&', () => {
    // Each schema special char makes an otherwise-conformant password pass.
    for (const ch of SCHEMA_SPECIAL_CHARS) {
      const pw = `Abcdef1${ch}`;
      expect(passwordSchema.safeParse(pw).success).toBe(true);
    }
    // A char OUTSIDE the set (e.g. '#', '^', '-') does NOT satisfy the
    // special-char requirement.
    for (const ch of ['#', '^', '-', '_', '.']) {
      const pw = `Abcdef1${ch}`;
      expect(passwordSchema.safeParse(pw).success).toBe(false);
    }
  });

  it('hash-suffixed sample is NOT strong-valid and fails passwordSchema', () => {
    const hashSample = 'Abcdef1#';
    expect(passwordSchema.safeParse(hashSample).success).toBe(false);
    // '#' is not a schema special char, so this is not "strong-valid"
    // (it cannot be both strong AND schema-valid).
    const { label } = calculatePasswordStrength(hashSample);
    const strongValid = label === 'strong' && passwordSchema.safeParse(hashSample).success;
    expect(strongValid).toBe(false);
  });

  it('bang-suffixed sample IS strong-valid and passes passwordSchema', () => {
    const bangSample = 'Abcdef1!';
    expect(passwordSchema.safeParse(bangSample).success).toBe(true);
    const { label } = calculatePasswordStrength(bangSample);
    expect(label).toBe('strong');
    const strongValid = label === 'strong' && passwordSchema.safeParse(bangSample).success;
    expect(strongValid).toBe(true);
  });
});

describe('calculatePasswordStrength ↔ passwordSchema consistency (Equoria-49csj)', () => {
  // Representative corpus of passwords a user would submit through the
  // validated registration/reset form (all contain a schema special char).
  const intendedStrongCorpus = [
    'Abcdef1!',
    'StrongP@ss12',
    'My$ecure9Pw!',
    'Zz9?aA8&bB7%',
    'Qwerty12!Xx',
    'P@ssw0rd!Long9',
    'aB3$cD4*eF5?',
  ];

  it('loop check: every corpus input scored Strong also passes passwordSchema parse', () => {
    for (const pw of intendedStrongCorpus) {
      const { label } = calculatePasswordStrength(pw);
      if (label === 'strong') {
        const parsed = passwordSchema.safeParse(pw);
        expect(parsed.success, `"${pw}" scored strong but failed passwordSchema`).toBe(true);
      }
    }
  });

  // Equoria-49csj: arbitrary-input corpus (NOT pre-filtered to schema-valid
  // passwords). Mixes schema-valid, missing-special, too-short, missing-case,
  // missing-digit, empty. The invariant below must hold for ALL of them.
  const arbitraryCorpus = [
    'Abcdefghij12', // 12+, lower+upper+digit, NO special — the original defect
    'Abcdef1!', // schema-valid
    'abcdefghij12', // no upper, no special
    'ABCDEFGHIJ12', // no lower, no special
    'Abcdefgh', // 8 chars, no digit, no special
    'Abc1!', // has special+digit+case but only 5 chars (too short)
    'StrongP@ss12', // schema-valid
    'NoSpecialButLong1234567890Aa', // long, case, digit, NO special
    'Aa1#Aa1#Aa1#', // 12+, case, digit, but '#' is OUTSIDE schema special set
    '', // empty
    'aaaaaaaaaaaa', // 12 lowercase only
    'Zz9?aA8&bB7%', // schema-valid
  ];

  it('INVARIANT: no password that fails passwordSchema is ever labeled strong or good', () => {
    for (const pw of arbitraryCorpus) {
      const { label } = calculatePasswordStrength(pw);
      const schemaOk = passwordSchema.safeParse(pw).success;
      if (!schemaOk) {
        expect(
          label === 'strong' || label === 'good',
          `"${pw}" fails passwordSchema but was labeled "${label}" (must not be strong/good)`
        ).toBe(false);
      }
    }
  });

  it('INVARIANT: every password labeled strong (or good) passes passwordSchema', () => {
    for (const pw of arbitraryCorpus) {
      const { label } = calculatePasswordStrength(pw);
      if (label === 'strong' || label === 'good') {
        expect(
          passwordSchema.safeParse(pw).success,
          `"${pw}" labeled "${label}" but failed passwordSchema`
        ).toBe(true);
      }
    }
  });

  it('reconciled: the formerly-divergent 12+/no-special password is no longer strong/good', () => {
    // Was the Equoria-8d5c DEFECT LOCK. Now flipped to assert the fix:
    // 'Abcdefghij12' fails passwordSchema (no @$!%*?&) so it must NOT be
    // labeled strong or good — the meter no longer lies to the user.
    const schemaInvalid = 'Abcdefghij12';
    expect(passwordSchema.safeParse(schemaInvalid).success).toBe(false);
    const { label } = calculatePasswordStrength(schemaInvalid);
    expect(label === 'strong' || label === 'good').toBe(false);
  });

  it('a fully schema-valid 12+ char password is still labeled strong (no false negative)', () => {
    const good = 'StrongP@ss12';
    expect(passwordSchema.safeParse(good).success).toBe(true);
    expect(calculatePasswordStrength(good).label).toBe('strong');
  });
});
