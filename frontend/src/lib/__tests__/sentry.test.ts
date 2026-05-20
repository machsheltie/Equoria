/**
 * Sentinel tests for Sentry configuration security.
 *
 * SECURITY GATE: These tests exist to prevent silent re-introduction of
 * session-replay sampling into the Sentry init config. Session replay captures
 * full DOM snapshots (including form inputs) and ships them to Sentry. Enabling
 * it on login/password-change pages without explicit PII masking constitutes a
 * privacy breach.
 *
 * If any test in this file turns red, do NOT weaken or skip it — fix the config.
 */

import { describe, it, expect } from 'vitest';
import { buildSentryConfig } from '../sentry';

describe('buildSentryConfig — security sentinel', () => {
  const TEST_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0';

  // -----------------------------------------------------------------------
  // §1  No replay sampling — the core defect guard (Equoria-173qm)
  // -----------------------------------------------------------------------

  it('does NOT include replaysOnErrorSampleRate in the config', () => {
    const config = buildSentryConfig(TEST_DSN, 'test', false);
    // The key must be absent — even as undefined, because Sentry reads its
    // presence (not just its truthiness) when deciding to activate the SDK.
    expect(config).not.toHaveProperty('replaysOnErrorSampleRate');
  });

  it('does NOT include replaysSessionSampleRate in the config', () => {
    const config = buildSentryConfig(TEST_DSN, 'test', false);
    expect(config).not.toHaveProperty('replaysSessionSampleRate');
  });

  it('does NOT include a replay integration in the integrations array', () => {
    const config = buildSentryConfig(TEST_DSN, 'test', false);
    // If integrations are added in future, none should be a Replay integration.
    // A Replay integration exposes a .name property of 'Replay'.
    if (config.integrations && Array.isArray(config.integrations)) {
      const names = (config.integrations as Array<{ name?: string }>).map((i) => i?.name ?? '');
      expect(names).not.toContain('Replay');
    }
    // If integrations is absent or empty, that's also fine — no replay risk.
  });

  // -----------------------------------------------------------------------
  // §2  Positive assertions — legit config must survive the refactor
  // -----------------------------------------------------------------------

  it('includes the DSN passed to it', () => {
    const config = buildSentryConfig(TEST_DSN, 'production', true);
    expect(config.dsn).toBe(TEST_DSN);
  });

  it('sets environment from the mode argument', () => {
    expect(buildSentryConfig(TEST_DSN, 'production', true).environment).toBe('production');
    expect(buildSentryConfig(TEST_DSN, 'staging', true).environment).toBe('staging');
    expect(buildSentryConfig(TEST_DSN, 'development', false).environment).toBe('development');
  });

  // -----------------------------------------------------------------------
  // §3  tracesSampleRate driven by isProd boolean, NOT by the mode string
  //
  // REGRESSION GUARD: before the fix, the refactored buildSentryConfig used
  // `mode === 'production'` to gate tracesSampleRate. That diverges from the
  // original `import.meta.env.PROD ? 0.1 : 1.0` semantics for any
  // custom-mode production build (e.g. `vite build --mode staging` has
  // PROD=true but MODE='staging'). The regression was 10× more traces sent
  // to Sentry on staging-mode production builds.
  // -----------------------------------------------------------------------

  it('uses tracesSampleRate=0.1 when isProd=true, regardless of mode string', () => {
    // Standard production build
    expect(buildSentryConfig(TEST_DSN, 'production', true).tracesSampleRate).toBe(0.1);
    // Custom-mode production build — the regression case: old code yielded 1.0 here
    expect(buildSentryConfig(TEST_DSN, 'staging', true).tracesSampleRate).toBe(0.1);
    // Another custom-mode production build
    expect(buildSentryConfig(TEST_DSN, 'canary', true).tracesSampleRate).toBe(0.1);
  });

  it('uses tracesSampleRate=1.0 when isProd=false, regardless of mode string', () => {
    expect(buildSentryConfig(TEST_DSN, 'development', false).tracesSampleRate).toBe(1.0);
    expect(buildSentryConfig(TEST_DSN, 'test', false).tracesSampleRate).toBe(1.0);
    // Edge case: mode string says 'production' but isProd=false (e.g. vite dev --mode production)
    expect(buildSentryConfig(TEST_DSN, 'production', false).tracesSampleRate).toBe(1.0);
  });

  it('staging-mode production build regression: isProd=true + mode=staging must yield 0.1 (not 1.0)', () => {
    // This is the exact divergence: `vite build --mode staging`
    //   OLD (import.meta.env.PROD ? 0.1 : 1.0): PROD=true  → 0.1  ✓
    //   BROKEN (mode === 'production' ? 0.1 : 1.0): MODE='staging' → 1.0  ✗
    //   FIXED (isProd ? 0.1 : 1.0): isProd=true → 0.1  ✓
    const config = buildSentryConfig(TEST_DSN, 'staging', true);
    expect(config.tracesSampleRate).toBe(0.1);
    expect(config.environment).toBe('staging'); // environment label still correct
  });

  it('uses a lower tracesSampleRate when isProd=true than when isProd=false', () => {
    const prod = buildSentryConfig(TEST_DSN, 'production', true);
    const dev = buildSentryConfig(TEST_DSN, 'development', false);
    expect(prod.tracesSampleRate).toBeLessThan(dev.tracesSampleRate as number);
  });

  it('includes ignoreErrors with the expected transient network error strings', () => {
    const config = buildSentryConfig(TEST_DSN, 'test', false);
    expect(config.ignoreErrors).toContain('Network request failed');
    expect(config.ignoreErrors).toContain('Failed to fetch');
    expect(config.ignoreErrors).toContain('NetworkError');
  });
});
