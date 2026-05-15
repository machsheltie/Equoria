/**
 * useGameNotifications hook tests (Equoria-50pn AC-4)
 *
 * Verifies:
 *  - useGameNotifications() calls gameNotificationsApi.getAll which hits
 *    /api/v1/users/me/game-notifications, and exposes
 *    { notifications, unreadCount } via React Query data.
 *  - useMarkGameNotificationsRead() mutation invalidates BOTH
 *    ['game-notifications'] and ['messages', 'unread-count'] caches on
 *    success — the contract that lets the MainNavigation bell dot clear
 *    after marking notifications read.
 *
 * Follows the existing api-mock pattern used by useAddXp.test.tsx and other
 * hook tests in this directory: mock the lib/api-client export, not the
 * underlying fetch.
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

import * as apiClient from '@/lib/api-client';
import { useGameNotifications, useMarkGameNotificationsRead } from '../useGameNotifications';

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return {
    ...actual,
    gameNotificationsApi: {
      getAll: vi.fn(),
      markAllRead: vi.fn(),
    },
  };
});

const mockedApi = apiClient.gameNotificationsApi as unknown as {
  getAll: ReturnType<typeof vi.fn>;
  markAllRead: ReturnType<typeof vi.fn>;
};

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

beforeEach(() => {
  mockedApi.getAll.mockReset();
  mockedApi.markAllRead.mockReset();
});

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
    mockedApi.getAll.mockResolvedValueOnce(response);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useGameNotifications(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedApi.getAll).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(response);
    expect(result.current.data?.notifications).toHaveLength(1);
    expect(result.current.data?.unreadCount).toBe(1);
  });

  it('uses queryKey ["game-notifications"] so MessagesPage + MainNavigation share cache', async () => {
    mockedApi.getAll.mockResolvedValueOnce({ notifications: [], unreadCount: 0 });

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
  it('calls gameNotificationsApi.markAllRead and invalidates both query keys on success', async () => {
    mockedApi.markAllRead.mockResolvedValueOnce(undefined);

    const { Wrapper, invalidateSpy } = createWrapper();
    const { result } = renderHook(() => useMarkGameNotificationsRead(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(mockedApi.markAllRead).toHaveBeenCalledTimes(1);

    // Two specific invalidations required by the contract:
    //  (1) ['game-notifications']   → game notif tab refreshes
    //  (2) ['messages','unread-count'] → MainNavigation bell dot clears
    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([['game-notifications'], ['messages', 'unread-count']])
    );
  });

  it('does NOT invalidate caches when markAllRead rejects', async () => {
    mockedApi.markAllRead.mockRejectedValueOnce(new Error('boom'));

    const { Wrapper, invalidateSpy } = createWrapper();
    const { result } = renderHook(() => useMarkGameNotificationsRead(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync().catch(() => {});
    });

    expect(mockedApi.markAllRead).toHaveBeenCalledTimes(1);
    // onSuccess never fired so the two invalidations should NOT have run.
    // (renderHook itself may trigger framework invalidations; we only assert
    // our two contract keys are absent.)
    const calls = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(calls).not.toContainEqual(['game-notifications']);
    expect(calls).not.toContainEqual(['messages', 'unread-count']);
  });
});
