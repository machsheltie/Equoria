/**
 * useEnterConformationShow — cache invalidation (Equoria-bvddn.33)
 *
 * onSuccess used to invalidate ['user', 'balance'] — a key only the dead
 * useUserBalance hook reads (Equoria-bvddn.41 removes that hook entirely).
 * The player's real balance lives under ['profile'] (useAuth.ts), the same
 * key useEnterCompetition already invalidates. Kept symmetric with that
 * sibling hook.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { useEnterConformationShow } from '../useConformationShow';
import React from 'react';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useEnterConformationShow — cache invalidation (Equoria-bvddn.33)', () => {
  it('invalidates ["profile"] on success, not the dead ["user","balance"] key', async () => {
    server.use(
      http.post(`${base}/api/v1/competition/conformation/enter`, () =>
        HttpResponse.json({
          success: true,
          data: { entryId: 1, horseId: 5, showId: 9, className: 'Mares' },
        })
      )
    );

    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useEnterConformationShow(), { wrapper: wrapper(qc) });

    await act(async () => {
      result.current.mutate({ horseId: 5, groomId: 3, showId: 9, className: 'Mares' });
      await new Promise((r) => setTimeout(r, 100));
    });

    const calledKeys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(calledKeys).toContainEqual(['profile']);
    expect(calledKeys).not.toContainEqual(['user', 'balance']);
  });
});
