/**
 * Sentry error tracking initialisation for the Equoria frontend.
 *
 * Usage:
 * - Call initSentry() once at app startup (App.tsx)
 * - Wrap the root JSX tree in <SentryErrorBoundary> to catch render errors
 *
 * Sentry is opt-in: if VITE_SENTRY_DSN is not set the module is a no-op.
 * This keeps dev builds clean and allows staging/production to differ.
 *
 * SESSION REPLAY IS INTENTIONALLY NOT CONFIGURED.
 * Enabling Sentry Replay (replayIntegration, replaysOnErrorSampleRate, or
 * replaysSessionSampleRate) records full DOM snapshots — including form inputs
 * such as password and login fields — and ships them to Sentry. That is a PII
 * exposure risk on every auth page. Before enabling replay, a deliberate
 * product decision is required that includes:
 *   1. Adding `replayIntegration({ maskAllText: true, blockAllMedia: true })`
 *   2. Confirming all sensitive form inputs have `data-sentry-mask` applied
 *   3. Legal/privacy review of the data being captured
 * Do NOT add replaysOnErrorSampleRate or replaysSessionSampleRate without
 * completing those steps. This comment exists so that CI catches a blind re-add.
 */

import * as Sentry from '@sentry/react';

/**
 * Build the Sentry init options as a plain object.
 *
 * Extracted as a pure function so unit tests can assert the shape of the
 * config — in particular, that no session-replay sampling keys are present —
 * without needing to spy on Sentry.init or mock import.meta.env.
 *
 * @param dsn    - The Sentry DSN string.
 * @param mode   - The Vite MODE string ('production', 'staging', 'development', …).
 *                 Used only for the `environment` label; NOT used for trace sampling.
 * @param isProd - The Vite PROD boolean (true on any `vite build`, regardless of
 *                 --mode). Used exclusively for tracesSampleRate to match the
 *                 original pre-refactor semantics: `import.meta.env.PROD ? 0.1 : 1.0`.
 *                 Keeping this separate from `mode` ensures that a custom-mode
 *                 production build (e.g. `vite build --mode staging`) still
 *                 receives the 0.1 rate, matching the behaviour before this
 *                 function was extracted.
 */
export function buildSentryConfig(
  dsn: string,
  mode: string,
  isProd: boolean
): Sentry.BrowserOptions {
  return {
    dsn,
    environment: mode,
    // Capture 10 % of transactions on any production build (PROD===true);
    // 100 % on dev-server / test runs (PROD===false).
    // NOTE: `isProd` mirrors Vite's import.meta.env.PROD boolean, NOT
    // `mode === 'production'` — they diverge on custom-mode builds such as
    // `vite build --mode staging` (PROD=true, MODE='staging').
    tracesSampleRate: isProd ? 0.1 : 1.0,
    // Ignore transient network errors
    ignoreErrors: ['Network request failed', 'Failed to fetch', 'NetworkError'],
    // NOTE: replaysOnErrorSampleRate and replaysSessionSampleRate are deliberately
    // absent. See the module-level comment above before adding them.
  };
}

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;

  Sentry.init(buildSentryConfig(dsn, import.meta.env.MODE, import.meta.env.PROD));
}

export const SentryErrorBoundary = Sentry.ErrorBoundary;
