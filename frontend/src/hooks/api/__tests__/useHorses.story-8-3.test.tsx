/**
 * useHorses Hook Tests (Story 8.3: Horse Management Live)
 *
 * Tests that horse hooks fetch real data via MSW:
 * - useHorses: returns HorseSummary[] from GET /api/horses
 * - useHorse: returns single HorseSummary from GET /api/horses/:id
 * - useHorse(999): surfaces 404 error
 * - useHorseTrainingHistory: returns training history array from GET /api/horses/:id/training-history
 * - horseQueryKeys: correct query key structure
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useHorses, useHorse, useHorseTrainingHistory, horseQueryKeys } from '../useHorses';

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

// ─── useHorses ────────────────────────────────────────────────────────────────

describe('useHorses', () => {
  it('returns an array of horses from MSW', async () => {
    const { result } = renderHook(() => useHorses(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data).toHaveLength(2);
  });

  it('returns horse with correct id and name', async () => {
    const { result } = renderHook(() => useHorses(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const first = result.current.data?.[0];
    expect(first?.id).toBe(1);
    expect(first?.name).toBe('Storm Runner');
  });

  it('returns horse with correct breed and gender', async () => {
    const { result } = renderHook(() => useHorses(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const first = result.current.data?.[0];
    expect(first?.breed).toBe('Thoroughbred');
    expect(first?.gender).toBe('stallion');
  });

  it('returns horse with full stats object', async () => {
    const { result } = renderHook(() => useHorses(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const first = result.current.data?.[0];
    expect(first?.stats).toBeDefined();
    expect(first?.stats.speed).toBe(75);
    expect(first?.stats.stamina).toBe(70);
  });

  it('returns horse with disciplineScores', async () => {
    const { result } = renderHook(() => useHorses(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const first = result.current.data?.[0];
    expect(first?.disciplineScores).toBeDefined();
    expect(first?.disciplineScores.dressage).toBe(45);
  });
});

// ─── useHorse (single) ────────────────────────────────────────────────────────

describe('useHorse', () => {
  it('returns a single horse with correct id and name', async () => {
    const { result } = renderHook(() => useHorse(1), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe(1);
    expect(result.current.data?.name).toBe('Storm Runner');
  });

  it('returns horse with healthStatus', async () => {
    const { result } = renderHook(() => useHorse(1), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.healthStatus).toBe('Good');
  });

  it('returns horse with full stats', async () => {
    const { result } = renderHook(() => useHorse(1), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.stats.agility).toBe(65);
    expect(result.current.data?.stats.strength).toBe(60);
  });

  it('returns horse with disciplineScores', async () => {
    const { result } = renderHook(() => useHorse(1), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.disciplineScores.show_jumping).toBe(55);
  });

  it('is disabled when horseId is 0 (falsy)', () => {
    const { result } = renderHook(() => useHorse(0), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

// ─── useHorse error (404) ─────────────────────────────────────────────────────

describe('useHorse 404 error', () => {
  it('surfaces an error for horse id 999 (not found)', async () => {
    const { result } = renderHook(() => useHorse(999), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });

  it('does not return data on 404', async () => {
    const { result } = renderHook(() => useHorse(999), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});

// ─── useHorseTrainingHistory ──────────────────────────────────────────────────

describe('useHorseTrainingHistory', () => {
  it('returns training history array for a horse', async () => {
    const { result } = renderHook(() => useHorseTrainingHistory(1), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(Array.isArray(result.current.data)).toBe(true);
  });

  it('returns training entries with discipline field', async () => {
    const { result } = renderHook(() => useHorseTrainingHistory(1), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const entries = result.current.data;
    expect(entries?.[0]?.discipline).toBeDefined();
  });

  it('is disabled when horseId is 0 (falsy)', () => {
    const { result } = renderHook(() => useHorseTrainingHistory(0), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

// ─── horseQueryKeys ────────────────────────────────────────────────────────────

describe('horseQueryKeys', () => {
  it('all key is ["horses"]', () => {
    expect(horseQueryKeys.all).toEqual(['horses']);
  });

  it('detail key includes horseId', () => {
    expect(horseQueryKeys.detail(42)).toEqual(['horses', 42]);
  });

  it('trainingHistory key includes horseId and segment', () => {
    expect(horseQueryKeys.trainingHistory(42)).toEqual(['horses', 42, 'training-history']);
  });
});
