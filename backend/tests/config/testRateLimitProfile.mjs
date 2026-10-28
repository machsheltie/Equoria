/**
 * The one place that decides which rate-limit profile a Jest setup runs under
 * (Equoria-bh7j8).
 *
 * createRateLimiter (backend/middleware/rateLimiting.mjs) reads
 * TEST_RATE_LIMIT_MAX_REQUESTS / TEST_RATE_LIMIT_WINDOW_MS under Jest for every
 * limiter built with `useEnvOverride: true` (the default). When they are unset,
 * each limiter runs at its own production literal. Which of those two worlds a
 * suite lives in used to depend on which setup file its config happened to load:
 * backend/tests/setup.mjs set the knobs, backend/__tests__/setup.mjs did not.
 * Both setups now name their profile here, so the difference is a decision.
 *
 *   relaxed    — backend/tests/setup.mjs (jest.config.mjs, the root config, the
 *                sharded gate). 1000 requests per 15 minutes on every
 *                env-overridable limiter, so domain suites that create many
 *                fixtures through the API do not trip a limiter they are not
 *                testing. Files that test a specific cap (e.g.
 *                horse-rate-limiting.test.mjs) set their own value before
 *                importing app.mjs.
 *   production — backend/__tests__/setup.mjs (jest.config.security.mjs, the
 *                Security Gate). The knobs are left alone, so every limiter runs
 *                at the cap players get. A security gate should exercise the
 *                real limits; a security-control suite that needs more headroom
 *                sets its own TEST_RATE_LIMIT_* value for its file, in the open.
 *
 * Neither profile overwrites a value already present in the environment, so a
 * per-file or per-run override still wins. Production caps live only in
 * rateLimiting.mjs and app.mjs; nothing here changes them.
 */

/** The relaxed profile's values, as the strings process.env holds. */
export const relaxedTestRateLimit = Object.freeze({
  maxRequests: '1000',
  windowMs: `${15 * 60 * 1000}`,
});

export const testRateLimitProfileNames = Object.freeze(['relaxed', 'production']);

/**
 * Apply a named rate-limit profile to `env` (process.env by default).
 * Throws on an unknown name so a typo cannot silently pick a profile.
 *
 * @param {'relaxed' | 'production'} profileName
 * @param {Record<string, string | undefined>} [env]
 */
export function applyTestRateLimitProfile(profileName, env = process.env) {
  if (!testRateLimitProfileNames.includes(profileName)) {
    throw new Error(
      `Unknown test rate-limit profile "${profileName}"; expected one of ${testRateLimitProfileNames.join(', ')}`,
    );
  }
  if (profileName === 'production') {
    return;
  }
  if (!env.TEST_RATE_LIMIT_MAX_REQUESTS) {
    env.TEST_RATE_LIMIT_MAX_REQUESTS = relaxedTestRateLimit.maxRequests;
  }
  if (!env.TEST_RATE_LIMIT_WINDOW_MS) {
    env.TEST_RATE_LIMIT_WINDOW_MS = relaxedTestRateLimit.windowMs;
  }
}
