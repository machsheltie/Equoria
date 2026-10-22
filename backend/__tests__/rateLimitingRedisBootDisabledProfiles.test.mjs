/**
 * Rate limiter boot-time Redis decision (Equoria-x9c6b, Equoria-zh1m6)
 *
 * redisIntentionallyDisabled() already treats NODE_ENV=beta-readiness as "Redis
 * intentionally disabled" (the gate is Postgres-only). initializeRedis() kept
 * its own inline check that omitted beta-readiness, so the readiness gate still
 * tried to connect to REDIS_URL at boot, waited out the boot timeout and logged
 * connection errors. Both now share the one predicate.
 *
 * The decision depends on NODE_ENV and the absence of JEST_WORKER_ID, so it
 * cannot be observed inside a Jest worker. Each case imports the real module in
 * a child process with JEST_WORKER_ID removed and an unreachable REDIS_URL, and
 * reads the module's own boot log. No mocks: the real rateLimiting.mjs runs.
 */

import { describe, test, expect } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const moduleUrl = pathToFileURL(path.join(backendDir, 'middleware', 'rateLimiting.mjs')).href;

const childSource = `
const rateLimiting = await import(${JSON.stringify(moduleUrl)});
await rateLimiting.closeRedis();
process.exit(0);
`;

/** Import the real module under `nodeEnv`; return everything it logged. */
function bootRateLimiter(nodeEnv) {
  const env = {
    ...process.env,
    NODE_ENV: nodeEnv,
    REDIS_URL: 'redis://127.0.0.1:1', // nothing listens here: any attempt fails
    REDIS_BOOT_TIMEOUT_MS: '300',
    REDIS_DISABLED: 'false',
    DATABASE_URL: 'postgresql://boot:boot@127.0.0.1:1/boot',
    PORT: '3999',
    JWT_SECRET: '0123456789abcdef0123456789abcdef',
    JWT_REFRESH_SECRET: 'fedcba9876543210fedcba9876543210',
  };
  delete env.JEST_WORKER_ID;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', childSource], {
    cwd: backendDir,
    env,
    encoding: 'utf8',
    timeout: 60000,
    windowsHide: true,
  });
  return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
}

describe('initializeRedis agrees with redisIntentionallyDisabled (Equoria-x9c6b, Equoria-zh1m6)', () => {
  test('NODE_ENV=beta-readiness makes no Redis connection attempt at boot', () => {
    const { status, output } = bootRateLimiter('beta-readiness');
    expect(status).toBe(0);
    expect(output).toContain('Using in-memory rate limiting for test/disabled Redis environment');
    expect(output).not.toContain('[Redis] Initializing connection');
    expect(output).not.toMatch(/Redis connection error/);
  }, 90000);

  test('CONTROL: a profile that is not intentionally disabled still attempts the connection', () => {
    // Proves the child really sees a reachable-vs-unreachable decision: if the
    // attempt could never be observed, the beta-readiness case above would pass
    // for the wrong reason.
    const { output } = bootRateLimiter('development');
    expect(output).toContain('[Redis] Initializing connection');
    expect(output).not.toContain('Using in-memory rate limiting for test/disabled Redis environment');
  }, 90000);
});
