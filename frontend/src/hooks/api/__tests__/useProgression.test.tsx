/**
 * Tests for Progression Data Fetching Hooks
 *
 * Story 3-4: XP & Progression Display - Task 6
 *
 * Tests for:
 * - useHorseProgression (XP and level data)
 * - useStatHistory (historical stats over time)
 * - useRecentGains (recent stat changes)
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as apiClient from '@/lib/api-client';
import {
  useHorseProgression,
  useStatHistory,
  useRecentGains,
} from '../useProgression';

// Mock API client
vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual('@/lib/api-client');
  return {
    ...actual,
    horsesApi: {
      getProgression: vi.fn(),
      getStatHistory: vi.fn(),
      getRecentGains: vi.fn(),
    },
  };
});

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useHorseProgression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch horse progression data', async () => {
    const mockProgression = {
      horseId: 1,
      horseName: 'Thunder',
      currentLevel: 5,
      currentXP: 2450,
      xpToNextLevel: 5000,
      totalXP: 12450,
      progressPercentage: 49,
      recentLevelUps: [
        { level: 5, timestamp: '2025-12-01T10:00:00Z', xpGained: 1500 },
        { level: 4, timestamp: '2025-11-15T14:30:00Z', xpGained: 1200 },
      ],
    };

    vi.mocked(apiClient.horsesApi.getProgression).mockResolvedValue(mockProgression);

    const { result } = renderHook(() => useHorseProgression(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockProgression);
    expect(apiClient.horsesApi.getProgression).toHaveBeenCalledWith(1);
  });

  it('should return level and XP data', async () => {
    const mockProgression = {
      horseId: 1,
      horseName: 'Thunder',
      currentLevel: 5,
      currentXP: 2450,
      xpToNextLevel: 5000,
      totalXP: 12450,
      progressPercentage: 49,
      recentLevelUps: [],
    };

    vi.mocked(apiClient.horsesApi.getProgression).mockResolvedValue(mockProgression);

    const { result } = renderHook(() => useHorseProgression(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.currentLevel).toBe(5);
    expect(result.current.data?.currentXP).toBe(2450);
    expect(result.current.data?.xpToNextLevel).toBe(5000);
    expect(result.current.data?.progressPercentage).toBe(49);
  });

  it('should include recent level-ups', async () => {
    const mockProgression = {
      horseId: 1,
      horseName: 'Thunder',
      currentLevel: 5,
      currentXP: 2450,
      xpToNextLevel: 5000,
      totalXP: 12450,
      progressPercentage: 49,
      recentLevelUps: [
        { level: 5, timestamp: '2025-12-01T10:00:00Z', xpGained: 1500 },
      ],
    };

    vi.mocked(apiClient.horsesApi.getProgression).mockResolvedValue(mockProgression);

    const { result } = renderHook(() => useHorseProgression(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.recentLevelUps).toHaveLength(1);
    expect(result.current.data?.recentLevelUps[0].level).toBe(5);
  });

  it('should not fetch when horseId is 0', () => {
    renderHook(() => useHorseProgression(0), {
      wrapper: createWrapper(),
    });

    expect(apiClient.horsesApi.getProgression).not.toHaveBeenCalled();
  });

  it('should handle fetch errors', async () => {
    const mockError = { message: 'Failed to fetch progression data' };
    vi.mocked(apiClient.horsesApi.getProgression).mockRejectedValue(mockError);

    const { result } = renderHook(() => useHorseProgression(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(mockError);
  });

  it('should use correct stale time', async () => {
    const mockProgression = {
      horseId: 1,
      horseName: 'Thunder',
      currentLevel: 5,
      currentXP: 2450,
      xpToNextLevel: 5000,
      totalXP: 12450,
      progressPercentage: 49,
      recentLevelUps: [],
    };

    vi.mocked(apiClient.horsesApi.getProgression).mockResolvedValue(mockProgression);

    const { result } = renderHook(() => useHorseProgression(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Data should be fresh for 1 minute
    expect(result.current.isStale).toBe(false);
  });
});

describe('useStatHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch stat history data', async () => {
    const mockHistory = {
      horseId: 1,
      horseName: 'Thunder',
      timeRange: '30d',
      statData: [
        {
          timestamp: '2025-12-01T00:00:00Z',
          speed: 65,
          stamina: 70,
          agility: 55,
          strength: 60,
          intelligence: 50,
          temperament: 75,
        },
        {
          timestamp: '2025-12-02T00:00:00Z',
          speed: 66,
          stamina: 71,
          agility: 55,
          strength: 60,
          intelligence: 51,
          temperament: 75,
        },
      ],
    };

    vi.mocked(apiClient.horsesApi.getStatHistory).mockResolvedValue(mockHistory);

    const { result } = renderHook(() => useStatHistory(1, '30d'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockHistory);
    expect(apiClient.horsesApi.getStatHistory).toHaveBeenCalledWith(1, '30d');
  });

  it('should return stat data points', async () => {
    const mockHistory = {
      horseId: 1,
      horseName: 'Thunder',
      timeRange: '7d',
      statData: [
        {
          timestamp: '2025-12-01T00:00:00Z',
          speed: 65,
          stamina: 70,
          agility: 55,
          strength: 60,
          intelligence: 50,
          temperament: 75,
        },
      ],
    };

    vi.mocked(apiClient.horsesApi.getStatHistory).mockResolvedValue(mockHistory);

    const { result } = renderHook(() => useStatHistory(1, '7d'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.statData).toHaveLength(1);
    expect(result.current.data?.statData[0].speed).toBe(65);
    expect(result.current.data?.statData[0].timestamp).toBe('2025-12-01T00:00:00Z');
  });

  it('should support different time ranges', async () => {
    const mockHistory = {
      horseId: 1,
      horseName: 'Thunder',
      timeRange: '90d',
      statData: [],
    };

    vi.mocked(apiClient.horsesApi.getStatHistory).mockResolvedValue(mockHistory);

    const { result } = renderHook(() => useStatHistory(1, '90d'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.horsesApi.getStatHistory).toHaveBeenCalledWith(1, '90d');
    expect(result.current.data?.timeRange).toBe('90d');
  });

  it('should default to 30d time range', async () => {
    const mockHistory = {
      horseId: 1,
      horseName: 'Thunder',
      timeRange: '30d',
      statData: [],
    };

    vi.mocked(apiClient.horsesApi.getStatHistory).mockResolvedValue(mockHistory);

    const { result } = renderHook(() => useStatHistory(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.horsesApi.getStatHistory).toHaveBeenCalledWith(1, '30d');
  });

  it('should not fetch when horseId is 0', () => {
    renderHook(() => useStatHistory(0, '30d'), {
      wrapper: createWrapper(),
    });

    expect(apiClient.horsesApi.getStatHistory).not.toHaveBeenCalled();
  });

  it('should handle fetch errors', async () => {
    const mockError = { message: 'Failed to fetch stat history' };
    vi.mocked(apiClient.horsesApi.getStatHistory).mockRejectedValue(mockError);

    const { result } = renderHook(() => useStatHistory(1, '30d'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(mockError);
  });
});

describe('useRecentGains', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch recent gains data', async () => {
    const mockGains = {
      horseId: 1,
      horseName: 'Thunder',
      days: 30,
      gains: [
        {
          stat: 'speed',
          change: 5,
          percentage: 8.3,
          timestamp: '2025-12-01T10:00:00Z',
        },
        {
          stat: 'stamina',
          change: 3,
          percentage: 4.5,
          timestamp: '2025-12-02T14:30:00Z',
        },
      ],
    };

    vi.mocked(apiClient.horsesApi.getRecentGains).mockResolvedValue(mockGains);

    const { result } = renderHook(() => useRecentGains(1, 30), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockGains);
    expect(apiClient.horsesApi.getRecentGains).toHaveBeenCalledWith(1, 30);
  });

  it('should return gain details', async () => {
    const mockGains = {
      horseId: 1,
      horseName: 'Thunder',
      days: 30,
      gains: [
        {
          stat: 'speed',
          change: 5,
          percentage: 8.3,
          timestamp: '2025-12-01T10:00:00Z',
        },
      ],
    };

    vi.mocked(apiClient.horsesApi.getRecentGains).mockResolvedValue(mockGains);

    const { result } = renderHook(() => useRecentGains(1, 30), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.gains).toHaveLength(1);
    expect(result.current.data?.gains[0].stat).toBe('speed');
    expect(result.current.data?.gains[0].change).toBe(5);
    expect(result.current.data?.gains[0].percentage).toBe(8.3);
  });

  it('should support different day ranges', async () => {
    const mockGains = {
      horseId: 1,
      horseName: 'Thunder',
      days: 7,
      gains: [],
    };

    vi.mocked(apiClient.horsesApi.getRecentGains).mockResolvedValue(mockGains);

    const { result } = renderHook(() => useRecentGains(1, 7), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.horsesApi.getRecentGains).toHaveBeenCalledWith(1, 7);
    expect(result.current.data?.days).toBe(7);
  });

  it('should default to 30 days', async () => {
    const mockGains = {
      horseId: 1,
      horseName: 'Thunder',
      days: 30,
      gains: [],
    };

    vi.mocked(apiClient.horsesApi.getRecentGains).mockResolvedValue(mockGains);

    const { result } = renderHook(() => useRecentGains(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.horsesApi.getRecentGains).toHaveBeenCalledWith(1, 30);
  });

  it('should not fetch when horseId is 0', () => {
    renderHook(() => useRecentGains(0, 30), {
      wrapper: createWrapper(),
    });

    expect(apiClient.horsesApi.getRecentGains).not.toHaveBeenCalled();
  });

  it('should handle fetch errors', async () => {
    const mockError = { message: 'Failed to fetch recent gains' };
    vi.mocked(apiClient.horsesApi.getRecentGains).mockRejectedValue(mockError);

    const { result } = renderHook(() => useRecentGains(1, 30), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(mockError);
  });

  it('should handle empty gains', async () => {
    const mockGains = {
      horseId: 1,
      horseName: 'Thunder',
      days: 30,
      gains: [],
    };

    vi.mocked(apiClient.horsesApi.getRecentGains).mockResolvedValue(mockGains);

    const { result } = renderHook(() => useRecentGains(1, 30), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.gains).toHaveLength(0);
  });
});
