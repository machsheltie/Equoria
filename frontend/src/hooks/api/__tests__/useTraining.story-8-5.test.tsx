/**
 * useTraining Hook Tests (Story 8.5: Training & Competition Live)
 *
 * Tests that training hooks fetch real data via MSW:
 * - useTrainableHorses: returns TrainableHorse[] from GET /api/training/trainable/:userId
 * - useTrainingOverview: returns DisciplineStatus[] from GET /api/training/status/:horseId
 * - useTrainingStatus: returns DisciplineStatus from GET /api/training/status/:horseId/:discipline
 * - useTrainingEligibility: returns TrainingEligibility from POST /api/training/check-eligibility
 * - useTrainHorse: POST /api/training/train mutation succeeds
 * - trainingQueryKeys: correct query key structure
 *
 * Uses MSW (Mock Service Worker) — no prop overrides or manual mocks.
 * Pattern follows Story 8.4 useGrooms.story-8-4.test.tsx.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useTrainableHorses,
  useTrainingOverview,
  useTrainingStatus,
  useTrainingEligibility,
  useTrainHorse,
  trainingQueryKeys,
} from '../useTraining';

// ─── Test wrapper ─────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// ─── useTrainableHorses ───────────────────────────────────────────────────────

describe('useTrainableHorses', () => {
  it('returns a TrainableHorse array from MSW (AC: 3)', async () => {
    const { result } = renderHook(() => useTrainableHorses('user-1'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data!.length).toBeGreaterThanOrEqual(1);
  });

  it('returns trainable horse with correct id and name (AC: 3)', async () => {
    const { result } = renderHook(() => useTrainableHorses('user-1'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const first = result.current.data?.[0];
    expect(first?.id).toBeDefined();
    expect(first?.name).toBeDefined();
    expect(typeof first?.name).toBe('string');
  });

  it('is disabled when userId is empty string (falsy)', () => {
    const { result } = renderHook(() => useTrainableHorses(''), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

// ─── useTrainingOverview ──────────────────────────────────────────────────────

describe('useTrainingOverview', () => {
  it('returns an array of DisciplineStatus for a horse (AC: 4)', async () => {
    const { result } = renderHook(() => useTrainingOverview(1), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data!.length).toBeGreaterThanOrEqual(1);
  });

  it('returns DisciplineStatus entries with discipline field (AC: 4)', async () => {
    const { result } = renderHook(() => useTrainingOverview(1), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const first = result.current.data?.[0];
    expect(first?.discipline).toBeDefined();
    expect(typeof first?.discipline).toBe('string');
  });
});

// ─── useTrainingStatus ────────────────────────────────────────────────────────

describe('useTrainingStatus', () => {
  it('returns DisciplineStatus for horseId + discipline (AC: 4)', async () => {
    const { result } = renderHook(() => useTrainingStatus(1, 'dressage'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
    expect(result.current.data?.discipline).toBe('dressage');
  });

  it('is disabled when horseId is 0 (falsy)', () => {
    const { result } = renderHook(() => useTrainingStatus(0, 'dressage'), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

// ─── useTrainingEligibility ───────────────────────────────────────────────────

describe('useTrainingEligibility', () => {
  it('returns eligibility with eligible boolean (AC: 2)', async () => {
    const { result } = renderHook(() => useTrainingEligibility(1, 'dressage'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
    expect(typeof result.current.data?.eligible).toBe('boolean');
  });

  it('is disabled when horseId is 0', () => {
    const { result } = renderHook(() => useTrainingEligibility(0, 'dressage'), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

// ─── useTrainHorse mutation ───────────────────────────────────────────────────

describe('useTrainHorse', () => {
  it('mutation succeeds and returns training result (AC: 1)', async () => {
    const { result } = renderHook(() => useTrainHorse(), { wrapper: createWrapper() });
    await act(async () => {
      result.current.mutate({ horseId: 1, discipline: 'dressage' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
  });

  it('mutation is in idle state before firing', () => {
    const { result } = renderHook(() => useTrainHorse(), { wrapper: createWrapper() });
    expect(result.current.isIdle).toBe(true);
  });
});

// ─── trainingQueryKeys ────────────────────────────────────────────────────────

describe('trainingQueryKeys', () => {
  it('all key is ["training"]', () => {
    expect(trainingQueryKeys.all).toEqual(['training']);
  });

  it('trainable key includes userId', () => {
    expect(trainingQueryKeys.trainable('user-42')).toEqual([
      'training',
      'trainable-horses',
      'user-42',
    ]);
  });

  it('overview key includes horseId', () => {
    expect(trainingQueryKeys.overview(7)).toEqual(['training', 7, 'status']);
  });
});
