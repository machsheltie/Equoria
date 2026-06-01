/**
 * Tests for useHorseEligibility Hook
 *
 * Competition Entry System - useHorseEligibility hook tests
 *
 * Network boundary stubbed with MSW per-test `server.use(...)` overrides
 * (mzrv2 / Constitution §3: no vi.mock-of-API-client). The hook exercises the
 * real `apiClient` envelope unwrap of `{ success, data }` end-to-end. The
 * underlying GET is /api/v1/competitions/:competitionId/eligibility/:userId
 * (two URL path params, no querystring) — captured handlers verify both
 * pathname segments per request.
 *
 * Tests for fetching horse eligibility status:
 * - Basic fetching with competition and user IDs
 * - Loading states
 * - Error handling
 * - Disabled state when either ID is null
 * - Eligibility calculation validation
 * - Data updates when IDs change
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import * as competitionsApi from '@/lib/api/competitions';
import { useHorseEligibility, horseEligibilityQueryKeys } from '../useHorseEligibility';
import { server } from '../../../test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const mockEligibleHorses: competitionsApi.EligibleHorse[] = [
  {
    id: 1,
    name: 'Thunder',
    breed: 'Thoroughbred',
    age: 5,
    level: 8,
    healthStatus: 'healthy',
    isEligible: true,
    eligibilityReasons: [],
    alreadyEntered: false,
  },
  {
    id: 2,
    name: 'Storm',
    breed: 'Arabian',
    age: 2,
    level: 3,
    healthStatus: 'healthy',
    isEligible: false,
    eligibilityReasons: ['Horse does not meet minimum age requirement (3 years)'],
    alreadyEntered: false,
  },
  {
    id: 3,
    name: 'Lightning',
    breed: 'Quarter Horse',
    age: 6,
    level: 10,
    healthStatus: 'injured',
    isEligible: false,
    eligibilityReasons: ['Horse must be healthy to compete'],
    alreadyEntered: false,
  },
  {
    id: 4,
    name: 'Blaze',
    breed: 'Mustang',
    age: 4,
    level: 6,
    healthStatus: 'healthy',
    isEligible: false,
    eligibilityReasons: [],
    alreadyEntered: true,
  },
];

interface CapturedRequest {
  pathname: string;
  search: string;
}

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

describe('useHorseEligibility', () => {
  let captured: CapturedRequest[] = [];

  beforeEach(() => {
    captured = [];
  });

  // Test 1: Fetches horse eligibility when IDs provided
  it('should fetch horse eligibility when both IDs are provided', async () => {
    server.use(
      http.get(`${base}/api/v1/competitions/:competitionId/eligibility/:userId`, ({ request }) => {
        const url = new URL(request.url);
        captured.push({ pathname: url.pathname, search: url.search });
        return HttpResponse.json({ success: true, data: mockEligibleHorses });
      })
    );

    const { result } = renderHook(() => useHorseEligibility(1, 'user-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(captured).toHaveLength(1);
    expect(captured[0].pathname).toBe('/api/v1/competitions/1/eligibility/user-123');
    expect(captured[0].search).toBe('');
    expect(result.current.data).toEqual(mockEligibleHorses);
  });

  // Test 2: Returns loading state initially
  it('should return loading state initially', () => {
    server.use(
      http.get(`${base}/api/v1/competitions/:competitionId/eligibility/:userId`, async () => {
        await delay('infinite');
        return HttpResponse.json({ success: true, data: mockEligibleHorses });
      })
    );

    const { result } = renderHook(() => useHorseEligibility(1, 'user-123'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  // Test 3: Returns eligible horses list
  it('should return eligible horses list with eligibility status', async () => {
    server.use(
      http.get(`${base}/api/v1/competitions/:competitionId/eligibility/:userId`, () => {
        return HttpResponse.json({ success: true, data: mockEligibleHorses });
      })
    );

    const { result } = renderHook(() => useHorseEligibility(1, 'user-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(4);

    // Check eligible horse
    const eligibleHorse = result.current.data?.find((h) => h.id === 1);
    expect(eligibleHorse?.isEligible).toBe(true);
    expect(eligibleHorse?.alreadyEntered).toBe(false);

    // Check ineligible horses with reasons
    const tooYoung = result.current.data?.find((h) => h.id === 2);
    expect(tooYoung?.isEligible).toBe(false);
    expect(tooYoung?.eligibilityReasons).toContain(
      'Horse does not meet minimum age requirement (3 years)'
    );
  });

  // Test 4: Calculates eligibility correctly (verifies data structure)
  it('should return horses with correct eligibility structure', async () => {
    server.use(
      http.get(`${base}/api/v1/competitions/:competitionId/eligibility/:userId`, () => {
        return HttpResponse.json({ success: true, data: mockEligibleHorses });
      })
    );

    const { result } = renderHook(() => useHorseEligibility(1, 'user-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify each horse has required fields
    result.current.data?.forEach((horse) => {
      expect(horse).toHaveProperty('id');
      expect(horse).toHaveProperty('name');
      expect(horse).toHaveProperty('breed');
      expect(horse).toHaveProperty('age');
      expect(horse).toHaveProperty('level');
      expect(horse).toHaveProperty('healthStatus');
      expect(horse).toHaveProperty('isEligible');
      expect(horse).toHaveProperty('alreadyEntered');
      expect(typeof horse.isEligible).toBe('boolean');
      expect(typeof horse.alreadyEntered).toBe('boolean');
    });

    // Verify eligibility reasons for ineligible horses
    const ineligible = result.current.data?.filter((h) => !h.isEligible && !h.alreadyEntered);
    expect(ineligible?.length).toBeGreaterThan(0);
    ineligible?.forEach((horse) => {
      expect(Array.isArray(horse.eligibilityReasons)).toBe(true);
    });
  });

  // Test 5: Handles fetch error correctly
  it('should handle fetch error correctly', async () => {
    server.use(
      http.get(`${base}/api/v1/competitions/:competitionId/eligibility/:userId`, () => {
        return HttpResponse.json(
          { success: false, message: 'Failed to fetch horse eligibility' },
          { status: 500 }
        );
      })
    );

    const { result } = renderHook(() => useHorseEligibility(1, 'user-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
    expect(result.current.error?.statusCode).toBe(500);
    expect(result.current.error?.message).toBe('Failed to fetch horse eligibility');
    expect(result.current.data).toBeUndefined();
  });

  // Test 6: Disabled when competitionId is null
  it('should not fetch when competitionId is null', () => {
    server.use(
      http.get(`${base}/api/v1/competitions/:competitionId/eligibility/:userId`, ({ request }) => {
        const url = new URL(request.url);
        captured.push({ pathname: url.pathname, search: url.search });
        return HttpResponse.json({ success: true, data: mockEligibleHorses });
      })
    );

    const { result } = renderHook(() => useHorseEligibility(null, 'user-123'), {
      wrapper: createWrapper(),
    });

    expect(captured).toEqual([]);
    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  // Test 7: Disabled when userId is null
  it('should not fetch when userId is null', () => {
    server.use(
      http.get(`${base}/api/v1/competitions/:competitionId/eligibility/:userId`, ({ request }) => {
        const url = new URL(request.url);
        captured.push({ pathname: url.pathname, search: url.search });
        return HttpResponse.json({ success: true, data: mockEligibleHorses });
      })
    );

    const { result } = renderHook(() => useHorseEligibility(1, null), { wrapper: createWrapper() });

    expect(captured).toEqual([]);
    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  // Test 8: Updates when IDs change
  it('should fetch new data when IDs change', async () => {
    const horses1 = [mockEligibleHorses[0]];
    const horses2 = [mockEligibleHorses[1], mockEligibleHorses[2]];

    server.use(
      http.get(
        `${base}/api/v1/competitions/:competitionId/eligibility/:userId`,
        ({ request, params }) => {
          const url = new URL(request.url);
          captured.push({ pathname: url.pathname, search: url.search });
          const competitionId = Number(params.competitionId);
          const userId = String(params.userId);
          if (competitionId === 1 && userId === 'user-1') {
            return HttpResponse.json({ success: true, data: horses1 });
          }
          if (competitionId === 2 && userId === 'user-2') {
            return HttpResponse.json({ success: true, data: horses2 });
          }
          return HttpResponse.json({ success: true, data: [] });
        }
      )
    );

    const { result, rerender } = renderHook(
      ({ compId, userId }: { compId: number | null; userId: string | null }) =>
        useHorseEligibility(compId, userId),
      {
        wrapper: createWrapper(),
        initialProps: { compId: 1, userId: 'user-1' },
      }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].name).toBe('Thunder');

    // Change both IDs
    rerender({ compId: 2, userId: 'user-2' });

    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(result.current.data?.[0].name).toBe('Storm');

    expect(captured).toHaveLength(2);
    expect(captured[0].pathname).toBe('/api/v1/competitions/1/eligibility/user-1');
    expect(captured[1].pathname).toBe('/api/v1/competitions/2/eligibility/user-2');
  });
});

describe('horseEligibilityQueryKeys', () => {
  it('should export query keys for external use', () => {
    expect(horseEligibilityQueryKeys).toBeDefined();
    expect(horseEligibilityQueryKeys.all).toEqual(['horse-eligibility']);
    expect(horseEligibilityQueryKeys.forCompetition(1, 'user-123')).toEqual([
      'horse-eligibility',
      1,
      'user-123',
    ]);
  });

  it('should create unique keys for different ID combinations', () => {
    const key1 = horseEligibilityQueryKeys.forCompetition(1, 'user-1');
    const key2 = horseEligibilityQueryKeys.forCompetition(1, 'user-2');
    const key3 = horseEligibilityQueryKeys.forCompetition(2, 'user-1');

    expect(key1).not.toEqual(key2);
    expect(key1).not.toEqual(key3);
    expect(key2).not.toEqual(key3);
  });
});
