/**
 * Tests for useLeaderboardHorseProfile Hook (Equoria-8nfc)
 *
 * Verifies the leaderboard horse-detail modal sources REAL persisted horse
 * data via GET /api/leaderboards/horse/:horseId instead of fabricated
 * placeholders. Covers:
 * - Successful real-profile fetch
 * - Loading state
 * - Error state
 * - Query disabled for null / 0 / negative horseId (no entry selected)
 * - Query disabled when `enabled=false` (modal closed)
 * - Query key construction
 *
 * Mirrors the existing useLeaderboard hook-test convention (mocks the API
 * function, not the apiClient transport).
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as leaderboardsApi from '@/lib/api/leaderboards';
import {
  useLeaderboardHorseProfile,
  leaderboardHorseProfileQueryKeys,
} from '../useLeaderboardHorseProfile';
import type { LeaderboardHorseProfile } from '@/lib/api/leaderboards';

vi.mock('@/lib/api/leaderboards', async () => {
  const actual = await vi.importActual('@/lib/api/leaderboards');
  return {
    ...actual,
    fetchLeaderboardHorseProfile: vi.fn(),
  };
});

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

const mockedFetch = vi.mocked(leaderboardsApi.fetchLeaderboardHorseProfile);

describe('useLeaderboardHorseProfile (Equoria-8nfc)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches and returns the REAL horse profile (no fabricated placeholders)', async () => {
    mockedFetch.mockResolvedValue(mockProfile);

    const { result } = renderHook(() => useLeaderboardHorseProfile(101), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockProfile);
    expect(result.current.data?.breed).toBe('Arabian');
    expect(result.current.data?.age).toBe(7);
    expect(mockedFetch).toHaveBeenCalledWith(101);
  });

  it('exposes loading state while fetching', async () => {
    mockedFetch.mockImplementation(
      () => new Promise(() => {}) // never resolves
    );

    const { result } = renderHook(() => useLeaderboardHorseProfile(101), {
      wrapper: wrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('surfaces error state on fetch failure', async () => {
    mockedFetch.mockRejectedValue(new Error('Horse not found'));

    const { result } = renderHook(() => useLeaderboardHorseProfile(999), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it.each([null, undefined, 0, -1])(
    'is disabled (no fetch) for invalid horseId %p',
    async (badId) => {
      mockedFetch.mockResolvedValue(mockProfile);

      const { result } = renderHook(
        () => useLeaderboardHorseProfile(badId as number | null | undefined),
        { wrapper: wrapper() }
      );

      expect(result.current.fetchStatus).toBe('idle');
      expect(mockedFetch).not.toHaveBeenCalled();
    }
  );

  it('is disabled when enabled=false even with a valid id (modal closed)', async () => {
    mockedFetch.mockResolvedValue(mockProfile);

    const { result } = renderHook(() => useLeaderboardHorseProfile(101, false), {
      wrapper: wrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('builds a stable per-horse query key', () => {
    expect(leaderboardHorseProfileQueryKeys.horse(101)).toEqual([
      'leaderboards',
      'horse-profile',
      101,
    ]);
  });
});
