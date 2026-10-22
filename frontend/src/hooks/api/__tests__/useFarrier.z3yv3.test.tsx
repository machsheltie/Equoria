/**
 * useBookFarrierService — balance invalidation (Equoria-z3yv3)
 *
 * Booking a farrier service spends coins server-side. The player's balance
 * lives under ['profile'] (useAuth.ts), so the mutation must invalidate it the
 * way useBookVetAppointment does — otherwise the nav coin balance and BankPage
 * stay stale after payment (FRONTEND_ASYNC_STATE_DOCTRINE §2).
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { useBookFarrierService } from '../useFarrier';
import React from 'react';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useBookFarrierService — cache invalidation (Equoria-z3yv3)', () => {
  it('invalidates ["profile"] (the live balance) as well as ["horses"] on success', async () => {
    server.use(
      http.post(`${base}/api/v1/farrier/book-service`, () =>
        HttpResponse.json({
          success: true,
          message: 'Hoof Trim booked successfully',
          data: {
            horse: { id: 1, name: 'Starlight', hoofCondition: 'good' },
            service: { id: 'trim', name: 'Hoof Trim', cost: 150 },
            cost: 150,
            remainingMoney: 850,
          },
        })
      )
    );

    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useBookFarrierService(), { wrapper: wrapper(qc) });

    await act(async () => {
      result.current.mutate({ horseId: 1, serviceId: 'trim' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const calledKeys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(calledKeys).toContainEqual(['horses']);
    expect(calledKeys).toContainEqual(['profile']);
  });
});
