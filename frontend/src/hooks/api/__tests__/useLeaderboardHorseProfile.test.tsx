/**
 * Tests for useLeaderboardHorseProfile Hook (Equoria-8nfc)
 *
 * Verifies the leaderboard horse-detail modal sources REAL persisted horse
 * data via GET /api/v1/leaderboards/horse/:horseId instead of fabricated
 * placeholders. Covers:
 * - Successful real-profile fetch
 * - Loading state
 * - Error state
 * - Query disabled for null / 0 / negative horseId (no entry selected)
 * - Query disabled when `enabled=false` (modal closed)
 * - Query key construction
 *
 * Network boundary stubbed with MSW per-test `server.use(...)` overrides
 * (mzrv2 / Constitution §3: no vi.mock-of-API-client). The hook exercises
 * the real `apiClient` envelope unwrap end-to-end.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse, delay } from 'msw';
import {
  useLeaderboardHorseProfile,
  leaderboardHorseProfileQueryKeys,
} from '../useLeaderboardHorseProfile';
import type { LeaderboardHorseProfile } from '@/lib/api/leaderboards';
import { server } from '../../../test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const mockProfile: LeaderboardHorseProfile = {
  horseId: 101,
  name: 'Thunder Strike',
  breed: 'Arabian',
  age: 7,
  sex: 'Mare',
  stats: {
    speed: 88,
    stamina: 91,
    agility: 76,
    balance: 70,
    precision: 82,
    intelligence: 79,
    boldness: 84,
    flexibility: 73,
    obedience: 80,
    focus: 86,
  },
  totalEarnings: 125000,
  competitionWins: 12,
  topThreeFinishes: 21,
};

function wrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useLeaderboardHorseProfile (Equoria-8nfc)', () => {
  let calledPaths: string[] = [];

  beforeEach(() => {
    calledPaths = [];
  });

  it('fetches and returns the REAL horse profile (no fabricated placeholders)', async () => {
    server.use(
      http.get(`${base}/api/v1/leaderboards/horse/:horseId`, ({ request, params }) => {
        calledPaths.push(new URL(request.url).pathname);
        const horseId = Number(params.horseId);
        return HttpResponse.json({
          success: true,
          data: { ...mockProfile, horseId },
        });
      })
    );

    const { result } = renderHook(() => useLeaderboardHorseProfile(101), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockProfile);
    expect(result.current.data?.breed).toBe('Arabian');
    expect(result.current.data?.age).toBe(7);
    expect(calledPaths).toEqual(['/api/v1/leaderboards/horse/101']);
  });

  it('exposes loading state while fetching', async () => {
    server.use(
      http.get(`${base}/api/v1/leaderboards/horse/:horseId`, async () => {
        await delay('infinite');
        return HttpResponse.json({ success: true, data: mockProfile });
      })
    );

    const { result } = renderHook(() => useLeaderboardHorseProfile(101), {
      wrapper: wrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('surfaces error state on fetch failure', async () => {
    server.use(
      http.get(`${base}/api/v1/leaderboards/horse/:horseId`, () => {
        return HttpResponse.json({ success: false, message: 'Horse not found' }, { status: 404 });
      })
    );

    const { result } = renderHook(() => useLeaderboardHorseProfile(999), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it.each([null, undefined, 0, -1])(
    'is disabled (no fetch) for invalid horseId %p',
    async (badId) => {
      server.use(
        http.get(`${base}/api/v1/leaderboards/horse/:horseId`, ({ request }) => {
          calledPaths.push(new URL(request.url).pathname);
          return HttpResponse.json({ success: true, data: mockProfile });
        })
      );

      const { result } = renderHook(
        () => useLeaderboardHorseProfile(badId as number | null | undefined),
        { wrapper: wrapper() }
      );

      expect(result.current.fetchStatus).toBe('idle');
      expect(calledPaths).toEqual([]);
    }
  );

  it('is disabled when enabled=false even with a valid id (modal closed)', async () => {
    server.use(
      http.get(`${base}/api/v1/leaderboards/horse/:horseId`, ({ request }) => {
        calledPaths.push(new URL(request.url).pathname);
        return HttpResponse.json({ success: true, data: mockProfile });
      })
    );

    const { result } = renderHook(() => useLeaderboardHorseProfile(101, false), {
      wrapper: wrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(calledPaths).toEqual([]);
  });

  it('builds a stable per-horse query key', () => {
    expect(leaderboardHorseProfileQueryKeys.horse(101)).toEqual([
      'leaderboards',
      'horse-profile',
      101,
    ]);
  });
});
