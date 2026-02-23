/**
 * Sentry error tracking initialisation for the Equoria frontend.
 *
 * Usage:
 * - Call initSentry() once at app startup (App.tsx)
 * - Wrap the root JSX tree in <SentryErrorBoundary> to catch render errors
 *
 * Sentry is opt-in: if VITE_SENTRY_DSN is not set the module is a no-op.
 * This keeps dev builds clean and allows staging/production to differ.
 */

import * as Sentry from '@sentry/react';

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Capture 10 % of transactions in production; 100 % in dev/staging
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    // Replay every errored session in full
    replaysOnErrorSampleRate: 1.0,
    // Ignore transient network errors
    ignoreErrors: ['Network request failed', 'Failed to fetch', 'NetworkError'],
  });
}

export const SentryErrorBoundary = Sentry.ErrorBoundary;
