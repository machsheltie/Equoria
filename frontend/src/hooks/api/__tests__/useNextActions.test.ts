/**
 * useNextActions Hook Tests
 *
 * Tests the next actions fetching hook with MSW handlers.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect } from 'vitest';
import React from 'react';
import { useNextActions } from '../useNextActions';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useNextActions', () => {
  it('starts in loading state', () => {
    const { result } = renderHook(() => useNextActions(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('fetches and returns actions array', async () => {
    const { result } = renderHook(() => useNextActions(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data!.length).toBe(3);
  });

  it('returns actions with correct shape', async () => {
    const { result } = renderHook(() => useNextActions(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const firstAction = result.current.data![0];
    expect(firstAction).toEqual(
      expect.objectContaining({
        type: 'train',
        priority: 1,
        horseId: 1,
        horseName: 'Thunder',
      })
    );
  });
});
