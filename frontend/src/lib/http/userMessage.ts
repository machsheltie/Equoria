/**
 * userMessageFor — the single error-taxonomy mapping point (Equoria-8cnzr).
 *
 * FRONTEND_ASYNC_STATE_DOCTRINE §3 mandates ONE place that turns a thrown
 * transport error into user-safe copy, so pages don't each invent copy for the
 * same class and so a raw server body message is NEVER rendered verbatim
 * (backend 5xx bodies can leak internals — Equoria-ot1mo).
 *
 * Consumers pass the caught error straight through:
 *
 *   const { title, message, retryable } = userMessageFor(error);
 *   if (isError) return (
 *     <ErrorState
 *       title={title}
 *       message={message}
 *       retry={retryable ? { label: 'Try Again', onClick: () => refetch() } : undefined}
 *     />
 *   );
 *
 * This is a total, pure function over `unknown` — it classifies by the
 * `ApiError.statusCode` that `apiClient` stamps on every non-2xx / network
 * failure (network → `0`, 429 → `429`, etc.), and falls through to a safe
 * generic message for anything that is not an `ApiError` (a render-logic
 * Error, a thrown string, `null`). It never returns `error.message` for any
 * class — every branch returns caller-safe, class-mapped copy.
 */

import type { ApiError } from './types.js';

/** User-facing, already-safe error presentation. `message` is never a raw server string. */
export interface UserFacingError {
  /** Short heading for `ErrorState`/`ErrorCard` (optional). */
  title?: string;
  /** User-safe descriptive copy — safe to render directly. */
  message: string;
  /**
   * Whether retrying the same request could plausibly succeed. Transport/server
   * faults (network, 5xx, 429) are retryable; client-side faults (4xx) are not
   * — retrying an unchanged 403/404/400 just repeats the failure.
   */
  retryable: boolean;
}

/**
 * Narrow `unknown` to the transport's `ApiError`. `apiClient` always attaches a
 * numeric `statusCode` (including `0` for network failures), so that field is
 * the reliable discriminator — a plain `Error` or a thrown non-object has none.
 */
function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof (error as { statusCode: unknown }).statusCode === 'number'
  );
}

/**
 * Map any caught value to user-safe copy per FRONTEND_ASYNC_STATE_DOCTRINE §3.
 *
 * @param error the value thrown by the transport / React Query (an `ApiError`
 *   in the normal path, but typed `unknown` so a stray non-`ApiError` throw is
 *   still handled safely rather than leaking).
 */
export function userMessageFor(error: unknown): UserFacingError {
  const status = isApiError(error) ? error.statusCode : undefined;

  // Network / offline — apiClient normalizes a rejected fetch to statusCode 0.
  if (status === 0) {
    return {
      title: 'Connection problem',
      message: "Can't reach the stable. Check your connection and try again.",
      retryable: true,
    };
  }

  // 401 — session expired. apiClient already drives the refresh/redirect flow;
  // this copy only shows if a consumer renders the error instead of redirecting.
  if (status === 401) {
    return {
      title: 'Session expired',
      message: 'Your session expired — log in again.',
      retryable: false,
    };
  }

  // 403 — ownership / access. Possible IDOR probe (matches backend audit posture).
  if (status === 403) {
    return {
      title: 'Access denied',
      message: "You don't have access to this.",
      retryable: false,
    };
  }

  // 404 — entity not found.
  if (status === 404) {
    return {
      title: 'Not found',
      message: "We couldn't find what you were looking for.",
      retryable: false,
    };
  }

  // 429 — rate limited. Retryable, but after a delay (apiClient carries retryAfter).
  if (status === 429) {
    return {
      title: 'Slow down a moment',
      message: 'Slow down a moment — too many requests. Try again shortly.',
      retryable: true,
    };
  }

  // 400 — validation. Field-level detail is the caller's job (from the structured
  // payload); this is the generic top-level fallback. Never the raw server text.
  if (status === 400) {
    return {
      title: 'Check your input',
      message: 'Please check the highlighted fields and try again.',
      retryable: false,
    };
  }

  // Any other 4xx (409, 422, …) — a client-side fault; a blind retry repeats it.
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return {
      title: "That didn't work",
      message: "That request couldn't be completed. Please check and try again.",
      retryable: false,
    };
  }

  // 5xx — server fault. NEVER surface error.message (may leak internals).
  if (typeof status === 'number' && status >= 500) {
    return {
      title: 'Something went wrong',
      message: 'Something went wrong on our end. Try again in a moment.',
      retryable: true,
    };
  }

  // Catch-all: no recognizable status — a non-ApiError throw (render-logic Error,
  // thrown string, null) or an unexpected shape. Treat as a transient unexpected
  // fault: retryable, and — critically — never echo the underlying message.
  return {
    title: 'Something went wrong',
    message: 'Something went wrong. Please try again.',
    retryable: true,
  };
}

export default userMessageFor;
