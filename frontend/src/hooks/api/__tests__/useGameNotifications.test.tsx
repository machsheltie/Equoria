/**
 * useGameNotifications hook tests (Equoria-50pn AC-4)
 *
 * Verifies:
 *  - useGameNotifications() calls GET /api/v1/users/me/game-notifications and
 *    exposes { notifications, unreadCount } via React Query data.
 *  - useMarkGameNotificationsRead() mutation invalidates BOTH
 *    ['game-notifications'] and ['messages', 'unread-count'] caches on
 *    success — the contract that lets the MainNavigation bell dot clear
 *    after marking notifications read.
 *
 * Network boundary stubbed with MSW per-test `server.use(...)` overrides
 * (Equoria-f12xy) instead of vi.mock'ing the api-client. The PATCH mutation
 * exercises the real client's CSRF round-trip via the globally-registered
 * csrf-token handler. The invalidate-on-success contract is asserted with a
 * `queryClient.invalidateQueries` spy (a queryClient method, not an api-client
 * mock — doctrine-compliant).
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';

import { useGameNotifications, useMarkGameNotificationsRead } from '../useGameNotifications';
import { server } from '../../../test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  // Spy on invalidateQueries so we can assert both keys are invalidated.
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { Wrapper, queryClient, invalidateSpy };
}

describe('useGameNotifications', () => {
  it('fetches /api/v1/users/me/game-notifications and exposes data shape', async () => {
    const response = {
      notifications: [
        {
          id: 'g-1',
          type: 'stat_gain' as const,
          isRead: false,
          createdAt: '2026-05-15T00:00:00.000Z',
          payload: { horseName: 'Stardust', stat: 'speed', amount: 1, feedName: 'Premium Oats' },
        },
      ],
      unreadCount: 1,
    };
    let path = '';
    server.use(
      http.get(`${base}/api/v1/users/me/game-notifications`, ({ request }) => {
        path = new URL(request.url).pathname;
        return HttpResponse.json({ data: response });
      })
    );

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useGameNotifications(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(path).toBe('/api/v1/users/me/game-notifications');
    expect(result.current.data).toEqual(response);
    expect(result.current.data?.notifications).toHaveLength(1);
    expect(result.current.data?.unreadCount).toBe(1);
  });

  it('uses queryKey ["game-notifications"] so MessagesPage + MainNavigation share cache', async () => {
    server.use(
      http.get(`${base}/api/v1/users/me/game-notifications`, () =>
        HttpResponse.json({ data: { notifications: [], unreadCount: 0 } })
      )
    );

    const { Wrapper, queryClient } = createWrapper();
    const { result } = renderHook(() => useGameNotifications(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Cache must be addressable under the canonical key — same key used by
    // useMarkGameNotificationsRead.invalidateQueries below and by the
    // MessagesPage useEffect tab-activation flow.
    expect(queryClient.getQueryData(['game-notifications'])).toBeDefined();
  });
});

describe('useMarkGameNotificationsRead', () => {
  it('calls PATCH read-all and invalidates both query keys on success', async () => {
    let patched = false;
    server.use(
      http.patch(`${base}/api/v1/users/me/game-notifications/read-all`, () => {
        patched = true;
        return new HttpResponse(null, { status: 204 });
      })
    );

    const { Wrapper, invalidateSpy } = createWrapper();
    const { result } = renderHook(() => useMarkGameNotificationsRead(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(patched).toBe(true);

    // Two specific invalidations required by the contract:
    //  (1) ['game-notifications']   → game notif tab refreshes
    //  (2) ['messages','unread-count'] → MainNavigation bell dot clears
    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([['game-notifications'], ['messages', 'unread-count']])
    );
  });

  it('does NOT invalidate caches when read-all rejects', async () => {
    server.use(
      http.patch(`${base}/api/v1/users/me/game-notifications/read-all`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 })
      )
    );

    const { Wrapper, invalidateSpy } = createWrapper();
    const { result } = renderHook(() => useMarkGameNotificationsRead(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync().catch(() => {});
    });

    // onSuccess never fired so the two invalidations should NOT have run.
    // (renderHook itself may trigger framework invalidations; we only assert
    // our two contract keys are absent.)
    const calls = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(calls).not.toContainEqual(['game-notifications']);
    expect(calls).not.toContainEqual(['messages', 'unread-count']);
  });
});
