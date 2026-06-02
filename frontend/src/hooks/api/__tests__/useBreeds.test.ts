/**
 * useBreeds Hook Tests
 *
 * Tests the breeds fetching hook with MSW handlers.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect } from 'vitest';
import React from 'react';
import { useBreeds } from '../useBreeds';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useBreeds', () => {
  it('starts in loading state', () => {
    const { result } = renderHook(() => useBreeds(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('fetches breeds and enriches with statTendencies', async () => {
    const { result } = renderHook(() => useBreeds(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(result.current.data!.length).toBeGreaterThan(0);

    // All breeds should have statTendencies (enriched from presets)
    result.current.data!.forEach((breed) => {
      expect(breed.statTendencies).toBeDefined();
      expect(breed.statTendencies.speed).toBeDefined();
      expect(breed.statTendencies.speed.avg).toBeGreaterThan(0);
    });
  });

  it('enriches Thoroughbred with breed-specific presets', async () => {
    const { result } = renderHook(() => useBreeds(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const thoroughbred = result.current.data!.find((b) => b.name === 'Thoroughbred');
    expect(thoroughbred).toBeDefined();
    // Thoroughbred preset has speed avg of 88
    expect(thoroughbred!.statTendencies.speed.avg).toBe(88);
    expect(thoroughbred!.loreBlurb).toContain('Born to race');
  });

  it('derives statTendencies from rating_profiles for a non-preset breed (Equoria-x83v4)', async () => {
    const { result } = renderHook(() => useBreeds(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Shire is NOT in BREED_PRESETS — its tendencies must come from the real
    // rating_profiles in the API payload, NOT the uniform DEFAULT (avg 55).
    const shire = result.current.data!.find((b) => b.name === 'Shire');
    expect(shire).toBeDefined();

    // speed ← gaits.gallop.mean (50) → a draft breed reads low on speed, and
    // crucially NOT the DEFAULT 55.
    expect(shire!.statTendencies.speed.avg).toBe(50);
    // agility ← avg(conf.legs 80, conf.hooves 80) = 80 → high, clearly derived.
    expect(shire!.statTendencies.agility.avg).toBe(80);
    // balance ← avg(conf.back 78, conf.topline 76) = 77.
    expect(shire!.statTendencies.balance.avg).toBe(77);
    // min/max use mean ± std_dev: gallop 50 ± 9 → [41, 59].
    expect(shire!.statTendencies.speed.min).toBe(41);
    expect(shire!.statTendencies.speed.max).toBe(59);

    // The derived profile differs across stats — NOT all-equal like DEFAULT.
    const avgs = [
      shire!.statTendencies.speed.avg,
      shire!.statTendencies.agility.avg,
      shire!.statTendencies.balance.avg,
    ];
    expect(new Set(avgs).size).toBeGreaterThan(1);
  });

  it('includes loreBlurb on every breed', async () => {
    const { result } = renderHook(() => useBreeds(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    result.current.data!.forEach((breed) => {
      expect(breed.loreBlurb).toBeDefined();
      expect(breed.loreBlurb.length).toBeGreaterThan(0);
    });
  });
});
