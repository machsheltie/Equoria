/**
 * useBreeds Hook Tests
 *
 * Tests the breeds fetching hook with MSW handlers.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, beforeEach } from 'vitest';
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

  it('includes loreBlurb on every breed', async () => {
    const { result } = renderHook(() => useBreeds(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    result.current.data!.forEach((breed) => {
      expect(breed.loreBlurb).toBeDefined();
      expect(breed.loreBlurb.length).toBeGreaterThan(0);
    });
  });
});
