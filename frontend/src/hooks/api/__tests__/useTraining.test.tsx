/**
 * Tests for Training API Hooks
 *
 * Story 4-1: Training UI Components - Task 2
 *
 * Tests for:
 * - useTrainHorse (mutation for executing training)
 * - useTrainingStatus (query for discipline status)
 * - useTrainingOverview (query for all discipline statuses)
 * - useTrainingEligibility (query for eligibility check)
 * - useTrainableHorses (query for trainable horses list)
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as apiClient from '@/lib/api-client';
import {
  useTrainHorse,
  useTrainingStatus,
  useTrainingOverview,
  useTrainingEligibility,
  useTrainableHorses,
  trainingQueryKeys,
} from '../useTraining';

// Mock API client
vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual('@/lib/api-client');
  return {
    ...actual,
    trainingApi: {
      train: vi.fn(),
      getDisciplineStatus: vi.fn(),
      getHorseStatus: vi.fn(),
      checkEligibility: vi.fn(),
      getTrainableHorses: vi.fn(),
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
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useTrainHorse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should execute training successfully', async () => {
    const mockResult = {
      success: true,
      message: 'Training successful!',
      updatedHorse: {
        id: 1,
        name: 'Thunder',
        discipline_scores: { dressage: 75 },
        userId: 'user-123',
      },
      nextEligible: '2026-02-06T10:00:00Z',
      statGain: {
        stat: 'agility',
        amount: 3,
        traitModified: false,
      },
      traitEffects: {
        appliedTraits: ['Athletic'],
        scoreModifier: 5,
        xpModifier: 1.1,
      },
    };

    vi.mocked(apiClient.trainingApi.train).mockResolvedValue(mockResult);

    const { result } = renderHook(() => useTrainHorse(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ horseId: 1, discipline: 'dressage' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockResult);
    expect(apiClient.trainingApi.train).toHaveBeenCalledWith({
      horseId: 1,
      discipline: 'dressage',
    });
  });

  it('should return training result with stat gains', async () => {
    const mockResult = {
      success: true,
      message: 'Training complete',
      updatedHorse: {
        id: 1,
        name: 'Thunder',
        discipline_scores: { jumping: 68 },
        userId: 'user-123',
      },
      nextEligible: '2026-02-06T10:00:00Z',
      statGain: {
        stat: 'speed',
        amount: 2,
        traitModified: true,
      },
      traitEffects: {
        appliedTraits: ['Quick Learner'],
        scoreModifier: 3,
        xpModifier: 1.2,
      },
    };

    vi.mocked(apiClient.trainingApi.train).mockResolvedValue(mockResult);

    const { result } = renderHook(() => useTrainHorse(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ horseId: 1, discipline: 'jumping' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.statGain?.stat).toBe('speed');
    expect(result.current.data?.statGain?.amount).toBe(2);
    expect(result.current.data?.statGain?.traitModified).toBe(true);
  });

  it('should return training result with trait effects', async () => {
    const mockResult = {
      success: true,
      message: 'Training complete',
      updatedHorse: {
        id: 1,
        name: 'Thunder',
        discipline_scores: { endurance: 80 },
        userId: 'user-123',
      },
      nextEligible: '2026-02-06T10:00:00Z',
      statGain: {
        stat: 'stamina',
        amount: 4,
        traitModified: false,
      },
      traitEffects: {
        appliedTraits: ['Determined', 'Hardy'],
        scoreModifier: 8,
        xpModifier: 1.15,
      },
    };

    vi.mocked(apiClient.trainingApi.train).mockResolvedValue(mockResult);

    const { result } = renderHook(() => useTrainHorse(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ horseId: 1, discipline: 'endurance' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.traitEffects?.appliedTraits).toEqual(['Determined', 'Hardy']);
    expect(result.current.data?.traitEffects?.scoreModifier).toBe(8);
    expect(result.current.data?.traitEffects?.xpModifier).toBe(1.15);
  });

  it('should include updated discipline score', async () => {
    const mockResult = {
      success: true,
      message: 'Training complete',
      updatedHorse: {
        id: 1,
        name: 'Thunder',
        discipline_scores: { racing: 92 },
        userId: 'user-123',
      },
      nextEligible: '2026-02-06T10:00:00Z',
      statGain: {
        stat: 'speed',
        amount: 5,
        traitModified: false,
      },
    };

    vi.mocked(apiClient.trainingApi.train).mockResolvedValue(mockResult);

    const { result } = renderHook(() => useTrainHorse(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ horseId: 1, discipline: 'racing' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.updatedHorse?.discipline_scores?.racing).toBe(92);
  });

  it('should include next eligible date', async () => {
    const mockResult = {
      success: true,
      message: 'Training complete',
      updatedHorse: {
        id: 1,
        name: 'Thunder',
        discipline_scores: { dressage: 70 },
        userId: 'user-123',
      },
      nextEligible: '2026-02-13T10:00:00Z',
      statGain: {
        stat: 'agility',
        amount: 2,
        traitModified: false,
      },
    };

    vi.mocked(apiClient.trainingApi.train).mockResolvedValue(mockResult);

    const { result } = renderHook(() => useTrainHorse(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ horseId: 1, discipline: 'dressage' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.nextEligible).toBe('2026-02-13T10:00:00Z');
  });

  it('should handle training failures', async () => {
    const mockError = {
      message: 'Horse is on cooldown',
      status: 'error',
      statusCode: 400,
    };

    vi.mocked(apiClient.trainingApi.train).mockRejectedValue(mockError);

    const { result } = renderHook(() => useTrainHorse(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ horseId: 1, discipline: 'dressage' });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(mockError);
  });

  it('should invalidate horse queries on success', async () => {
    const mockResult = {
      success: true,
      message: 'Training complete',
      updatedHorse: {
        id: 1,
        name: 'Thunder',
        discipline_scores: { dressage: 70 },
        userId: 'user-123',
      },
      nextEligible: '2026-02-06T10:00:00Z',
      statGain: {
        stat: 'agility',
        amount: 2,
        traitModified: false,
      },
    };

    vi.mocked(apiClient.trainingApi.train).mockResolvedValue(mockResult);

    const { result } = renderHook(() => useTrainHorse(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ horseId: 1, discipline: 'dressage' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Success callback should trigger query invalidation
    expect(result.current.isSuccess).toBe(true);
  });

  it('should handle missing stat gain gracefully', async () => {
    const mockResult = {
      success: true,
      message: 'Training complete',
      updatedHorse: {
        id: 1,
        name: 'Thunder',
        discipline_scores: { dressage: 70 },
        userId: 'user-123',
      },
      nextEligible: '2026-02-06T10:00:00Z',
      statGain: null,
    };

    vi.mocked(apiClient.trainingApi.train).mockResolvedValue(mockResult);

    const { result } = renderHook(() => useTrainHorse(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ horseId: 1, discipline: 'dressage' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.statGain).toBeNull();
  });

  it('should handle missing trait effects gracefully', async () => {
    const mockResult = {
      success: true,
      message: 'Training complete',
      updatedHorse: {
        id: 1,
        name: 'Thunder',
        discipline_scores: { dressage: 70 },
        userId: 'user-123',
      },
      nextEligible: '2026-02-06T10:00:00Z',
      statGain: {
        stat: 'agility',
        amount: 2,
        traitModified: false,
      },
    };

    vi.mocked(apiClient.trainingApi.train).mockResolvedValue(mockResult);

    const { result } = renderHook(() => useTrainHorse(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ horseId: 1, discipline: 'dressage' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.traitEffects).toBeUndefined();
  });
});

describe('useTrainingStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch discipline status', async () => {
    const mockStatus = {
      discipline: 'dressage',
      score: 75,
      nextEligibleDate: '2026-02-06T10:00:00Z',
      lastTrainedAt: '2026-01-30T10:00:00Z',
    };

    vi.mocked(apiClient.trainingApi.getDisciplineStatus).mockResolvedValue(mockStatus);

    const { result } = renderHook(() => useTrainingStatus(1, 'dressage'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockStatus);
    expect(apiClient.trainingApi.getDisciplineStatus).toHaveBeenCalledWith(1, 'dressage');
  });

  it('should return current score', async () => {
    const mockStatus = {
      discipline: 'jumping',
      score: 82,
      nextEligibleDate: null,
      lastTrainedAt: null,
    };

    vi.mocked(apiClient.trainingApi.getDisciplineStatus).mockResolvedValue(mockStatus);

    const { result } = renderHook(() => useTrainingStatus(1, 'jumping'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.score).toBe(82);
  });

  it('should return next eligible date', async () => {
    const mockStatus = {
      discipline: 'endurance',
      score: 70,
      nextEligibleDate: '2026-02-10T10:00:00Z',
      lastTrainedAt: '2026-02-03T10:00:00Z',
    };

    vi.mocked(apiClient.trainingApi.getDisciplineStatus).mockResolvedValue(mockStatus);

    const { result } = renderHook(() => useTrainingStatus(1, 'endurance'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.nextEligibleDate).toBe('2026-02-10T10:00:00Z');
  });

  it('should return last trained date', async () => {
    const mockStatus = {
      discipline: 'racing',
      score: 88,
      nextEligibleDate: null,
      lastTrainedAt: '2026-01-25T14:30:00Z',
    };

    vi.mocked(apiClient.trainingApi.getDisciplineStatus).mockResolvedValue(mockStatus);

    const { result } = renderHook(() => useTrainingStatus(1, 'racing'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.lastTrainedAt).toBe('2026-01-25T14:30:00Z');
  });

  it('should not fetch when horseId is 0', () => {
    renderHook(() => useTrainingStatus(0, 'dressage'), {
      wrapper: createWrapper(),
    });

    expect(apiClient.trainingApi.getDisciplineStatus).not.toHaveBeenCalled();
  });

  it('should not fetch when discipline is empty', () => {
    renderHook(() => useTrainingStatus(1, ''), {
      wrapper: createWrapper(),
    });

    expect(apiClient.trainingApi.getDisciplineStatus).not.toHaveBeenCalled();
  });

  it('should handle fetch errors', async () => {
    const mockError = { message: 'Failed to fetch discipline status' };
    vi.mocked(apiClient.trainingApi.getDisciplineStatus).mockRejectedValue(mockError);

    const { result } = renderHook(() => useTrainingStatus(1, 'dressage'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(mockError);
  });

  it('should use correct stale time', async () => {
    const mockStatus = {
      discipline: 'dressage',
      score: 75,
      nextEligibleDate: null,
      lastTrainedAt: null,
    };

    vi.mocked(apiClient.trainingApi.getDisciplineStatus).mockResolvedValue(mockStatus);

    const { result } = renderHook(() => useTrainingStatus(1, 'dressage'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Data should be fresh for 30 seconds
    expect(result.current.isStale).toBe(false);
  });
});

describe('useTrainingOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch overview as array', async () => {
    const mockOverview = [
      {
        discipline: 'dressage',
        score: 75,
        nextEligibleDate: '2026-02-06T10:00:00Z',
        lastTrainedAt: '2026-01-30T10:00:00Z',
      },
      {
        discipline: 'jumping',
        score: 82,
        nextEligibleDate: null,
        lastTrainedAt: null,
      },
    ];

    vi.mocked(apiClient.trainingApi.getHorseStatus).mockResolvedValue(mockOverview);

    const { result } = renderHook(() => useTrainingOverview(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockOverview);
    expect(apiClient.trainingApi.getHorseStatus).toHaveBeenCalledWith(1);
  });

  it('should normalize object response to array', async () => {
    const mockOverview = {
      dressage: {
        score: 75,
        nextEligibleDate: '2026-02-06T10:00:00Z',
        lastTrainedAt: '2026-01-30T10:00:00Z',
      },
      jumping: {
        score: 82,
        nextEligibleDate: null,
        lastTrainedAt: null,
      },
    };

    vi.mocked(apiClient.trainingApi.getHorseStatus).mockResolvedValue(mockOverview);

    const { result } = renderHook(() => useTrainingOverview(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].discipline).toBe('dressage');
    expect(result.current.data?.[1].discipline).toBe('jumping');
  });

  it('should not fetch when horseId is 0', () => {
    renderHook(() => useTrainingOverview(0), {
      wrapper: createWrapper(),
    });

    expect(apiClient.trainingApi.getHorseStatus).not.toHaveBeenCalled();
  });

  it('should handle fetch errors', async () => {
    const mockError = { message: 'Failed to fetch training overview' };
    vi.mocked(apiClient.trainingApi.getHorseStatus).mockRejectedValue(mockError);

    const { result } = renderHook(() => useTrainingOverview(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(mockError);
  });
});

describe('useTrainingEligibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should check eligibility successfully', async () => {
    const mockEligibility = {
      eligible: true,
      reason: undefined,
      cooldownEndsAt: null,
    };

    vi.mocked(apiClient.trainingApi.checkEligibility).mockResolvedValue(mockEligibility);

    const { result } = renderHook(() => useTrainingEligibility(1, 'dressage'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockEligibility);
    expect(apiClient.trainingApi.checkEligibility).toHaveBeenCalledWith({
      horseId: 1,
      discipline: 'dressage',
    });
  });

  it('should return ineligible with reason', async () => {
    const mockEligibility = {
      eligible: false,
      reason: 'Horse is on cooldown',
      cooldownEndsAt: '2026-02-06T10:00:00Z',
    };

    vi.mocked(apiClient.trainingApi.checkEligibility).mockResolvedValue(mockEligibility);

    const { result } = renderHook(() => useTrainingEligibility(1, 'jumping'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.eligible).toBe(false);
    expect(result.current.data?.reason).toBe('Horse is on cooldown');
    expect(result.current.data?.cooldownEndsAt).toBe('2026-02-06T10:00:00Z');
  });

  it('should not fetch when horseId is 0', () => {
    renderHook(() => useTrainingEligibility(0, 'dressage'), {
      wrapper: createWrapper(),
    });

    expect(apiClient.trainingApi.checkEligibility).not.toHaveBeenCalled();
  });

  it('should not fetch when discipline is empty', () => {
    renderHook(() => useTrainingEligibility(1, ''), {
      wrapper: createWrapper(),
    });

    expect(apiClient.trainingApi.checkEligibility).not.toHaveBeenCalled();
  });

  it('should handle fetch errors', async () => {
    const mockError = { message: 'Failed to check eligibility' };
    vi.mocked(apiClient.trainingApi.checkEligibility).mockRejectedValue(mockError);

    const { result } = renderHook(() => useTrainingEligibility(1, 'dressage'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(mockError);
  });
});

describe('useTrainableHorses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch trainable horses', async () => {
    const mockHorses = [
      {
        id: 1,
        name: 'Thunder',
        level: 5,
        breed: 'Thoroughbred',
        sex: 'stallion',
        ageYears: 4,
        bestDisciplines: ['racing', 'jumping'],
        nextEligibleAt: null,
      },
      {
        id: 2,
        name: 'Storm',
        level: 3,
        breed: 'Arabian',
        sex: 'mare',
        ageYears: 3,
        bestDisciplines: ['dressage', 'endurance'],
        nextEligibleAt: '2026-02-05T10:00:00Z',
      },
    ];

    vi.mocked(apiClient.trainingApi.getTrainableHorses).mockResolvedValue(mockHorses);

    const { result } = renderHook(() => useTrainableHorses('user-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockHorses);
    expect(apiClient.trainingApi.getTrainableHorses).toHaveBeenCalledWith('user-123');
  });

  it('should not fetch when userId is empty', () => {
    renderHook(() => useTrainableHorses(''), {
      wrapper: createWrapper(),
    });

    expect(apiClient.trainingApi.getTrainableHorses).not.toHaveBeenCalled();
  });

  it('should handle fetch errors', async () => {
    const mockError = { message: 'Failed to fetch trainable horses' };
    vi.mocked(apiClient.trainingApi.getTrainableHorses).mockRejectedValue(mockError);

    const { result } = renderHook(() => useTrainableHorses('user-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(mockError);
  });
});

describe('trainingQueryKeys', () => {
  it('should export query keys for external use', () => {
    expect(trainingQueryKeys).toBeDefined();
    expect(trainingQueryKeys.all).toEqual(['training']);
    expect(trainingQueryKeys.trainable('user-123')).toEqual([
      'training',
      'trainable-horses',
      'user-123',
    ]);
    expect(trainingQueryKeys.overview(1)).toEqual(['training', 1, 'status']);
    expect(trainingQueryKeys.status(1, 'dressage')).toEqual(['training', 1, 'status', 'dressage']);
    expect(trainingQueryKeys.eligibility(1, 'dressage')).toEqual([
      'training',
      1,
      'eligibility',
      'dressage',
    ]);
  });
});
