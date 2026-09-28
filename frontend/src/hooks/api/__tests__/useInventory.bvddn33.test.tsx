/**
 * useEquipItem — cache invalidation (Equoria-bvddn.33)
 *
 * useEquipItem's onSettled used to invalidate ['horse', horseId] (singular).
 * The real horse-detail cache key used by every other consumer (useHorses.ts
 * horseKeys.detail, useFeedHorse, useEquipFeed) is ['horses', horseId]
 * (plural). So equipping tack never refreshed a horse's own detail page —
 * the invalidated key matched nothing in the cache.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { useEquipItem } from '../useInventory';
import React from 'react';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useEquipItem — cache invalidation (Equoria-bvddn.33)', () => {
  it('invalidates the real ["horses", horseId] detail key, not ["horse", horseId]', async () => {
    server.use(
      http.post(`${base}/api/v1/inventory/equip`, () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [],
            equippedItem: {
              id: 'tack-1',
              itemId: 'saddle-1',
              category: 'saddle',
              name: 'Saddle',
              quantity: 1,
            },
          },
        })
      )
    );

    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useEquipItem(), { wrapper: wrapper(qc) });

    await act(async () => {
      result.current.mutate({ inventoryItemId: 'tack-1', horseId: 42 });
      await new Promise((r) => setTimeout(r, 100));
    });

    const calledKeys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    // Real detail key (matches horseQueryKeys.detail(42) from useHorses.ts).
    expect(calledKeys).toContainEqual(['horses', 42]);
    // The old, dead singular key must no longer be invalidated.
    expect(calledKeys).not.toContainEqual(['horse', 42]);
  });
});
