/**
 * useCompetitions Hook Tests (Story 8.5: Training & Competition Live)
 *
 * Tests that competition hooks fetch real data via MSW:
 * - useCompetitions: returns Competition[] from GET /api/competition
 * - useEnterCompetition: POST /api/competition/enter mutation succeeds
 * - competitionKeys: correct query key structure
 *
 * Uses MSW (Mock Service Worker) — no prop overrides or manual mocks.
 * Pattern follows Story 8.4 useGrooms.story-8-4.test.tsx.
 *
 * NOTE: competitionsApi calls /api/competition (singular), NOT /api/competitions (plural).
 * MSW handlers at /api/competitions serve other components and are separate.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCompetitions, useEnterCompetition, competitionKeys } from '../useCompetitions';

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

// ─── useCompetitions ──────────────────────────────────────────────────────────

describe('useCompetitions', () => {
  it('returns a Competition array from MSW (AC: 5)', async () => {
    const { result } = renderHook(() => useCompetitions(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data).toHaveLength(3);
  });

  it('returns Competition with correct id and name (AC: 5)', async () => {
    const { result } = renderHook(() => useCompetitions(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const first = result.current.data?.[0];
    expect(first?.id).toBe(1);
    expect(first?.name).toBe('Spring Dressage Championship');
    expect(first?.discipline).toBe('dressage');
  });

  it('returns Competition with financial fields (AC: 5)', async () => {
    const { result } = renderHook(() => useCompetitions(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const first = result.current.data?.[0];
    expect(first?.entryFee).toBe(50);
    expect(first?.prizePool).toBe(5000);
    expect(first?.status).toBe('open');
  });
});

// ─── useEnterCompetition mutation ─────────────────────────────────────────────

describe('useEnterCompetition', () => {
  it('mutation succeeds and returns entryId (AC: 6)', async () => {
    const { result } = renderHook(() => useEnterCompetition(), { wrapper: createWrapper() });
    await act(async () => {
      result.current.mutate({ horseId: 1, competitionId: 1 });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
  });

  it('mutation is in idle state before firing', () => {
    const { result } = renderHook(() => useEnterCompetition(), { wrapper: createWrapper() });
    expect(result.current.isIdle).toBe(true);
  });
});

// ─── competitionKeys ──────────────────────────────────────────────────────────

describe('competitionKeys', () => {
  it('all key is ["competitions"]', () => {
    expect(competitionKeys.all).toEqual(['competitions']);
  });

  it('list key extends all', () => {
    expect(competitionKeys.list()).toEqual(['competitions', 'list']);
  });
});
