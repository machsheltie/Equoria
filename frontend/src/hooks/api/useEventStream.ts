/**
 * useEventStream — real-time Server-Sent Events client (ADR-011 / Equoria-rgyv).
 *
 * Opens an authenticated EventSource to GET /api/v1/events/stream and, on
 * every server event, invalidates the React Query keys that back the
 * notification / activity surface (FR-CN6/8/9). The rendered data still
 * comes from the authoritative `useGameNotifications` REST read — SSE only
 * collapses latency from "up to the 5s poll" to "immediate". The existing
 * polling is left untouched, so if SSE never connects (proxy strips it,
 * EventSource unsupported) the feature degrades gracefully to polling with
 * no code-path change.
 *
 * Auth: EventSource cannot set headers, so we rely on the httpOnly
 * `accessToken` cookie (sent automatically with `withCredentials`). This is
 * the same cookie every authenticated request uses — no token in the URL,
 * no bypass. The relative URL works on Railway's single-origin deploy.
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// Mirror api-client's base-URL convention: empty for same-origin deploy
// (Railway), an absolute origin only for split frontend/backend.
const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

const STREAM_URL = `${API_BASE_URL}/api/v1/events/stream`;

/**
 * Subscribe to the live event stream while the calling component is
 * mounted. No return value — its effect is query-cache invalidation.
 */
export function useEventStream(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    // EventSource is unavailable in some environments (older browsers,
    // SSR, certain test runners). Degrade silently to polling.
    if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') {
      return;
    }

    const source = new EventSource(STREAM_URL, { withCredentials: true });

    const invalidate = () => {
      // Refetch the authoritative notification read + the messages unread
      // count. Mirrors what useMarkGameNotificationsRead invalidates.
      queryClient.invalidateQueries({ queryKey: ['game-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['messages', 'unread-count'] });
    };

    // Server frames are named events (e.g. `event: stat_gain`). A named
    // EventSource event does NOT fire the generic `message` handler, so
    // listen for the concrete event types the backend emits. A catch-all
    // `message` handler covers any unnamed/default frames.
    const NAMED_EVENTS = ['stat_gain', 'foal_born', 'competition_result', 'message'];
    for (const name of NAMED_EVENTS) {
      source.addEventListener(name, invalidate);
    }
    source.onmessage = invalidate;

    // EventSource auto-reconnects on transient drop; onerror is informational
    // only. We do NOT close on error — letting the browser retry is the
    // robust behavior. If it never recovers, polling still serves the data.
    source.onerror = () => {
      /* transient — browser will retry; polling remains the safety net */
    };

    return () => {
      for (const name of NAMED_EVENTS) {
        source.removeEventListener(name, invalidate);
      }
      source.close();
    };
  }, [queryClient]);
}

export default useEventStream;
