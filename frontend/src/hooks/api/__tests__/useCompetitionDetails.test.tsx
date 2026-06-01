/**
 * Tests for useCompetitionDetails Hook
 *
 * Competition Entry System - useCompetitionDetails hook tests
 *
 * Network boundary stubbed with MSW per-test `server.use(...)` overrides
 * (mzrv2 / Constitution §3: no vi.mock-of-API-client). The hook exercises the
 * real `apiClient` envelope unwrap of `{ success, data }` end-to-end.
 *
 * Tests for fetching detailed competition information:
 * - Basic fetching with ID (real HTTP path verified)
 * - Loading states (never-resolving handler)
 * - Error handling (HTTP error response)
 * - Disabled state when ID is null
 * - Query key separation from list queries
 * - Data updates when ID changes
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import * as competitionsApi from '@/lib/api/competitions';
import { useCompetitionDetails, competitionDetailsQueryKeys } from '../useCompetitionDetails';
import { server } from '../../../test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const mockCompetitionDetails: competitionsApi.CompetitionData = {
  id: 1,
  name: 'Spring Dressage Championship',
  description: 'Annual spring dressage competition for intermediate riders',
  discipline: 'dressage',
  date: '2026-03-15T10:00:00Z',
  location: 'Central Arena',
  prizePool: 5000,
  entryFee: 50,
  maxEntries: 20,
  currentEntries: 12,
  status: 'open',
  requirements: {
    minAge: 3,
    maxAge: 15,
    minLevel: 5,
    requiredTraits: ['balanced', 'focused'],
  },
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useCompetitionDetails', () => {
  let calledPaths: string[] = [];

  beforeEach(() => {
    calledPaths = [];
  });

  // Test 1: Fetches competition details when ID provided
  it('should fetch competition details when ID is provided', async () => {
    server.use(
      http.get(`${base}/api/v1/competitions/:id`, ({ request, params }) => {
        calledPaths.push(new URL(request.url).pathname);
        return HttpResponse.json({
          success: true,
          data: { ...mockCompetitionDetails, id: Number(params.id) },
        });
      })
    );

    const { result } = renderHook(() => useCompetitionDetails(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(calledPaths).toEqual(['/api/v1/competitions/1']);
    expect(result.current.data).toEqual(mockCompetitionDetails);
  });

  // Test 2: Returns loading state initially
  it('should return loading state initially', async () => {
    server.use(
      http.get(`${base}/api/v1/competitions/:id`, async () => {
        await delay('infinite'); // never resolves — keeps the hook in loading state
        return HttpResponse.json({ success: true, data: mockCompetitionDetails });
      })
    );

    const { result } = renderHook(() => useCompetitionDetails(1), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  // Test 3: Returns data after successful fetch
  it('should return data after successful fetch', async () => {
    server.use(
      http.get(`${base}/api/v1/competitions/:id`, () => {
        return HttpResponse.json({ success: true, data: mockCompetitionDetails });
      })
    );

    const { result } = renderHook(() => useCompetitionDetails(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.name).toBe('Spring Dressage Championship');
    expect(result.current.data?.discipline).toBe('dressage');
    expect(result.current.data?.prizePool).toBe(5000);
    expect(result.current.data?.requirements?.minLevel).toBe(5);
  });

  // Test 4: Handles fetch error correctly
  it('should handle fetch error correctly', async () => {
    server.use(
      http.get(`${base}/api/v1/competitions/:id`, () => {
        return HttpResponse.json(
          { success: false, message: 'Competition not found' },
          { status: 404 }
        );
      })
    );

    const { result } = renderHook(() => useCompetitionDetails(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
    expect(result.current.error?.statusCode).toBe(404);
    expect(result.current.error?.message).toBe('Competition not found');
    expect(result.current.data).toBeUndefined();
  });

  // Test 5: Disabled when ID is null
  it('should not fetch when ID is null', async () => {
    server.use(
      http.get(`${base}/api/v1/competitions/:id`, ({ request }) => {
        calledPaths.push(new URL(request.url).pathname);
        return HttpResponse.json({ success: true, data: mockCompetitionDetails });
      })
    );

    const { result } = renderHook(() => useCompetitionDetails(null), {
      wrapper: createWrapper(),
    });

    // Should not call API when ID is null
    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
    expect(calledPaths).toEqual([]);
  });

  // Test 6: Updates when ID changes
  it('should fetch new data when ID changes', async () => {
    server.use(
      http.get(`${base}/api/v1/competitions/:id`, ({ request, params }) => {
        calledPaths.push(new URL(request.url).pathname);
        const id = Number(params.id);
        if (id === 1) {
          return HttpResponse.json({
            success: true,
            data: { ...mockCompetitionDetails, id: 1, name: 'Competition 1' },
          });
        }
        if (id === 2) {
          return HttpResponse.json({
            success: true,
            data: { ...mockCompetitionDetails, id: 2, name: 'Competition 2' },
          });
        }
        return HttpResponse.json({ success: false, message: 'Not found' }, { status: 404 });
      })
    );

    const { result, rerender } = renderHook(
      ({ id }: { id: number | null }) => useCompetitionDetails(id),
      {
        wrapper: createWrapper(),
        initialProps: { id: 1 as number | null },
      }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.name).toBe('Competition 1');
    expect(calledPaths).toContain('/api/v1/competitions/1');

    // Change ID
    rerender({ id: 2 });

    await waitFor(() => expect(result.current.data?.name).toBe('Competition 2'));
    expect(calledPaths).toContain('/api/v1/competitions/2');
    expect(calledPaths).toHaveLength(2);
  });

  // Test 7: Uses separate cache from competitions list
  it('should use separate query key from competitions list', async () => {
    server.use(
      http.get(`${base}/api/v1/competitions/:id`, () => {
        return HttpResponse.json({ success: true, data: mockCompetitionDetails });
      })
    );

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useCompetitionDetails(1), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify query key is different from list key
    const detailsKey = competitionDetailsQueryKeys.detail(1);
    expect(detailsKey).toEqual(['competition', 'detail', 1]);

    // Verify list key is not affected
    const listData = queryClient.getQueryData(['competitions', 'filtered']);
    expect(listData).toBeUndefined();

    // Verify detail data is cached correctly
    const detailData = queryClient.getQueryData(detailsKey);
    expect(detailData).toEqual(mockCompetitionDetails);
  });
});

describe('competitionDetailsQueryKeys', () => {
  it('should export query keys for external use', () => {
    expect(competitionDetailsQueryKeys).toBeDefined();
    expect(competitionDetailsQueryKeys.all).toEqual(['competition', 'detail']);
    expect(competitionDetailsQueryKeys.detail(1)).toEqual(['competition', 'detail', 1]);
    expect(competitionDetailsQueryKeys.detail(123)).toEqual(['competition', 'detail', 123]);
  });

  it('should create unique keys for different competition IDs', () => {
    const key1 = competitionDetailsQueryKeys.detail(1);
    const key2 = competitionDetailsQueryKeys.detail(2);
    const key3 = competitionDetailsQueryKeys.detail(100);

    expect(key1).not.toEqual(key2);
    expect(key1).not.toEqual(key3);
    expect(key2).not.toEqual(key3);
  });
});
