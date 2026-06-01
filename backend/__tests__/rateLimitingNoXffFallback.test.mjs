/**
 * rateLimiting.mjs — no XFF fallback in the rate-limit key (Equoria-8xdqo).
 *
 * Sibling of Equoria-n62tl. The auditController XFF-drop covered the
 * audit-IP write surface; this sentinel locks the same posture on the
 * rate-limit-key construction.
 *
 * The defect: when `app.set('trust proxy')` is misconfigured / disabled,
 * req.ip is undefined and a fallback like `req.headers['x-forwarded-for']`
 * lets an attacker forge a fresh value per request, minting a new bucket
 * key each time → effective rate quota is multiplied.
 *
 * Fix: drop the XFF fallback. Sentinel: grep the source — no occurrence of
 * `x-forwarded-for` in executable (non-comment) lines.
 */

import { describe, it, expect } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RATE_LIMITING_SRC = path.resolve(HERE, '..', 'middleware', 'rateLimiting.mjs');

// Strip block comments and single-line comments so the grep only sees
// executable code. JSDoc-style block comments span multiple lines.
function stripComments(src) {
  // Block comments first (greedy across lines).
  let out = src.replace(/\/\*[\s\S]*?\*\//g, '');
  // Then line comments — split per line so a `// foo` doesn't eat the rest
  // of the file.
  out = out
    .split('\n')
    .map(line => line.replace(/\/\/.*$/, ''))
    .join('\n');
  return out;
}

describe('rateLimiting.mjs — no XFF in rate-limit key (Equoria-8xdqo)', () => {
  it('SENTINEL: zero x-forwarded-for occurrences in executable code', () => {
    const src = fs.readFileSync(RATE_LIMITING_SRC, 'utf8');
    const code = stripComments(src);
    // Case-insensitive — Header lookups are case-insensitive at runtime,
    // and a regression that uses 'X-Forwarded-For' literal should still
    // fire this check.
    const matches = code.match(/x-forwarded-for/gi) || [];
    expect(matches).toHaveLength(0);
  });

  it("SENTINEL: the keyGenerator line uses req.ip || 'unknown' (the safe form)", () => {
    const src = fs.readFileSync(RATE_LIMITING_SRC, 'utf8');
    // The key-generation line MUST match the post-fix shape.
    expect(src).toMatch(/key\s*=\s*`ip:\$\{req\.ip\s*\|\|\s*['"]unknown['"]\}`/);
  });
});
