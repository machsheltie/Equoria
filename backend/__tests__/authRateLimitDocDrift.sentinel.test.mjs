/**
 * Auth rate-limit doc-drift sentinel (Equoria-wfz1)
 *
 * Equoria-f5r1 found the auth rate limiter is configured at
 * `max: 200` with `skipSuccessfulRequests: true` (only failed auth
 * attempts count), but ~10 canonical docs claimed "5 attempts / 15 min".
 * wfz1 codified the actual value (200 failed / 15 min) across the
 * canonical docs.
 *
 * This sentinel locks code ↔ docs agreement so the drift cannot
 * silently reappear:
 *
 *  1. backend/middleware/rateLimiting.mjs still declares the auth
 *     limiter as max: 200 + skipSuccessfulRequests: true. If someone
 *     changes the cap (e.g. tightens to 5) WITHOUT updating the docs,
 *     this fails and forces the doc update (or a deliberate wfz1
 *     re-open).
 *
 *  2. Every canonical doc the issue named now states "200 failed"
 *     for the auth limiter and does NOT contain the stale
 *     "5 attempts/requests per 15 min" auth claim.
 *
 *  This is a source-text sentinel (not an HTTP test) because the
 *  express-rate-limit middleware returned by createRateLimiter() does
 *  not expose its `max`/`skipSuccessfulRequests` for runtime
 *  introspection — the configuration lives only in source.
 *
 *  NOTE: Sentry security-alert thresholds ("Auth Failures | 5 events |
 *  15 minutes" in SENTRY_SETUP.md / SECURITY_ASSESSMENT_REPORT.md:299)
 *  are a DIFFERENT subsystem (backend/config/sentry.mjs:185,
 *  SecurityAlertThresholds[AUTH_FAILURE] = { count: 5, windowMinutes:
 *  15 }) and are intentionally NOT asserted here — they correctly
 *  remain 5/15.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');

function read(relPath) {
  return readFileSync(resolve(REPO_ROOT, relPath), 'utf8');
}

describe('Auth rate-limit code ↔ docs drift sentinel (Equoria-wfz1)', () => {
  it('rateLimiting.mjs still declares authRateLimiter as max: 200 + skipSuccessfulRequests', () => {
    const src = read('backend/middleware/rateLimiting.mjs');
    // Isolate the authRateLimiter block so a `max: 200` elsewhere
    // (e.g. mutation dev cap) cannot satisfy this by accident.
    const startIdx = src.indexOf('export const authRateLimiter = createRateLimiter({');
    expect(startIdx).toBeGreaterThan(-1);
    const block = src.slice(startIdx, startIdx + 400);

    expect(block).toMatch(/max:\s*200\b/);
    expect(block).toMatch(/skipSuccessfulRequests:\s*true/);
  });

  it('every canonical doc states "200 failed" for the auth limiter and has no stale 5/15 auth claim', () => {
    const canonicalDocs = [
      'docs/architecture.md',
      'docs/api-contracts-backend/rate-limiting.md',
      'docs/product/PRD-08-Security-Architecture.md',
      'docs/product/PRD-02-Core-Features.md',
      'docs/SECURITY_ASSESSMENT_REPORT.md',
      'docs/development-guide.md',
      'docs/project_context.md',
      'docs/migration-deploy-checklist.md',
      '.claude/rules/SECURITY.md',
    ];

    // Stale-claim patterns that specifically describe the AUTH rate
    // limiter as 5 per 15 min. Deliberately narrow so Sentry-alert
    // "5 events / 15 minutes" lines are not matched.
    const staleAuthClaim =
      /\b5\s+(?:requests?|attempts?|login attempts?|failed (?:requests?|attempts?))\s+per\s+15\s*min/i;

    for (const docPath of canonicalDocs) {
      const text = read(docPath);
      expect({ docPath, hasStale: staleAuthClaim.test(text) }).toEqual({
        docPath,
        hasStale: false,
      });
      // Positive assertion: the doc must now state the real value.
      expect({ docPath, has200Failed: /200 failed/i.test(text) }).toEqual({
        docPath,
        has200Failed: true,
      });
    }
  });

  // ---- Equoria-c9y4: non-auth limiter code↔docs drift ----
  // The same canonical tables also misstated the gameplay limiters vs
  // rateLimiting.mjs actuals (Training/Competition/Breeding/Foal/Mutation).
  // These lock the reconciled values so the drift cannot silently return.
  it('rateLimiting.mjs still declares the non-auth limiters at the documented values (c9y4)', () => {
    const src = read('backend/middleware/rateLimiting.mjs');
    const block = exportName => {
      const i = src.indexOf(`export const ${exportName} = createRateLimiter({`);
      expect({ exportName, found: i > -1 }).toEqual({ exportName, found: true });
      return src.slice(i, i + 400);
    };

    // Training: 20 / 1 min, only failed requests counted.
    const training = block('trainingRateLimiter');
    expect(training).toMatch(/windowMs:\s*60\s*\*\s*1000/);
    expect(training).toMatch(/max:\s*20\b/);
    expect(training).toMatch(/skipSuccessfulRequests:\s*true/);

    // Competition: 20 / 5 min.
    const competition = block('competitionRateLimiter');
    expect(competition).toMatch(/windowMs:\s*5\s*\*\s*60\s*\*\s*1000/);
    expect(competition).toMatch(/max:\s*20\b/);

    // Breeding: 10 / 5 min.
    const breeding = block('breedingRateLimiter');
    expect(breeding).toMatch(/windowMs:\s*5\s*\*\s*60\s*\*\s*1000/);
    expect(breeding).toMatch(/max:\s*10\b/);

    // Foal: 15 / 1 min.
    const foal = block('foalRateLimiter');
    expect(foal).toMatch(/windowMs:\s*60\s*\*\s*1000/);
    expect(foal).toMatch(/max:\s*15\b/);

    // Mutation: production cap 30 / 1 min (beta/dev overrides allowed).
    const mutation = block('mutationRateLimiter');
    expect(mutation).toMatch(/windowMs:\s*60\s*\*\s*1000/);
    expect(src).toMatch(/production:\s*30\b/);
  });

  it('the two canonical limiter tables state the reconciled non-auth values and no stale ones (c9y4)', () => {
    const rl = read('docs/api-contracts-backend/rate-limiting.md');
    // Reconciled rows present.
    expect(rl).toMatch(/Training\s*\|\s*20 failed requests\s*\|\s*1 minute/);
    expect(rl).toMatch(/Competition\s*\|\s*20 entries\s*\|\s*5 minutes/);
    expect(rl).toMatch(/Breeding\s*\|\s*10 operations\s*\|\s*5 minutes/);
    // Stale claims gone.
    expect(rl).not.toMatch(/Training\s*\|\s*10 requests\s*\|\s*1 minute/);
    expect(rl).not.toMatch(/Competition\s*\|\s*20 entries\s*\|\s*1 hour/);

    const prd = read('docs/product/PRD-08-Security-Architecture.md');
    expect(prd).toMatch(/\*\*Training\*\*\s*\|\s*20 failed\s*\|\s*1 minute/);
    expect(prd).toMatch(/\*\*Breeding\*\*\s*\|\s*10\s*\|\s*5 minutes/);
    // The phantom financial limiter row must be replaced by the posture note.
    expect(prd).not.toMatch(/\*\*Financial\*\*\s*\|\s*20\s*\|\s*15 minutes/);
    expect(prd).toMatch(/no dedicated\s*\n?>?\s*financial rate limiter/i);
  });

  it('SENTRY_SETUP.md auth-failure ALERT threshold is intentionally still 5 events / 15 minutes', () => {
    // Negative-space guard: proves the wfz1 doc edits did NOT
    // accidentally rewrite the Sentry alert threshold (a different
    // subsystem). If a future over-eager "fix all the 5/15s" edit
    // clobbers this, the sentinel catches the mistake.
    const sentryDoc = read('docs/SENTRY_SETUP.md');
    expect(sentryDoc).toMatch(/Auth Failures\s*\|\s*5 events\s*\|\s*15 minutes/);
  });
});
