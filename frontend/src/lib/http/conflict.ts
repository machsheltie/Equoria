/**
 * Stale-view conflicts (Equoria-6p398.13).
 *
 * A 409 from a mutation means the player acted on a view that had already moved
 * on: the listing was bought, the assignment ended, the rider was hired away.
 * Repeating the same request cannot succeed, so the useful answer is to fetch
 * the truth again. Each mutation names the queries it owns and calls
 * `refreshOnConflict` from its `onError`; the surface re-renders from fresh
 * data and the failure copy (shown at the control) now describes a view that is
 * current.
 */

import type { QueryClient, QueryKey } from '@tanstack/react-query';

/** True when `error` is the transport's 409 (apiClient stamps `statusCode`). */
export function isConflictError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    (error as { statusCode: unknown }).statusCode === 409
  );
}

/** Invalidate the owning queries when `error` is a 409; any other error leaves the cache alone. */
export function refreshOnConflict(
  queryClient: QueryClient,
  error: unknown,
  queryKeys: readonly QueryKey[]
): void {
  if (!isConflictError(error)) return;
  for (const queryKey of queryKeys) {
    void queryClient.invalidateQueries({ queryKey });
  }
}
