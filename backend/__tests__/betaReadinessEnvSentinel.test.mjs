/**
 * Beta-readiness env sentinel + guard (Equoria-aih8)
 *
 * Source: sprint-change-proposal-2026-04-15.md §4.5 hardening. Three
 * behaviours are correct TODAY but were only pinned by comment convention —
 * a future edit could silently re-open a bypass with nothing failing CI.
 * This sentinel converts those conventions into enforced assertions.
 *
 *  1. SENTINEL — `rateLimiting.mjs` `isTestEnv` must NOT treat
 *     `beta-readiness` (or `beta`) as a test env. If it did, the readiness
 *     gate / beta deployment would silently bypass rate limiting via the
 *     `TEST_RATE_LIMIT_*` env knobs, defeating the production-parity intent
 *     of the gate. Asserts the exact `isTestEnv` predicate string and that
 *     the source contains no `beta`/`beta-readiness` token inside it.
 *
 *  2. GUARD — `backend/env.beta` and `backend/env.beta-readiness` must NOT
 *     define `SKIP_AUTH_FOR_TESTING` or `ENABLE_DEBUG_ROUTES`. Those keys
 *     are auth/route bypass switches; they belong only to local/test envs,
 *     never to a tester-facing or readiness-gate env.
 *
 *  3. DOC PIN — `backend/app.mjs` carries the per-env cap-divergence
 *     rationale (a TRACKED source-of-truth comment, deliberately NOT in a
 *     gitignored test README), and the documented numbers must match the
 *     code constants so the doc can't drift from `RATE_LIMIT_MAX_BY_ENV` /
 *     `MUTATION_RATE_LIMIT_MAX_BY_ENV`.
 *
 * Source-text sentinel (not an HTTP test): createRateLimiter() does not
 * expose its env-keyed caps for runtime introspection — the configuration
 * lives only in source. Same approach as authRateLimitDocDrift.sentinel.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');

function read(relPath) {
  return readFileSync(resolve(REPO_ROOT, relPath), 'utf8');
}

describe('Beta-readiness env sentinel (Equoria-aih8)', () => {
  // ── 1. SENTINEL: isTestEnv must not include beta / beta-readiness ─────────
  describe('rateLimiting.mjs isTestEnv predicate', () => {
    const src = read('backend/middleware/rateLimiting.mjs');

    it('declares isTestEnv as exactly NODE_ENV===test || JEST_WORKER_ID', () => {
      // The canonical predicate. If someone widens it (e.g. adds
      // `|| process.env.NODE_ENV === 'beta-readiness'`) this exact-match
      // assertion fails and forces a deliberate re-open of this issue.
      expect(src).toContain(
        "const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;",
      );
    });

    it('isTestEnv assignment line contains no beta / beta-readiness token', () => {
      const line = src.split('\n').find(l => l.includes('const isTestEnv ='));
      expect(line).toBeDefined();
      expect(line).not.toMatch(/beta/i);
    });

    it('does not key any test-bypass env override off beta or beta-readiness', () => {
      // The only env-driven rate-limit relaxation is the TEST_RATE_LIMIT_*
      // pair, gated solely by isTestEnv. Assert no beta* string sits next to
      // a TEST_RATE_LIMIT_ override anywhere in the file.
      const overrideRegex = /(beta-readiness|NODE_ENV\s*===\s*'beta')[^\n]*TEST_RATE_LIMIT_/;
      expect(src).not.toMatch(overrideRegex);
    });
  });

  // ── 2. GUARD: beta env files must not define bypass switches ──────────────
  describe('env.beta / env.beta-readiness bypass-switch guard', () => {
    const FORBIDDEN = ['SKIP_AUTH_FOR_TESTING', 'ENABLE_DEBUG_ROUTES'];

    for (const envFile of ['backend/env.beta', 'backend/env.beta-readiness']) {
      it(`${envFile} exists`, () => {
        expect(existsSync(resolve(REPO_ROOT, envFile))).toBe(true);
      });

      for (const key of FORBIDDEN) {
        it(`${envFile} does not define ${key}`, () => {
          const lines = read(envFile)
            .split('\n')
            .map(l => l.trim())
            .filter(l => l && !l.startsWith('#'));
          // Match an assignment `KEY=...` (allow surrounding whitespace);
          // a commented mention is fine, an active assignment is not.
          const defines = lines.some(l => new RegExp(`^${key}\\s*=`).test(l));
          expect(defines).toBe(false);
        });
      }
    }
  });

  // ── 3. DOC PIN: documented cap divergence matches the code ────────────────
  describe('per-env cap divergence doc ↔ code agreement', () => {
    const appSrc = read('backend/app.mjs');
    const rlSrc = read('backend/middleware/rateLimiting.mjs');

    it('app.mjs RATE_LIMIT_MAX_BY_ENV still has beta:3000 and beta-readiness:1000', () => {
      expect(appSrc).toMatch(/beta:\s*3000/);
      expect(appSrc).toMatch(/'beta-readiness':\s*1000/);
    });

    it('rateLimiting.mjs MUTATION_RATE_LIMIT_MAX_BY_ENV still has beta:120 / production:30 and NO beta-readiness key', () => {
      const block = rlSrc.slice(
        rlSrc.indexOf('const MUTATION_RATE_LIMIT_MAX_BY_ENV'),
        rlSrc.indexOf('export const mutationRateLimiter'),
      );
      expect(block).toMatch(/beta:\s*120/);
      expect(block).toMatch(/production:\s*30/);
      // beta-readiness intentionally absent → inherits production 30/min.
      expect(block).not.toMatch(/beta-readiness/);
    });

    it('app.mjs carries the cap-divergence rationale with numbers matching the code', () => {
      expect(appSrc).toContain('Per-environment cap divergence rationale (Equoria-aih8)');
      // The documented table values must match the code constants above.
      expect(appSrc).toMatch(/3000\s+1000\s+100/); // apiLimiter row
      expect(appSrc).toMatch(/120\s+\(none → 30\)\s+30/); // mutation row
      // The bypass-safety invariant must be stated in the tracked comment.
      expect(appSrc).toMatch(/HIGHER CAP, never a BYPASS/);
    });
  });
});
