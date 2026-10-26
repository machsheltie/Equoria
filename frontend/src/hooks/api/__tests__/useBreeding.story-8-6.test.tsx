/**
 * useBreeding Hook Tests (Story 8.6: Breeding Live)
 *
 * Tests that breeding hooks fetch real data via MSW:
 * - useBreedFoal: POST /api/horses/foals mutation succeeds
 * - useFoal: returns Foal from GET /api/foals/:id
 * - useFoalDevelopment: returns FoalDevelopment from GET /api/foals/:id/development
 * - useFoalActivities: returns FoalActivity[] from GET /api/foals/:id/activities
 * - breedingQueryKeys: correct query key structure
 *
 * Uses MSW (Mock Service Worker) — no prop overrides or manual mocks.
 * Pattern follows Story 8.4 useGrooms.story-8-4.test.tsx.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useBreedFoal,
  useFoal,
  useFoalDevelopment,
  useFoalActivities,
  breedingQueryKeys,
} from '../useBreeding';

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

// ─── useBreedFoal mutation ────────────────────────────────────────────────────

describe('useBreedFoal', () => {
  it('mutation succeeds and returns a response (AC: 1)', async () => {
    const { result } = renderHook(() => useBreedFoal(), { wrapper: createWrapper() });
    await act(async () => {
      result.current.mutate({ sireId: 1, damId: 2 });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
  });

  it('mutation is in idle state before firing', () => {
    const { result } = renderHook(() => useBreedFoal(), { wrapper: createWrapper() });
    expect(result.current.isIdle).toBe(true);
  });
});

// ─── useFoal ─────────────────────────────────────────────────────────────────

describe('useFoal', () => {
  it('returns Foal with id from MSW (AC: 2)', async () => {
    const { result } = renderHook(() => useFoal(10), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
    expect(result.current.data?.id).toBe(10);
  });

  it('is disabled when foalId is 0 (falsy)', () => {
    const { result } = renderHook(() => useFoal(0), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

// ─── useFoalDevelopment ───────────────────────────────────────────────────────

describe('useFoalDevelopment', () => {
  it('returns a FLAT FoalDevelopment from the nested MSW envelope (AC: 3; Equoria-n3yw6)', async () => {
    const { result } = renderHook(() => useFoalDevelopment(10), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
    // End-to-end: MSW returns { data: { development: { currentDay,... } } };
    // the api-client normalizer must flatten it so the real fields are at the
    // top level (not nested under data.development). currentDay 1 / maxDay 6.
    expect(result.current.data?.currentDay).toBe(1);
    expect(result.current.data?.maxDay).toBe(6);
    expect(result.current.data?.bondingLevel).toBe(50);
  });

  it('is disabled when foalId is 0 (falsy)', () => {
    const { result } = renderHook(() => useFoalDevelopment(0), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

// ─── useFoalActivities ────────────────────────────────────────────────────────

describe('useFoalActivities', () => {
  it('returns FoalActivity array from MSW (AC: 4)', async () => {
    const { result } = renderHook(() => useFoalActivities(10), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(Array.isArray(result.current.data)).toBe(true);
  });

  it('is disabled when foalId is 0 (falsy)', () => {
    const { result } = renderHook(() => useFoalActivities(0), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

// useEnrichFoal was removed (Equoria-fr2kg). OLD CONTRACT: the hook POSTed
// the player's chosen activity to /enrich. NEW RULING (owner, 2026-10-14/15):
// foal enrichment is the groom's job, so no player enrichment hook exists.

// useRevealFoalTraits was removed (Equoria-gu8jk). OLD CONTRACT: the hook
// POSTed /foals/:id/reveal-traits to reveal hidden traits on demand. NEW RULING
// (owner, 2026-10-20): players never reveal traits, so no reveal hook exists.

// ─── breedingQueryKeys ────────────────────────────────────────────────────────

describe('breedingQueryKeys', () => {
  it('root key is ["breeding"]', () => {
    expect(breedingQueryKeys.root).toEqual(['breeding']);
  });

  it('foal key includes foalId', () => {
    expect(breedingQueryKeys.foal(10)).toEqual(['foals', 10]);
  });

  it('development key includes foalId and segment', () => {
    expect(breedingQueryKeys.development(10)).toEqual(['foals', 10, 'development']);
  });
});
