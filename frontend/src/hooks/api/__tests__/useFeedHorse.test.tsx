/**
 * useFeedHorse Sentinel Tests (Equoria-hfep, Rehab Phase 3 A13-A17)
 *
 * OPTIMAL_FIX_DISCIPLINE.md §2: positive tests that the hook FIRES.
 * Verifies mutation calls POST /api/v1/horses/:id/feed and invalidates
 * the inventory / horses / equippable query keys on success.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw/server';
import { http, HttpResponse } from 'msw';
import { useFeedHorse } from '../useFeedHorse';
import type { FeedHorseResponse } from '@/lib/api-client';
import React from 'react';

const MOCK_FEED_RESPONSE: FeedHorseResponse = {
  horse: { id: 42, name: 'Comet', lastFedDate: '2026-05-07', equippedFeedType: 'basic' },
  feed: { tier: 'basic', name: 'Basic Feed' },
  remainingUnits: 99,
  statBoost: null,
};

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useFeedHorse — mutation fires', () => {
  it('calls POST /api/v1/horses/:id/feed on mutate()', async () => {
    let hitEndpoint = false;
    server.use(
      http.post('/api/v1/horses/42/feed', () => {
        hitEndpoint = true;
        return HttpResponse.json(MOCK_FEED_RESPONSE);
      })
    );

    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const { result } = renderHook(() => useFeedHorse(42), { wrapper: wrapper(qc) });

    await act(async () => {
      result.current.mutate();
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(hitEndpoint).toBe(true);
    expect(result.current.isSuccess).toBe(true);
  });

  it('invalidates inventory, horses, and equippable query keys on success', async () => {
    server.use(http.post('/api/v1/horses/42/feed', () => HttpResponse.json(MOCK_FEED_RESPONSE)));

    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useFeedHorse(42), { wrapper: wrapper(qc) });

    await act(async () => {
      result.current.mutate();
      await new Promise((r) => setTimeout(r, 100));
    });

    const calledKeys = invalidateSpy.mock.calls.map((c) => c[0]);
    expect(calledKeys).toContainEqual({ queryKey: ['inventory'], refetchType: 'none' });
    expect(calledKeys).toContainEqual({ queryKey: ['horses', 42], refetchType: 'none' });
    expect(calledKeys).toContainEqual({ queryKey: ['horses'], refetchType: 'none' });
    expect(calledKeys).toContainEqual({ queryKey: ['equippable', 42], refetchType: 'none' });
  });

  it('does NOT set cache data for skipped:retired response', async () => {
    const skippedResponse: FeedHorseResponse = {
      horse: { id: 42, name: 'Comet', lastFedDate: null, equippedFeedType: null },
      skipped: 'retired',
    };
    server.use(http.post('/api/v1/horses/42/feed', () => HttpResponse.json(skippedResponse)));

    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    qc.setQueryData<{ lastFedDate: string | null }>(['horses', 42], {
      lastFedDate: '2026-01-01',
    } as never);

    const { result } = renderHook(() => useFeedHorse(42), { wrapper: wrapper(qc) });

    await act(async () => {
      result.current.mutate();
      await new Promise((r) => setTimeout(r, 100));
    });

    // Cache must NOT be overwritten when skipped
    const cached = qc.getQueryData<{ lastFedDate: string | null }>(['horses', 42]);
    expect(cached?.lastFedDate).toBe('2026-01-01');
  });
});
