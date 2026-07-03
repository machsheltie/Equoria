/**
 * useUserCompetitionResults hook tests (Equoria-oey96.5).
 *
 * Boundary contract:
 *   - GET /api/v1/competition/user-results returns
 *       { success: true, results: [...], count: N }
 *   - apiClient does NOT auto-unwrap this envelope (no `data` key),
 *     so fetchUserCompetitionResults extracts `.results` before returning.
 *
 * Coverage:
 *   - Fetches when userId is provided
 *   - Returns loading state initially
 *   - Disabled when userId is null
 *   - Handles empty results
 *   - Handles server error
 *   - Query key namespaced by userId
 *
 * No vi.mock of api-client - MSW at the network boundary only.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import {
  useUserCompetitionResults,
  userCompetitionResultsQueryKeys,
} from '../useUserCompetitionResults';
import { server } from '../../../test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const RESULTS_PATH = `${base}/api/v1/competition/user-results`;

const mockResults = [
  {
    competitionId: 42,
    competitionName: 'Spring Dressage Championship',
    discipline: 'Dressage',
    date: '2026-06-01T10:00:00Z',
    totalParticipants: 12,
    prizePool: 5000,
    userResults: [
      {
        horseId: 1,
        horseName: 'Thunder',
        rank: 1,
        score: 92.5,
        prizeWon: 2500,
        xpGained: 0,
      },
    ],
  },
];

const createWrapper = () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

describe('useUserCompetitionResults (Equoria-oey96.5)', () => {
  it('fetches results when userId is provided', async () => {
    let called = 0;
    server.use(
      http.get(RESULTS_PATH, () => {
        called += 1;
        return HttpResponse.json({
          success: true,
          results: mockResults,
          count: mockResults.length,
        });
      })
    );

    const { result } = renderHook(() => useUserCompetitionResults('user-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(called).toBe(1);
    expect(result.current.data).toEqual(mockResults);
  });

  it('returns loading state before the fetch resolves', async () => {
    server.use(
      http.get(RESULTS_PATH, async () => {
        await delay('infinite');
        return HttpResponse.json({ success: true, results: [], count: 0 });
      })
    );

    const { result } = renderHook(() => useUserCompetitionResults('user-1'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('stays disabled when userId is null (no network call)', async () => {
    let called = 0;
    server.use(
      http.get(RESULTS_PATH, () => {
        called += 1;
        return HttpResponse.json({ success: true, results: [], count: 0 });
      })
    );

    const { result } = renderHook(() => useUserCompetitionResults(null), {
      wrapper: createWrapper(),
    });

    // React Query enabled:false leaves isPending true but never fetches.
    await new Promise((r) => setTimeout(r, 50));
    expect(called).toBe(0);
    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  it('resolves to empty array when the server returns zero results', async () => {
    server.use(
      http.get(RESULTS_PATH, () => HttpResponse.json({ success: true, results: [], count: 0 }))
    );

    const { result } = renderHook(() => useUserCompetitionResults('user-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('surfaces server errors via isError', async () => {
    server.use(
      http.get(RESULTS_PATH, () =>
        HttpResponse.json({ success: false, message: 'Boom' }, { status: 500 })
      )
    );

    const { result } = renderHook(() => useUserCompetitionResults('user-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('query key includes the userId for cache scoping', () => {
    expect(userCompetitionResultsQueryKeys.results('user-1')).toEqual([
      'user-competition-results',
      'user-1',
    ]);
  });
});
