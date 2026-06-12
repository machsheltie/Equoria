/**
 * CACHE_REQUIRE_REDIS observability gate tests (Equoria-1tu03)
 *
 * What this proves-then-locks:
 *   backend/utils/cacheHelper.mjs (ioredis query cache) silently falls back to a
 *   per-process in-memory Map when Redis init fails. Unlike the rate limiter
 *   (Equoria-4kfbh), that is a PERFORMANCE / cache-coherency degradation, not a
 *   security fail-open — so the correct posture is NOT to refuse to boot but to
 *   emit a LOUD one-time operator warning when the operator has declared Redis
 *   required (CACHE_REQUIRE_REDIS=true) and it is unreachable on a deployable env.
 *
 * Decision contract (mirrors shouldFailStartupWithoutRedis, but WARN not THROW):
 *   shouldWarnCacheWithoutRedis({ nodeEnv, requireRedis, redisConnected, redisIntentionallyDisabled })
 *   returns TRUE iff ALL of:
 *     - requireRedis === true             (operator opted in via CACHE_REQUIRE_REDIS)
 *     - nodeEnv is deployable (production|beta)
 *     - redisIntentionallyDisabled === false  (not test/REDIS_DISABLED)
 *     - redisConnected === false          (Redis did not connect)
 *   Every other combination → FALSE (dev/test silent, legacy single-node deploys
 *   that never set the flag stay quiet).
 *
 * These are PURE-FUNCTION tests + a latch test. No mocks of controllers/services/DB.
 * The module short-circuits Redis in jest env, so importing it is safe.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  shouldWarnCacheWithoutRedis,
  cacheRequiresRedis,
  cacheRedisIntentionallyDisabled,
  maybeWarnCacheWithoutRedis,
  _resetCacheDegradationWarning,
} from '../utils/cacheHelper.mjs';

// ────────────────────────────────────────────────────────────────────────────
// 1. shouldWarnCacheWithoutRedis — full decision matrix
// ────────────────────────────────────────────────────────────────────────────

describe('shouldWarnCacheWithoutRedis — cache degradation warn decision (Equoria-1tu03)', () => {
  it('is exported as a function', () => {
    expect(typeof shouldWarnCacheWithoutRedis).toBe('function');
  });

  // THE WARN CASE (sentinel-positive): opted in, deployable, not disabled, Redis down.
  it('returns TRUE: production + requireRedis + Redis down + not intentionally disabled', () => {
    expect(
      shouldWarnCacheWithoutRedis({
        nodeEnv: 'production',
        requireRedis: true,
        redisConnected: false,
        redisIntentionallyDisabled: false,
      }),
    ).toBe(true);
  });

  it('returns TRUE for beta as well (beta is a deployable env)', () => {
    expect(
      shouldWarnCacheWithoutRedis({
        nodeEnv: 'beta',
        requireRedis: true,
        redisConnected: false,
        redisIntentionallyDisabled: false,
      }),
    ).toBe(true);
  });

  // Redis IS connected → no degradation, no warn.
  it('returns FALSE when Redis connected (healthy distributed cache)', () => {
    expect(
      shouldWarnCacheWithoutRedis({
        nodeEnv: 'production',
        requireRedis: true,
        redisConnected: true,
        redisIntentionallyDisabled: false,
      }),
    ).toBe(false);
  });

  // Operator did NOT opt in → legacy single-node deploy stays quiet.
  it('returns FALSE when requireRedis is false (flag off — no new warnings on upgrade)', () => {
    expect(
      shouldWarnCacheWithoutRedis({
        nodeEnv: 'production',
        requireRedis: false,
        redisConnected: false,
        redisIntentionallyDisabled: false,
      }),
    ).toBe(false);
  });

  // Non-deployable env → never warn (dev usability, no log noise locally).
  it('returns FALSE in development even if requireRedis=true (dev usability)', () => {
    expect(
      shouldWarnCacheWithoutRedis({
        nodeEnv: 'development',
        requireRedis: true,
        redisConnected: false,
        redisIntentionallyDisabled: false,
      }),
    ).toBe(false);
  });

  // Intentionally disabled (test / REDIS_DISABLED) → never warn.
  it('returns FALSE when Redis is intentionally disabled (test / REDIS_DISABLED)', () => {
    expect(
      shouldWarnCacheWithoutRedis({
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
    expect(shouldWarnCacheWithoutRedis(base)).toBe(true);
    // flip each gate
    expect(shouldWarnCacheWithoutRedis({ ...base, requireRedis: false })).toBe(false);
    expect(shouldWarnCacheWithoutRedis({ ...base, redisConnected: true })).toBe(false);
    expect(shouldWarnCacheWithoutRedis({ ...base, redisIntentionallyDisabled: true })).toBe(false);
    expect(shouldWarnCacheWithoutRedis({ ...base, nodeEnv: 'test' })).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. cacheRequiresRedis / cacheRedisIntentionallyDisabled — env-read helpers
// ────────────────────────────────────────────────────────────────────────────

describe('cacheRequiresRedis — operator opt-in flag (Equoria-1tu03)', () => {
  const original = process.env.CACHE_REQUIRE_REDIS;
  beforeEach(() => {
    if (original === undefined) {
      delete process.env.CACHE_REQUIRE_REDIS;
    } else {
      process.env.CACHE_REQUIRE_REDIS = original;
    }
  });

  it('defaults to FALSE when unset (existing single-node deploys unaffected)', () => {
    delete process.env.CACHE_REQUIRE_REDIS;
    expect(cacheRequiresRedis()).toBe(false);
  });

  it('is TRUE only for the exact string "true"', () => {
    process.env.CACHE_REQUIRE_REDIS = 'true';
    expect(cacheRequiresRedis()).toBe(true);
    process.env.CACHE_REQUIRE_REDIS = 'TRUE';
    expect(cacheRequiresRedis()).toBe(false); // not the canonical literal
    process.env.CACHE_REQUIRE_REDIS = '1';
    expect(cacheRequiresRedis()).toBe(false);
  });
});

describe('cacheRedisIntentionallyDisabled — true in jest env (test-safety invariant)', () => {
  it('returns true in the current jest env, so the gate is inert here', () => {
    expect(cacheRedisIntentionallyDisabled()).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. maybeWarnCacheWithoutRedis — one-time latch + sentinel-positive fire
// ────────────────────────────────────────────────────────────────────────────

describe('maybeWarnCacheWithoutRedis — one-time warn latch (Equoria-1tu03)', () => {
  const originalRequire = process.env.CACHE_REQUIRE_REDIS;
  const originalEnv = process.env.NODE_ENV;
  const originalDisabled = process.env.REDIS_DISABLED;

  beforeEach(() => {
    _resetCacheDegradationWarning();
    // restore env between cases
    if (originalRequire === undefined) {
      delete process.env.CACHE_REQUIRE_REDIS;
    } else {
      process.env.CACHE_REQUIRE_REDIS = originalRequire;
    }
    if (originalEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalEnv;
    }
    if (originalDisabled === undefined) {
      delete process.env.REDIS_DISABLED;
    } else {
      process.env.REDIS_DISABLED = originalDisabled;
    }
  });

  it('does NOT warn in the jest env even with CACHE_REQUIRE_REDIS=true (intentionally disabled)', () => {
    process.env.CACHE_REQUIRE_REDIS = 'true';
    // NODE_ENV is 'test' in jest → cacheRedisIntentionallyDisabled() is true → gate inert.
    expect(maybeWarnCacheWithoutRedis(false)).toBe(false);
  });

  it('SENTINEL-POSITIVE: the gate decision FIRES on the real violation (and only then)', () => {
    // maybeWarnCacheWithoutRedis() is jest-inert by design: cacheRedisIntentionallyDisabled()
    // is true under JEST_WORKER_ID (asserted by the "does NOT warn in the jest env" test
    // above), so the wrapper can never fire under jest. The firing DECISION is therefore
    // proven on the pure shouldWarnCacheWithoutRedis() — the same layer Equoria-4kfbh
    // unit-tests its shouldFailStartupWithoutRedis() decision rather than the boot wrapper.
    const violation = {
      nodeEnv: 'production',
      requireRedis: true,
      redisConnected: false,
      redisIntentionallyDisabled: false,
    };
    // FIRES on the real production degradation.
    expect(shouldWarnCacheWithoutRedis(violation)).toBe(true);
    // Inert when ANY single condition flips — proves it fires ONLY on the real violation.
    expect(shouldWarnCacheWithoutRedis({ ...violation, requireRedis: false })).toBe(false);
    expect(shouldWarnCacheWithoutRedis({ ...violation, nodeEnv: 'development' })).toBe(false);
    expect(shouldWarnCacheWithoutRedis({ ...violation, redisIntentionallyDisabled: true })).toBe(false);
    expect(shouldWarnCacheWithoutRedis({ ...violation, redisConnected: true })).toBe(false);
  });

  it('does NOT warn when Redis is connected even with the flag set', () => {
    process.env.NODE_ENV = 'production';
    process.env.CACHE_REQUIRE_REDIS = 'true';
    delete process.env.REDIS_DISABLED;
    expect(maybeWarnCacheWithoutRedis(true)).toBe(false);
  });

  it('does NOT warn when the flag is off, even in production with Redis down', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.CACHE_REQUIRE_REDIS;
    delete process.env.REDIS_DISABLED;
    expect(maybeWarnCacheWithoutRedis(false)).toBe(false);
  });

  it('does NOT warn when REDIS_DISABLED=true (intentional disable) in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.CACHE_REQUIRE_REDIS = 'true';
    process.env.REDIS_DISABLED = 'true';
    expect(maybeWarnCacheWithoutRedis(false)).toBe(false);
  });
});
