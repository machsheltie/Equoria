/**
 * Production cookie-name contract — regression canary.
 *
 * In production the CSRF cookie is named `__Host-csrf` (browser rules: must
 * be Secure, Path=/, no Domain). In every other env it is `_csrf`. The
 * adversarial review that triggered this correction found that the
 * generator was emitting `__Host-csrf` in production while the validator
 * read `_csrf` — breaking every real-world mutation.
 *
 * The correction unified both ends behind `CSRF_COOKIE_NAME` in
 * `backend/middleware/csrf.mjs`. This file proves two things the checklist
 * demands:
 *
 *   1. The single source of truth resolves correctly per-env. `_csrf` in
 *      the current test env, `__Host-csrf` when the module is loaded with
 *      NODE_ENV=production.
 *   2. `GET /auth/csrf-token` under production settings actually emits a
 *      `__Host-csrf=` Set-Cookie. (If the generator drifts back to `_csrf`
 *      in production, this test fails.)
 *
 * If either contract breaks, a mutation in production will never find a
 * readable cookie and every browser user will hit a 403 loop.
 *
 * Implementation note (Equoria-uy73, 2026-04-24): the production-mode HTTP
 * check previously used `jest.resetModules()` + `await import('../../app.mjs')`
 * inside the test. That triggers a known Jest ESM caching bug ("Module cache
 * already has entry …/@sentry/core/build/esm/index.js") that crashed the
 * full-suite pre-push run from April 22 onward. The check now spawns a
 * fresh Node child process which loads app.mjs once with NODE_ENV=production
 * and reports the resulting Set-Cookie headers over stdout. Same contract,
 * no Jest module-registry juggling.
 *
 * @module __tests__/integration/csrf-production-cookie.test
 */

import { jest as _jest } from '@jest/globals';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

_jest.setTimeout(30000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const probePath = path.resolve(__dirname, '../../tests/helpers/csrf-production-probe.mjs');

describe('CSRF cookie-name contract', () => {
  it('resolves to `_csrf` in the current (non-production) test env', async () => {
    const { CSRF_COOKIE_NAME } = await import('../../middleware/csrf.mjs');
    expect(CSRF_COOKIE_NAME).toBe('_csrf');
  });

  it('GET /auth/csrf-token under NODE_ENV=production emits __Host-csrf Set-Cookie', () => {
    // Spawn a fresh Node process with NODE_ENV=production. Running in a
    // child avoids the Jest-ESM module-registry bug that breaks the
    // jest.resetModules() + await import() pattern for modules that reach
    // @sentry/core, while still exercising the real middleware/app.
    // Inherit real test-env secrets (DATABASE_URL / JWT_SECRET / …) so
    // config.mjs passes its required-vars check, then flip NODE_ENV to
    // production so csrf.mjs resolves CSRF_COOKIE_NAME to `__Host-csrf`.
    // The request never touches the DB (csrf-token route is middleware-only),
    // so pointing at the test DATABASE_URL is safe.
    const result = spawnSync(process.execPath, ['--experimental-vm-modules', probePath], {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        LOG_LEVEL: 'error',
      },
      encoding: 'utf-8',
      timeout: 25000,
    });

    if (result.status !== 0) {
      throw new Error(
        `csrf-production-probe exited with ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
      );
    }

    // Probe wraps its JSON payload in __CSRF_PROBE_JSON__ sentinels so we
    // can pick it out even when surrounding stdout contains Winston logs,
    // Sentry flush lines, or MemoryManager teardown chatter.
    const SENTINEL = '__CSRF_PROBE_JSON__';
    const match = result.stdout.match(new RegExp(`${SENTINEL}(.*?)${SENTINEL}`));
    if (!match) {
      throw new Error(
        `csrf-production-probe did not emit sentinel-wrapped JSON.\nstatus=${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
      );
    }

    let probeOutput;
    try {
      probeOutput = JSON.parse(match[1]);
    } catch (err) {
      throw new Error(
        `csrf-production-probe JSON payload was malformed.\nmatched:${match[1]}\nstderr:\n${result.stderr}`,
      );
    }
    expect(probeOutput.status).toBe(200);

    const setCookies = probeOutput.setCookies || [];
    const hostCsrfCookie = setCookies.find(c => c.startsWith('__Host-csrf='));
    expect(hostCsrfCookie).toBeTruthy();

    // The cookie-name prefix is necessary but not sufficient. Browsers only
    // accept `__Host-` cookies that ALSO carry `Secure`, `Path=/`, and no
    // `Domain` attribute (RFC 6265bis). A regression that drops any of these
    // would still produce the right NAME but a non-functional cookie.
    // Assert the full attribute contract so a future change can't pass the
    // prefix check while quietly breaking the security property.
    expect(hostCsrfCookie).toMatch(/;\s*Secure(\s*;|\s*$)/);
    expect(hostCsrfCookie).toMatch(/;\s*Path=\/(\s*;|\s*$)/);
    expect(hostCsrfCookie).not.toMatch(/;\s*Domain=/i);
    // `__Host-csrf` is a CSRF double-submit cookie — it MUST be readable
    // server-side so the validator can compare it against the X-CSRF-Token
    // header. HttpOnly would break the contract; assert it is NOT set.
    expect(hostCsrfCookie).not.toMatch(/;\s*HttpOnly(\s*;|\s*$)/i);
    // SameSite=Strict is the strongest default for double-submit; Lax is
    // also acceptable. Reject None (which permits cross-site sends and
    // defeats CSRF protection).
    expect(hostCsrfCookie).toMatch(/;\s*SameSite=(Strict|Lax)(\s*;|\s*$)/);

    // `_csrf` (the non-production name) MUST NOT appear under production.
    const devCsrfCookie = setCookies.find(c => c.startsWith('_csrf='));
    expect(devCsrfCookie).toBeFalsy();
  });
});
