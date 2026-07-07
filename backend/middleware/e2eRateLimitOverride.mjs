/**
 * E2E-only rate-limit ceiling override (Equoria-jz9v2)
 *
 * A single, self-contained pure decision: resolve the effective rate-limit
 * `max`, honoring an EXPLICIT, non-production-only override env var
 * (E2E_RATE_LIMIT_MAX) without touching the shared RATE_LIMIT_MAX_BY_ENV map.
 *
 * Why a dedicated module (not added to rateLimiting.mjs): rateLimiting.mjs is
 * already a baselined over-threshold file in the file-size doctrine ratchet
 * (scripts/doctrine-checks/file-size-baseline.json). This helper is a pure,
 * app.mjs-only consumer that does not belong to the createRateLimiter factory's
 * internals, so it lives here — keeping it single-responsibility and keeping
 * the god file from regrowing (shrink-only doctrine, .claude/rules/CONTRIBUTING).
 *
 * ─── The problem this solves ─────────────────────────────────────────────────
 * The Playwright E2E CI job runs the whole suite (~27 min as of 2026-07) from a
 * single CI IP under NODE_ENV=beta with the REAL rate-limit middleware + Redis
 * in the path (Equoria-obwp intent, preserved). The aggregate request volume
 * exceeds the beta apiLimiter default (RATE_LIMIT_MAX_BY_ENV.beta = 3000 /
 * 15 min, sized for a ~7-min suite) within the rolling 15-min window, producing
 * a 429 cascade that fails unrelated auth/breeding/community/conformation/feed
 * specs (Equoria-jz9v2).
 *
 * This override lets the CI job raise the ceiling WITHOUT changing
 * RATE_LIMIT_MAX_BY_ENV — the pinned defaults (beta 3000, beta-readiness 1000,
 * prod 100; enforced by backend/__tests__/betaReadinessEnvSentinel.test.mjs)
 * stay exactly as they are, and any deploy that never sets the env var behaves
 * identically to today. It is a SCOPED CALIBRATION, not a bypass: the limiter
 * still fires at the (high, finite) overridden ceiling — a runaway client is
 * still throttled.
 *
 * @module middleware/e2eRateLimitOverride
 */

/**
 * Non-production environments in which an EXPLICIT E2E ceiling override may be
 * honored. `production` is deliberately excluded — a real production deploy can
 * NEVER have its rate-limit ceiling raised by this knob, so production posture
 * is unchanged by construction. `development` is also excluded because the
 * Playwright E2E stack runs under NODE_ENV=beta (playwright.config.ts), not
 * development — restricting to the exact set the override is meant for avoids
 * widening the surface beyond need.
 */
export const E2E_OVERRIDABLE_ENVS = new Set(['beta', 'test', 'beta-readiness']);

/**
 * Pure decision: resolve the effective rate-limit `max`, honoring the EXPLICIT
 * E2E-only ceiling override.
 *
 * Returns `configuredMax` UNCHANGED in every normal case (every real deploy that
 * never sets the override env var). Returns the parsed override ONLY when ALL of:
 *   - `nodeEnv` is a non-production env in E2E_OVERRIDABLE_ENVS
 *     (`beta` | `test` | `beta-readiness`) — NEVER `production`, and
 *   - `envValue` is a valid positive integer.
 *
 * Honored only when EXPLICITLY set (unset/empty ⇒ default) and only in non-prod.
 *
 * Pure + fully injectable (no env reads inside) so the entire matrix is unit-
 * and sentinel-testable without a live server. Callers inject
 * `process.env.NODE_ENV` / the override value / the would-be default.
 *
 * @param {Object} params
 * @param {string} params.nodeEnv       - process.env.NODE_ENV
 * @param {string|undefined|null} params.envValue - raw override value (e.g. process.env.E2E_RATE_LIMIT_MAX)
 * @param {number} params.configuredMax - the env-default max that would otherwise apply
 * @returns {number} the max to use
 */
export function resolveE2eRateLimitMax({ nodeEnv, envValue, configuredMax }) {
  // Production is NEVER overridable — hard stop before any parsing.
  if (nodeEnv === 'production') {
    return configuredMax;
  }
  // Only the explicitly-allowed non-prod envs may honor the override.
  if (!E2E_OVERRIDABLE_ENVS.has(nodeEnv)) {
    return configuredMax;
  }
  // Unset / empty ⇒ normal behavior (the case for every real deploy).
  if (envValue === undefined || envValue === null || String(envValue).trim() === '') {
    return configuredMax;
  }
  // Must be a valid positive integer. Use Number (not parseInt) so partial
  // garbage like '3000abc' is REJECTED rather than silently parsed to 3000.
  const parsed = Number(String(envValue).trim());
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return configuredMax;
  }
  return parsed;
}
