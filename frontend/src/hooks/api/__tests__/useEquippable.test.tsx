/**
 * useEquippable Sentinel Tests (Equoria-hfep, Rehab Phase 3 A13-A17)
 *
 * OPTIMAL_FIX_DISCIPLINE.md §2: positive test that the hook FIRES.
 * Verifies query hits GET /api/v1/horses/:id/equippable and returns
 * the tack + feed arrays with their expected shapes.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { http, HttpResponse } from 'msw';
import { useEquippable } from '../useEquippable';
import type { EquippableResponse } from '@/lib/api-client';
import React from 'react';

const MOCK_EQUIPPABLE: EquippableResponse = {
  tack: [],
  feed: [
    { feedType: 'basic', name: 'Basic Feed', quantity: 50, isCurrentlyEquippedToThisHorse: true },
    {
      feedType: 'performance',
      name: 'Performance Feed',
      quantity: 10,
      isCurrentlyEquippedToThisHorse: false,
    },
  ],
};

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('useEquippable — query fires', () => {
  it('hits GET /api/v1/horses/:id/equippable and returns data', async () => {
    let hitEndpoint = false;
    server.use(
      http.get('/api/v1/horses/99/equippable', () => {
        hitEndpoint = true;
        return HttpResponse.json(MOCK_EQUIPPABLE);
      })
    );

    const { result } = renderHook(() => useEquippable(99), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(hitEndpoint).toBe(true);
    expect(result.current.data).toEqual(MOCK_EQUIPPABLE);
  });

  it('exposes tack and feed arrays', async () => {
    server.use(http.get('/api/v1/horses/99/equippable', () => HttpResponse.json(MOCK_EQUIPPABLE)));

    const { result } = renderHook(() => useEquippable(99), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(Array.isArray(result.current.data?.tack)).toBe(true);
    expect(Array.isArray(result.current.data?.feed)).toBe(true);
    expect(result.current.data?.feed).toHaveLength(2);
    expect(result.current.data?.feed[0].isCurrentlyEquippedToThisHorse).toBe(true);
  });

  it('uses [equippable, horseId] query key', async () => {
    server.use(http.get('/api/v1/horses/77/equippable', () => HttpResponse.json(MOCK_EQUIPPABLE)));

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result } = renderHook(() => useEquippable(77), {
      wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = qc.getQueryData(['equippable', 77]);
    expect(cached).toEqual(MOCK_EQUIPPABLE);
  });
});
