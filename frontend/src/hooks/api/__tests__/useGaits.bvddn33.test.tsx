/**
 * useHorseGaits — query key normalization (Equoria-bvddn.33)
 *
 * useHorseGaits used to key on ['horse', String(horseId), 'gaits'] while the
 * sibling conformation hooks in the same file family key on the numeric id.
 * A caller passing a numeric id (the common case — HorseDetailPage reads
 * horseId as a route param already parsed to Number) and one passing the
 * string form of the same id landed in two different cache entries, so
 * invalidating the numeric key never reached the string-keyed one.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../../../test/msw/server';
import { useHorseGaits } from '../useGaits';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const mockGaitsResponse = {
  horseId: 9,
  horseName: 'Comet',
  breedId: 3,
  gaitScores: { walk: 70, trot: 72, canter: 68, gallop: 65, gaiting: null },
};

describe('useHorseGaits query key normalization (Equoria-bvddn.33)', () => {
  it('caches under the numeric key, matching sibling horse-scoped queries', async () => {
    server.use(
      http.get(`${base}/api/v1/horses/9/gaits`, () =>
        HttpResponse.json({ success: true, data: mockGaitsResponse })
      )
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity } },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useHorseGaits(9), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Real key: ['horse', 9, 'gaits'] — a numeric second element, matching
    // useHorseConformation's ['horse', Number(horseId), 'conformation'] and
    // useConformationTitles's ['horse', horseId, 'conformation', 'titles'].
    expect(queryClient.getQueryData(['horse', 9, 'gaits'])).toEqual(mockGaitsResponse);
    // Pre-fix this hook cached the response here instead.
    expect(queryClient.getQueryData(['horse', '9', 'gaits'])).toBeUndefined();
  });
});
