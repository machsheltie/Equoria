/**
 * Sentinel — backend/modules/auth/controllers/authController.mjs MUST NOT use
 * `req.headers['x-forwarded-for']` as a fallback for `req.ip` in audit-IP
 * derivation (refs Equoria-twt4g, Equoria-n62tl).
 *
 * The defect class: writing
 *   `req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress`
 * to derive an audit-trail IP re-enables ATTACKER-CONTROLLED IP injection in
 * the failure mode where Express's `trust proxy` is misconfigured / disabled
 * and `req.ip` is undefined. The XFF header is client-supplied and forgeable;
 * an unknown IP (null) is honest, a forged one is a stealth-frame primitive
 * that lets an attacker plant fake IPs into audit / rate-limit / lockout
 * telemetry.
 *
 * The canonical pattern (Equoria-n62tl, comment at authController.mjs:976-984)
 * is `req.ip || req.connection?.remoteAddress || null`.
 *
 * This sentinel walks the controller source and asserts:
 *   1. ZERO occurrences of the literal substring `x-forwarded-for` in
 *      executable code (comments allowed — the n62tl doctrine comment
 *      explains why the fallback is dropped).
 *   2. The string `req.headers['x-forwarded-for']` does not appear in
 *      executable code.
 *   3. Every `req.ip || …` fallback chain ends in `|| null`.
 *
 * If a NEW sibling site in this file ever re-introduces the XFF fallback,
 * THIS test fails — that is the entire purpose of the sentinel.
 *
 * @module __tests__/auth/authControllerNoXffFallback.sentinel
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CONTROLLER_PATH = resolve(__dirname, '..', 'modules', 'auth', 'controllers', 'authController.mjs');

describe('authController XFF-fallback sentinel (Equoria-twt4g / Equoria-n62tl)', () => {
  const source = readFileSync(CONTROLLER_PATH, 'utf8');

  // Strip /* … */ and // … comments so doctrine commentary doesn't false-trip
  // the structural checks below. The forensic asserts target executable code.
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('contains no x-forwarded-for literal in executable code', () => {
    const xffOccurrences = [...stripped.matchAll(/x-forwarded-for/gi)];
    if (xffOccurrences.length > 0) {
      console.error('[twt4g sentinel] x-forwarded-for re-introduced into executable code', {
        count: xffOccurrences.length,
        matches: xffOccurrences.map(m => ({
          index: m.index,
          context: stripped.slice(Math.max(0, m.index - 40), m.index + 80),
        })),
      });
    }
    expect(xffOccurrences).toHaveLength(0);
  });

  it("contains no `req.headers['x-forwarded-for']` lookup in executable code", () => {
    expect(stripped.includes("req.headers['x-forwarded-for']")).toBe(false);
    expect(stripped.includes('req.headers["x-forwarded-for"]')).toBe(false);
  });

  it('every IP-derivation `req.ip ||` chain in executable code ends in `|| null`', () => {
    const reqIpFallbacks = [...stripped.matchAll(/req\.ip\s*\|\|[^;\n]+/g)];
    const offenders = reqIpFallbacks.filter(m => !/\|\|\s*null\b/.test(m[0]));
    if (offenders.length > 0) {
      console.error('[twt4g sentinel] req.ip fallback chain does not terminate in `|| null`', {
        count: offenders.length,
        matches: offenders.map(m => m[0]),
      });
    }
    expect(offenders).toHaveLength(0);
  });
});
