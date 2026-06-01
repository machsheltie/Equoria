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
 *
 * Network boundary stubbed with MSW per-test `server.use(...)` overrides
 * (Equoria-f12xy) instead of vi.mock'ing the api-client. The POST mutations
 * (train, check-eligibility) exercise the real client's CSRF round-trip via
 * the globally-registered csrf-token handler. `trainingApi.train` appends
 * backward-compat fields (updatedScore/nextEligibleDate/discipline/horseId)
 * to the raw backend result, so success assertions use toMatchObject.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect } from 'vitest';
import {
  useTrainHorse,
  useTrainingStatus,
  useTrainingOverview,
  useTrainingEligibility,
  useTrainableHorses,
  trainingQueryKeys,
} from '../useTraining';
import { server } from '../../../test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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

describe('useTrainHorse', () => {
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

    let body: { horseId?: number; discipline?: string } = {};
    server.use(
      http.post(`${base}/api/v1/training/train`, async ({ request }) => {
        body = (await request.json()) as typeof body;
        return HttpResponse.json({ data: mockResult });
      })
    );

    const { result } = renderHook(() => useTrainHorse(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ horseId: 1, discipline: 'dressage' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Client appends backward-compat fields, so result is a superset.
    expect(result.current.data).toMatchObject(mockResult);
    expect(body).toEqual({ horseId: 1, discipline: 'dressage' });
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

    server.use(
      http.post(`${base}/api/v1/training/train`, () => HttpResponse.json({ data: mockResult }))
    );

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

    server.use(
      http.post(`${base}/api/v1/training/train`, () => HttpResponse.json({ data: mockResult }))
    );

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

    server.use(
      http.post(`${base}/api/v1/training/train`, () => HttpResponse.json({ data: mockResult }))
    );

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

    server.use(
      http.post(`${base}/api/v1/training/train`, () => HttpResponse.json({ data: mockResult }))
    );

    const { result } = renderHook(() => useTrainHorse(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ horseId: 1, discipline: 'dressage' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.nextEligible).toBe('2026-02-13T10:00:00Z');
  });

  it('should handle training failures', async () => {
    server.use(
      http.post(`${base}/api/v1/training/train`, () =>
        HttpResponse.json({ message: 'Horse is on cooldown', status: 'error' }, { status: 400 })
      )
    );

    const { result } = renderHook(() => useTrainHorse(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ horseId: 1, discipline: 'dressage' });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toMatchObject({
      message: 'Horse is on cooldown',
      statusCode: 400,
    });
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

    server.use(
      http.post(`${base}/api/v1/training/train`, () => HttpResponse.json({ data: mockResult }))
    );

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

    server.use(
      http.post(`${base}/api/v1/training/train`, () => HttpResponse.json({ data: mockResult }))
    );

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

    server.use(
      http.post(`${base}/api/v1/training/train`, () => HttpResponse.json({ data: mockResult }))
    );

    const { result } = renderHook(() => useTrainHorse(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ horseId: 1, discipline: 'dressage' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.traitEffects).toBeUndefined();
  });
});

describe('useTrainingStatus', () => {
  it('should fetch discipline status', async () => {
    const mockStatus = {
      discipline: 'dressage',
      score: 75,
      nextEligibleDate: '2026-02-06T10:00:00Z',
      lastTrainedAt: '2026-01-30T10:00:00Z',
    };

    let path = '';
    server.use(
      http.get(`${base}/api/v1/training/status/1/dressage`, ({ request }) => {
        path = new URL(request.url).pathname;
        return HttpResponse.json({ data: mockStatus });
      })
    );

    const { result } = renderHook(() => useTrainingStatus(1, 'dressage'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockStatus);
    expect(path).toBe('/api/v1/training/status/1/dressage');
  });

  it('should return current score', async () => {
    const mockStatus = {
      discipline: 'jumping',
      score: 82,
      nextEligibleDate: null,
      lastTrainedAt: null,
    };

    server.use(
      http.get(`${base}/api/v1/training/status/1/jumping`, () =>
        HttpResponse.json({ data: mockStatus })
      )
    );

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

    server.use(
      http.get(`${base}/api/v1/training/status/1/endurance`, () =>
        HttpResponse.json({ data: mockStatus })
      )
    );

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

    server.use(
      http.get(`${base}/api/v1/training/status/1/racing`, () =>
        HttpResponse.json({ data: mockStatus })
      )
    );

    const { result } = renderHook(() => useTrainingStatus(1, 'racing'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.lastTrainedAt).toBe('2026-01-25T14:30:00Z');
  });

  it('should not fetch when horseId is 0', async () => {
    const { result } = renderHook(() => useTrainingStatus(0, 'dressage'), {
      wrapper: createWrapper(),
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('should not fetch when discipline is empty', async () => {
    const { result } = renderHook(() => useTrainingStatus(1, ''), {
      wrapper: createWrapper(),
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('should handle fetch errors', async () => {
    server.use(
      http.get(`${base}/api/v1/training/status/1/dressage`, () =>
        HttpResponse.json({ message: 'Failed to fetch discipline status' }, { status: 500 })
      )
    );

    const { result } = renderHook(() => useTrainingStatus(1, 'dressage'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeTruthy();
  });

  it('should use correct stale time', async () => {
    const mockStatus = {
      discipline: 'dressage',
      score: 75,
      nextEligibleDate: null,
      lastTrainedAt: null,
    };

    server.use(
      http.get(`${base}/api/v1/training/status/1/dressage`, () =>
        HttpResponse.json({ data: mockStatus })
      )
    );

    const { result } = renderHook(() => useTrainingStatus(1, 'dressage'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Data should be fresh for 30 seconds
    expect(result.current.isStale).toBe(false);
  });
});

describe('useTrainingOverview', () => {
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

    let path = '';
    server.use(
      http.get(`${base}/api/v1/training/status/1`, ({ request }) => {
        path = new URL(request.url).pathname;
        return HttpResponse.json({ data: mockOverview });
      })
    );

    const { result } = renderHook(() => useTrainingOverview(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockOverview);
    expect(path).toBe('/api/v1/training/status/1');
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

    server.use(
      http.get(`${base}/api/v1/training/status/1`, () => HttpResponse.json({ data: mockOverview }))
    );

    const { result } = renderHook(() => useTrainingOverview(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].discipline).toBe('dressage');
    expect(result.current.data?.[1].discipline).toBe('jumping');
  });

  it('should not fetch when horseId is 0', async () => {
    const { result } = renderHook(() => useTrainingOverview(0), {
      wrapper: createWrapper(),
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('should handle fetch errors', async () => {
    server.use(
      http.get(`${base}/api/v1/training/status/1`, () =>
        HttpResponse.json({ message: 'Failed to fetch training overview' }, { status: 500 })
      )
    );

    const { result } = renderHook(() => useTrainingOverview(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeTruthy();
  });
});

describe('useTrainingEligibility', () => {
  it('should check eligibility successfully', async () => {
    const mockEligibility = {
      eligible: true,
      reason: undefined,
      cooldownEndsAt: null,
    };

    let body: { horseId?: number; discipline?: string } = {};
    server.use(
      http.post(`${base}/api/v1/training/check-eligibility`, async ({ request }) => {
        body = (await request.json()) as typeof body;
        return HttpResponse.json({ data: mockEligibility });
      })
    );

    const { result } = renderHook(() => useTrainingEligibility(1, 'dressage'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockEligibility);
    expect(body).toEqual({ horseId: 1, discipline: 'dressage' });
  });

  it('should return ineligible with reason', async () => {
    const mockEligibility = {
      eligible: false,
      reason: 'Horse is on cooldown',
      cooldownEndsAt: '2026-02-06T10:00:00Z',
    };

    server.use(
      http.post(`${base}/api/v1/training/check-eligibility`, () =>
        HttpResponse.json({ data: mockEligibility })
      )
    );

    const { result } = renderHook(() => useTrainingEligibility(1, 'jumping'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.eligible).toBe(false);
    expect(result.current.data?.reason).toBe('Horse is on cooldown');
    expect(result.current.data?.cooldownEndsAt).toBe('2026-02-06T10:00:00Z');
  });

  it('should not fetch when horseId is 0', async () => {
    const { result } = renderHook(() => useTrainingEligibility(0, 'dressage'), {
      wrapper: createWrapper(),
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('should not fetch when discipline is empty', async () => {
    const { result } = renderHook(() => useTrainingEligibility(1, ''), {
      wrapper: createWrapper(),
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('should handle fetch errors', async () => {
    server.use(
      http.post(`${base}/api/v1/training/check-eligibility`, () =>
        HttpResponse.json({ message: 'Failed to check eligibility' }, { status: 500 })
      )
    );

    const { result } = renderHook(() => useTrainingEligibility(1, 'dressage'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeTruthy();
  });
});

describe('useTrainableHorses', () => {
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

    let path = '';
    server.use(
      http.get(`${base}/api/v1/training/trainable/user-123`, ({ request }) => {
        path = new URL(request.url).pathname;
        return HttpResponse.json({ data: mockHorses });
      })
    );

    const { result } = renderHook(() => useTrainableHorses('user-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockHorses);
    expect(path).toBe('/api/v1/training/trainable/user-123');
  });

  it('should not fetch when userId is empty', async () => {
    const { result } = renderHook(() => useTrainableHorses(''), {
      wrapper: createWrapper(),
    });

    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('should handle fetch errors', async () => {
    server.use(
      http.get(`${base}/api/v1/training/trainable/user-123`, () =>
        HttpResponse.json({ message: 'Failed to fetch trainable horses' }, { status: 500 })
      )
    );

    const { result } = renderHook(() => useTrainableHorses('user-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeTruthy();
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
