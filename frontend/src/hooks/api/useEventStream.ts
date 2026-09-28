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
 * The EXACT event-name strings the backend SSE producer emits on the named
 * frame `event: ${event.type}` (eventStreamController.mjs:68). The type is
 * the notification `type` each producer passes to createNotification(...):
 *
 *   - stat_gain               (horseFeedController — feed stat boost)
 *   - foal_born               (foalingService — foal birth)
 *   - competition_placement   (competitionController; pending re-anchor onto executeClosedShows per Equoria-dfet1)
 *   - competition_stat_gain   (competitionController; pending re-anchor onto executeClosedShows per Equoria-dfet1)
 *   - horse_purchased         (marketplaceController — buyer side)
 *   - horse_sold              (marketplaceController — seller side)
 *   - forum_reply             (forumController — reply to a thread the user authored, Equoria-pwwuz/il1e4)
 *   - club_leadership_transferred (clubController — you were promoted to club president, Equoria-pwwuz)
 *   - groom_retired           (groomRetirementService — a groom reached their hidden retirement age, Equoria-m9lz1)
 *
 * Per the SSE spec, a frame with `event: <name>` dispatches ONLY to
 * addEventListener('<name>') handlers and does NOT fire the generic
 * `message`/onmessage handler. So every emitted type MUST be registered
 * here or it is silently dropped on the SSE fast-path (only arriving via
 * the 5s polling fallback). This list is the single source of truth and
 * must stay in lockstep with the backend producers above.
 */
export const SSE_EVENT_NAMES = [
  'stat_gain',
  'foal_born',
  'competition_placement',
  'competition_stat_gain',
  'horse_purchased',
  'horse_sold',
  'forum_reply',
  'club_leadership_transferred',
  'groom_retired',
  // Equoria-ypb7d.3: the two moments the weekly groom fee creates. Named events
  // are dropped by EventSource unless a listener is registered for the exact
  // name, so a producer without an entry here reaches the player only on the 5s
  // poll — which for "your groom has left" is too slow to be a warning.
  'groom_fee_unpaid',
  'groom_released',
] as const;

/**
 * Equoria-bvddn.34: the subset of SSE_EVENT_NAMES that change the player's
 * balance server-side, so the nav/wallet UI (reads ['profile'] —
 * useAuth.ts) must refetch alongside the notification list. Determined by
 * reading each producer, not by guessing from the event name:
 *
 *   - horse_purchased      buyer side of marketplaceController's sale tx —
 *                          the buyer's money decreases.
 *   - horse_sold           seller side of the SAME tx — the seller's money
 *                          increases (the scenario this bug was filed for).
 *   - competition_placement showController debits the prize pool and pays
 *                          the placing owner (`prizeWon` in the payload).
 *   - groom_fee_unpaid     groomSalaryService debits the weekly salary from
 *                          the owner's balance every week it succeeds; this
 *                          event fires on the one week it does NOT (grace),
 *                          but it is emitted from the same weekly-fee pass
 *                          that DOES move money on every other week, so the
 *                          balance is exactly as likely to be stale here as
 *                          on any other week's silent debit — refresh it.
 *
 * Explicitly NOT included: stat_gain, foal_born, competition_stat_gain,
 * forum_reply, club_leadership_transferred, groom_retired, groom_released —
 * none of their producers touch User.money.
 */
const MONEY_EVENT_NAMES = new Set<(typeof SSE_EVENT_NAMES)[number]>([
  'horse_purchased',
  'horse_sold',
  'competition_placement',
  'groom_fee_unpaid',
]);

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

    // Equoria-bvddn.34: a SEPARATE listener (rather than branching on
    // event.type inside `invalidate`) so a money event's balance refresh
    // does not depend on what shape of Event object the browser hands the
    // callback — addEventListener('<name>', cb) always fires `cb` for that
    // exact named frame regardless of the Event's own `type` field.
    const invalidateBalance = () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    };

    // Server frames are named events (e.g. `event: stat_gain`). A named
    // EventSource event does NOT fire the generic `message` handler, so we
    // must register a listener for every concrete event type the backend
    // emits (SSE_EVENT_NAMES — kept in lockstep with the producers). The
    // `message`/onmessage handler is a robust catch-all for any future
    // unnamed/default frame, so a new backend event type degrades to a
    // refetch rather than being silently dropped.
    for (const name of SSE_EVENT_NAMES) {
      source.addEventListener(name, invalidate);
      if (MONEY_EVENT_NAMES.has(name)) {
        source.addEventListener(name, invalidateBalance);
      }
    }
    source.onmessage = invalidate;

    // EventSource auto-reconnects on transient drop; onerror is informational
    // only. We do NOT close on error — letting the browser retry is the
    // robust behavior. If it never recovers, polling still serves the data.
    source.onerror = () => {
      /* transient — browser will retry; polling remains the safety net */
    };

    return () => {
      for (const name of SSE_EVENT_NAMES) {
        source.removeEventListener(name, invalidate);
        if (MONEY_EVENT_NAMES.has(name)) {
          source.removeEventListener(name, invalidateBalance);
        }
      }
      source.close();
    };
  }, [queryClient]);
}

export default useEventStream;
