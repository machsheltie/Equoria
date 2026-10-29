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

  // Owner ruling 2026-10-29 (q292, Equoria-9kakx): the breed picker shows no
  // breed stat bars. Old contract (Equoria-x83v4): every breed carried
  // statTendencies derived from ratingProfiles or a hand-authored preset.
  it('fetches breeds with id, name, description and lore, and no stat tendencies', async () => {
    const { result } = renderHook(() => useBreeds(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(result.current.data!.length).toBeGreaterThan(0);

    result.current.data!.forEach((breed) => {
      expect(Object.keys(breed).sort()).toEqual(['description', 'id', 'loreBlurb', 'name']);
    });
  });

  it('gives Thoroughbred its authored lore', async () => {
    const { result } = renderHook(() => useBreeds(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const thoroughbred = result.current.data!.find((b) => b.name === 'Thoroughbred');
    expect(thoroughbred).toBeDefined();
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
