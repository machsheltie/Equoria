/**
 * useBreedingPrediction Hook Tests (Story 8.6: Breeding Live)
 *
 * Tests that breeding prediction hooks fetch real data via MSW:
 * - useHorseBreedingData: returns data from GET /api/horses/:id/breeding-data
 * - useInbreedingAnalysis: returns result from POST /api/genetics/inbreeding-analysis
 * - useLineageAnalysis: returns data from GET /api/breeding/lineage-analysis/:s/:m
 * - useGeneticProbability: returns data from POST /api/breeding/genetic-probability
 * - useBreedingCompatibility: returns compatibility from POST /api/genetics/breeding-compatibility
 *
 * Uses MSW (Mock Service Worker) — no prop overrides or manual mocks.
 * Pattern follows Story 8.4 useGrooms.story-8-4.test.tsx.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useHorseBreedingData,
  useInbreedingAnalysis,
  useLineageAnalysis,
  useGeneticProbability,
  useBreedingCompatibility,
} from '../useBreedingPrediction';

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

// ─── useHorseBreedingData ─────────────────────────────────────────────────────

describe('useHorseBreedingData', () => {
  it('returns breeding data for a horseId (AC: 7)', async () => {
    const { result } = renderHook(() => useHorseBreedingData(1), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
  });

  it('is disabled when horseId is 0 (falsy)', () => {
    const { result } = renderHook(() => useHorseBreedingData(0), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

// ─── useInbreedingAnalysis ────────────────────────────────────────────────────

describe('useInbreedingAnalysis', () => {
  it('returns inbreeding analysis for a stallion+mare pair (AC: 7)', async () => {
    const { result } = renderHook(() => useInbreedingAnalysis(1, 2), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
  });

  it('is disabled when either id is 0 (falsy)', () => {
    const { result } = renderHook(() => useInbreedingAnalysis(0, 2), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

// ─── useLineageAnalysis ───────────────────────────────────────────────────────

describe('useLineageAnalysis', () => {
  it('returns lineage analysis for a stallion+mare pair (AC: 7)', async () => {
    const { result } = renderHook(() => useLineageAnalysis(1, 2), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
  });

  it('is disabled when either id is 0 (falsy)', () => {
    const { result } = renderHook(() => useLineageAnalysis(0, 2), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

// ─── useGeneticProbability ────────────────────────────────────────────────────

describe('useGeneticProbability', () => {
  it('returns genetic probability for a stallion+mare pair (AC: 7)', async () => {
    const { result } = renderHook(() => useGeneticProbability(1, 2), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
  });

  it('is disabled when either id is 0 (falsy)', () => {
    const { result } = renderHook(() => useGeneticProbability(0, 2), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

// ─── useBreedingCompatibility ─────────────────────────────────────────────────

describe('useBreedingCompatibility', () => {
  it('returns compatibility score for a stallion+mare pair (AC: 7)', async () => {
    const { result } = renderHook(() => useBreedingCompatibility(1, 2), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
  });

  it('is disabled when either id is 0 (falsy)', () => {
    const { result } = renderHook(() => useBreedingCompatibility(0, 2), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe('idle');
  });
});
