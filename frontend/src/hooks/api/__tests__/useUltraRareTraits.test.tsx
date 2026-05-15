/**
 * useHorseUltraRareTraits Hook Tests (Equoria-gt6j)
 *
 * Verifies the read hook that surfaces UltraRareTraitEvent rows for a horse.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect } from 'vitest';
import React from 'react';
import { server } from '@/test/msw/server';
import { http, HttpResponse } from 'msw';
import { useHorseUltraRareTraits } from '../useUltraRareTraits';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

const MOCK_RESPONSE = {
  success: true,
  data: {
    horse: { id: 42, name: 'Comet' },
    traits: { ultraRare: [{ name: 'Phoenix' }], exotic: [] },
    recentEvents: [{ id: 9, horseId: 42, traitName: 'Phoenix', timestamp: '2026-05-15T00:00:00Z' }],
    totalTraits: 1,
  },
};

describe('useHorseUltraRareTraits', () => {
  it('is disabled when horseId is undefined', () => {
    const { result } = renderHook(() => useHorseUltraRareTraits(undefined), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  it('fetches recent ultra-rare trait events for a horse', async () => {
    server.use(
      http.get('/api/v1/ultra-rare-traits/horse/42', () => HttpResponse.json(MOCK_RESPONSE))
    );

    const { result } = renderHook(() => useHorseUltraRareTraits(42), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(result.current.data!.recentEvents).toHaveLength(1);
    expect(result.current.data!.recentEvents[0].traitName).toBe('Phoenix');
    expect(result.current.data!.horse.name).toBe('Comet');
  });
});
