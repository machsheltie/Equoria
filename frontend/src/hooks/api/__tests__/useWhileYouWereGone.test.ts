/**
 * useWhileYouWereGone Hook Tests
 *
 * Tests the WYAG fetching hook with MSW handlers and enabled param.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect } from 'vitest';
import React from 'react';
import { useWhileYouWereGone } from '../useWhileYouWereGone';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

const FIVE_HOURS_AGO = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();

describe('useWhileYouWereGone', () => {
  it('does not fetch when enabled is false', () => {
    const { result } = renderHook(() => useWhileYouWereGone(FIVE_HOURS_AGO, false), {
      wrapper: createWrapper(),
    });
    // Should not be loading since query is disabled
    expect(result.current.isLoading).toBe(false);
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('does not fetch when since is null', () => {
    const { result } = renderHook(() => useWhileYouWereGone(null, true), {
      wrapper: createWrapper(),
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches data when enabled is true and since is provided', async () => {
    const { result } = renderHook(() => useWhileYouWereGone(FIVE_HOURS_AGO, true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(result.current.data!.items).toBeDefined();
    expect(Array.isArray(result.current.data!.items)).toBe(true);
  });

  it('returns items with correct shape', async () => {
    const { result } = renderHook(() => useWhileYouWereGone(FIVE_HOURS_AGO, true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const item = result.current.data!.items[0];
    expect(item).toEqual(
      expect.objectContaining({
        type: 'competition-result',
        title: 'Thunder won 1st place!',
      })
    );
  });

  it('returns hasMore flag', async () => {
    const { result } = renderHook(() => useWhileYouWereGone(FIVE_HOURS_AGO, true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data!.hasMore).toBe(false);
  });
});
