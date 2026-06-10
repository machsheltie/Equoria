/**
 * Rate Limiter STARTUP Fail-Fast Tests (Equoria-4kfbh, CWE-636 fail-open)
 *
 * The defect this proves-then-fixes:
 *   The rate limiter falls back to in-memory mode if Redis is UNREACHABLE AT
 *   STARTUP. In a multi-node deployment this effectively disables rate limiting
 *   cluster-wide (each node keeps its own per-process counter → the per-user /
 *   per-IP cap is multiplied by node count, and the auth brute-force limiter —
 *   which is NOT one of the per-request `failClosed` economy limiters — is
 *   silently neutered). That is a fail-OPEN on a critical security control.
 *
 * The existing per-request `failClosed` wrapper (Equoria-hnud7 / 8ukii) only
 * covers economy mutators (financial/breeding/competition) and only returns 503
 * per-request. It does NOT make the process refuse to boot, and it does NOT
 * protect auth/query/profile/mutation. So a prod node can come up "healthy",
 * silently in-memory, with brute-force protection gone.
 *
 * Fix contract (mirrors runtimeSecretPolicy fail-fast):
 *   `shouldFailStartupWithoutRedis({ nodeEnv, requireRedis, redisConnected, redisIntentionallyDisabled })`
 *   returns TRUE iff ALL of:
 *     - requireRedis === true            (operator opted in via RATE_LIMIT_REQUIRE_REDIS)
 *     - nodeEnv is deployable (production|beta)
 *     - redisIntentionallyDisabled === false  (not test/REDIS_DISABLED)
 *     - redisConnected === false         (Redis did not connect within boot window)
 *   In every other combination it returns FALSE — dev/test stay usable, and an
 *   operator who has NOT set the flag keeps the legacy graceful-degradation
 *   behavior (so this change cannot brick an existing single-node deploy on
 *   upgrade).
 *
 * These are PURE-FUNCTION tests. No mocks of controllers/services/DB. The module
 * has a top-level await (initializeRedis) which short-circuits to null in jest,
 * so importing it is safe and the boot fail-fast NEVER fires in this test env
 * (redisIntentionallyDisabled()=true).
 */

import { describe, it, expect } from '@jest/globals';

const { shouldFailStartupWithoutRedis, redisIntentionallyDisabled } = await import('../middleware/rateLimiting.mjs');

// ────────────────────────────────────────────────────────────────────────────
// 1. shouldFailStartupWithoutRedis — full decision matrix
// ────────────────────────────────────────────────────────────────────────────

describe('shouldFailStartupWithoutRedis — startup fail-fast decision (Equoria-4kfbh)', () => {
  it('is exported as a function', () => {
    expect(typeof shouldFailStartupWithoutRedis).toBe('function');
  });

  // THE FAIL-FAST CASE: opted in, deployable, not disabled, Redis down → fail boot.
  it('returns TRUE: production + requireRedis + Redis down + not intentionally disabled', () => {
    expect(
      shouldFailStartupWithoutRedis({
        nodeEnv: 'production',
        requireRedis: true,
        redisConnected: false,
        redisIntentionallyDisabled: false,
      }),
    ).toBe(true);
  });

  it('returns TRUE for beta as well (beta is a deployable env)', () => {
    expect(
      shouldFailStartupWithoutRedis({
        nodeEnv: 'beta',
        requireRedis: true,
        redisConnected: false,
        redisIntentionallyDisabled: false,
      }),
    ).toBe(true);
  });

  // Redis IS connected → boot proceeds.
  it('returns FALSE when Redis connected (healthy distributed limiting)', () => {
    expect(
      shouldFailStartupWithoutRedis({
        nodeEnv: 'production',
        requireRedis: true,
        redisConnected: true,
        redisIntentionallyDisabled: false,
      }),
    ).toBe(false);
  });

  // Operator did NOT opt in → legacy graceful degradation preserved (no brick on upgrade).
  it('returns FALSE when requireRedis is false (flag off — legacy fallback preserved)', () => {
    expect(
      shouldFailStartupWithoutRedis({
        nodeEnv: 'production',
        requireRedis: false,
        redisConnected: false,
        redisIntentionallyDisabled: false,
      }),
    ).toBe(false);
  });

  // Non-deployable env → never fail-fast even with the flag (dev usability).
  it('returns FALSE in development even if requireRedis=true (dev usability)', () => {
    expect(
      shouldFailStartupWithoutRedis({
        nodeEnv: 'development',
        requireRedis: true,
        redisConnected: false,
        redisIntentionallyDisabled: false,
      }),
    ).toBe(false);
  });

  // Intentionally disabled (test / REDIS_DISABLED) → never fail-fast.
  it('returns FALSE when Redis is intentionally disabled (test / REDIS_DISABLED)', () => {
    expect(
      shouldFailStartupWithoutRedis({
        nodeEnv: 'production',
        requireRedis: true,
        redisConnected: false,
        redisIntentionallyDisabled: true,
      }),
    ).toBe(false);
  });

  // Belt-and-suspenders: every gate is independently necessary.
  it('all four gates are jointly necessary (each flipped individually → false)', () => {
    const base = {
      nodeEnv: 'production',
      requireRedis: true,
      redisConnected: false,
      redisIntentionallyDisabled: false,
    };
    // base is the TRUE case
    expect(shouldFailStartupWithoutRedis(base)).toBe(true);
    // flip each gate
    expect(shouldFailStartupWithoutRedis({ ...base, requireRedis: false })).toBe(false);
    expect(shouldFailStartupWithoutRedis({ ...base, redisConnected: true })).toBe(false);
    expect(shouldFailStartupWithoutRedis({ ...base, redisIntentionallyDisabled: true })).toBe(false);
    expect(shouldFailStartupWithoutRedis({ ...base, nodeEnv: 'test' })).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. Test-safety invariant: in the CURRENT jest env the fail-fast NEVER fires.
//    If this regressed, simply importing the module would crash the suite —
//    which is itself proof that the boot guard short-circuits in test env.
// ────────────────────────────────────────────────────────────────────────────

describe('startup fail-fast is inert in jest env (test-safety invariant)', () => {
  it('redisIntentionallyDisabled() is true here, so the boot guard cannot fire', () => {
    expect(redisIntentionallyDisabled()).toBe(true);
    // With redisIntentionallyDisabled=true, the decision is false regardless of the other inputs.
    expect(
      shouldFailStartupWithoutRedis({
        nodeEnv: 'production',
        requireRedis: true,
        redisConnected: false,
        redisIntentionallyDisabled: redisIntentionallyDisabled(),
      }),
    ).toBe(false);
  });

  it('the module imported successfully (proves boot guard did not throw in test env)', () => {
    // If the boot-time enforcement had thrown during module evaluation, the
    // top-level await import above would have rejected and this file would not
    // run at all. Reaching this assertion is the evidence.
    expect(typeof shouldFailStartupWithoutRedis).toBe('function');
  });
});
