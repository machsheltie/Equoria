/**
 * The app's QueryClient (Equoria-bvddn.29).
 *
 * Every query and mutation error passes through the cache-level onError. A 401
 * thrown after a FAILED refresh means the session is dead: clear the cache and
 * send the player to /login. Without this the profile query kept its previous
 * data on the refetch error, `isAuthenticated` stayed true, and the player was
 * stranded on panels that all read "session expired".
 *
 * `hasCachedSession` gates the end: a signed-out visitor (no profile in the
 * cache) has no session to end, and once the cache is cleared the follow-up
 * profile refetch cannot re-trigger it — no clear -> refetch -> 401 loop.
 */

import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import type { ApiError } from './http/types';
import { endSession, hasCachedSession, isSessionExpiredError } from './sessionEnd';

/**
 * Equoria-bvddn.37: the default retry (3x for every error, including 4xx)
 * turned an expired session into a refresh-endpoint storm — each retried 401
 * fired another refresh attempt, which could also trip the auth rate limit,
 * and stacked ~7s of retry delay onto the /login redirect. A 4xx is the
 * server's answer, not a transient failure: retrying it can never succeed.
 * Network errors and 5xx (statusCode 0 or >= 500) still get up to 3 retries.
 */
function isClientError(error: unknown): boolean {
  const statusCode = (error as ApiError | undefined)?.statusCode;
  return typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500;
}

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isClientError(error)) return false;
  return failureCount < 3;
}

/**
 * Equoria-v61q2: a `retryOnMount` for queries whose page shows a loading gate
 * and then mounts a child that subscribes to the same query. By default a
 * newly mounted observer re-fetches a query that is in error with no data;
 * that re-fetch resets it to `pending`, the parent's gate unmounts the child,
 * the 4xx comes back, the child mounts again — a request loop (~95/s on
 * /foals/:id for a horse past foal age). A 4xx is the server's answer, so it
 * is never re-fetched on mount; a network error or 5xx still is.
 */
export function retryOnMountUnlessClientError(query: { state: { error: unknown } }): boolean {
  return !isClientError(query.state.error);
}

export function createAppQueryClient(): QueryClient {
  const handleError = (error: unknown) => {
    if (isSessionExpiredError(error) && hasCachedSession(client)) {
      endSession(client, 'expired');
    }
  };

  const client: QueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry },
    },
    queryCache: new QueryCache({ onError: handleError }),
    mutationCache: new MutationCache({ onError: handleError }),
  });
  return client;
}
