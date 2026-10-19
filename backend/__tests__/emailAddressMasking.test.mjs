/**
 * Email masking for server logs (owner ruling 2026-10-19, Equoria-jeci6 fix
 * round 1; the wider auth sweep is Equoria-5vyuh).
 *
 * Server logs never carry a raw email address. They carry the masked form
 * `first character + *** + @domain`, the shape `maskEmailAddress` already
 * gives read surfaces (Equoria-6p398.11). `maskEmailsInText` applies it to
 * free text such as an error message, where the address may appear in any
 * case, so a log line cannot leak one by echoing a driver or transport error.
 *
 * Pure functions: no DB, no mocks.
 */

import { describe, it, expect } from '@jest/globals';

import { maskEmailAddress, maskEmailsInText } from '../utils/emailIdentityPolicy.mjs';

describe('maskEmailAddress', () => {
  it('keeps the first character and the domain', () => {
    expect(maskEmailAddress('stacey@example.com')).toBe('s***@example.com');
  });

  it('normalises case and surrounding whitespace first', () => {
    expect(maskEmailAddress('  Stacey@Example.COM ')).toBe('s***@example.com');
  });

  it('reveals nothing for a shape it does not recognise', () => {
    expect(maskEmailAddress('no-at-sign')).toBe('***');
    expect(maskEmailAddress('@example.com')).toBe('***');
    expect(maskEmailAddress('stacey@')).toBe('***');
  });

  it('returns null when there is no address', () => {
    expect(maskEmailAddress(undefined)).toBeNull();
    expect(maskEmailAddress('   ')).toBeNull();
    expect(maskEmailAddress(42)).toBeNull();
  });
});

describe('maskEmailsInText', () => {
  it('masks every address in free text and keeps the rest', () => {
    const text = 'Invalid `findUnique()` where: { email: "Stacey.H@Example.com" } cc ops@equoria.test';
    const masked = maskEmailsInText(text);
    expect(masked).toBe('Invalid `findUnique()` where: { email: "s***@example.com" } cc o***@equoria.test');
    expect(masked.toLowerCase()).not.toContain('stacey.h@example.com');
    expect(masked).not.toContain('ops@equoria.test');
  });

  it('leaves text without an address unchanged', () => {
    expect(maskEmailsInText('Transaction already closed: timeout 500 ms')).toBe(
      'Transaction already closed: timeout 500 ms',
    );
  });

  it('stringifies non-string input and passes null/undefined through', () => {
    expect(maskEmailsInText(null)).toBeNull();
    expect(maskEmailsInText(undefined)).toBeUndefined();
    expect(maskEmailsInText(new Error('send to a@b.co failed'))).toBe('Error: send to a***@b.co failed');
  });
});
