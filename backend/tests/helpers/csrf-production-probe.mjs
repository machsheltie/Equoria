/**
 * Production-mode CSRF cookie probe.
 *
 * Run as a child process (see __tests__/integration/csrf-production-cookie.test.mjs).
 * The Jest ESM runtime has a known bug where jest.resetModules() + await
 * import('../../app.mjs') re-imports transitively pull in @sentry/core and
 * crash with "Module cache already has entry". Spawning a fresh Node process
 * with NODE_ENV=production sidesteps Jest's module registry entirely and
 * reliably exercises the production cookie contract.
 *
 * Contract:
 *   - Exits 0 on success, 1 on failure.
 *   - Emits a single JSON line on stdout: { status, setCookies }.
 *   - Logs are silenced by LOG_LEVEL=error so stdout stays parseable.
 *
 * @module tests/helpers/csrf-production-probe
 */

import request from 'supertest';

process.env.NODE_ENV = 'production';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error';

const { default: app } = await import('../../app.mjs');

// Sentinel tag wrapping the JSON payload. The test greps for this rather
// than relying on "last line of stdout" — real app.mjs emits post-request
// teardown logs (MemoryManager, Sentry flush, …) on stdout that would
// otherwise clobber the payload.
const SENTINEL = '__CSRF_PROBE_JSON__';

try {
  const res = await request(app).get('/auth/csrf-token').set('Origin', 'http://localhost:3000');
  const setCookies = res.headers['set-cookie'] || [];
  process.stdout.write(
    `${SENTINEL}${JSON.stringify({ status: res.status, setCookies })}${SENTINEL}\n`,
  );
  process.exit(0);
} catch (err) {
  process.stderr.write(`csrf-production-probe failed: ${err && err.stack ? err.stack : err}\n`);
  process.exit(1);
}
