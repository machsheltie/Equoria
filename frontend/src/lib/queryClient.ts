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
import { endSession, hasCachedSession, isSessionExpiredError } from './sessionEnd';

export function createAppQueryClient(): QueryClient {
  const handleError = (error: unknown) => {
    if (isSessionExpiredError(error) && hasCachedSession(client)) {
      endSession(client, 'expired');
    }
  };

  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: handleError }),
    mutationCache: new MutationCache({ onError: handleError }),
  });
  return client;
}
