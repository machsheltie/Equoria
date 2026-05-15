/**
 * Unit Tests: Horse Coat-Color Genetics Hooks (Epic 31E-4, Equoria-1wed)
 *
 * Tests React Query hooks for coat-color genetics:
 * - useHorseCoatGenetics
 * - useHorseCoatColor
 *
 * Mocks the `horsesApi` methods only (per project test guidance — avoid
 * vi.mock'ing the full api-client module for new tests; existing pattern OK
 * for parity with neighboring suites).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useHorseCoatGenetics, useHorseCoatColor } from '../useHorseCoatGenetics';
import * as apiClient from '../../lib/api-client';

vi.mock('../../lib/api-client', () => ({
  horsesApi: {
    getGenetics: vi.fn(),
    getColor: vi.fn(),
  },
}));

describe('Horse Coat-Color Genetics Hooks (31E-4 / Equoria-1wed)', () => {
  let queryClient: QueryClient;
  let wrapper: ({ children }: { children: ReactNode }) => JSX.Element;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    vi.clearAllMocks();
  });

  describe('useHorseCoatGenetics', () => {
    it('loading → success branch returns genotype + phenotype', async () => {
      const payload = {
        horseId: 1,
        horseName: 'Test',
        colorGenotype: { E_Extension: 'e/e', A_Agouti: 'a/a' },
        phenotype: { colorName: 'Chestnut' },
      };
      vi.mocked(apiClient.horsesApi.getGenetics).mockResolvedValueOnce(payload);

      const { result } = renderHook(() => useHorseCoatGenetics(1), { wrapper });

      // Loading state immediately
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(payload);
      expect(apiClient.horsesApi.getGenetics).toHaveBeenCalledWith(1);
    });

    it('legacy null-data branch surfaces data === null without throwing', async () => {
      vi.mocked(apiClient.horsesApi.getGenetics).mockResolvedValueOnce(null);

      const { result } = renderHook(() => useHorseCoatGenetics(99), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('error branch surfaces network error', async () => {
      vi.mocked(apiClient.horsesApi.getGenetics).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useHorseCoatGenetics(2), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeTruthy();
    });

    it('skips fetch when horseId is falsy (enabled:false)', () => {
      const { result } = renderHook(() => useHorseCoatGenetics(null), { wrapper });

      expect(result.current.isLoading).toBe(false);
      expect(apiClient.horsesApi.getGenetics).not.toHaveBeenCalled();
    });
  });

  describe('useHorseCoatColor', () => {
    it('loading → success branch returns color payload', async () => {
      const payload = {
        horseId: 5,
        horseName: 'Bay',
        colorName: 'Bay',
        shade: 'standard',
        faceMarking: 'star',
        legMarkings: null,
        advancedMarkings: null,
        modifiers: null,
      };
      vi.mocked(apiClient.horsesApi.getColor).mockResolvedValueOnce(payload);

      const { result } = renderHook(() => useHorseCoatColor(5), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(payload);
      expect(apiClient.horsesApi.getColor).toHaveBeenCalledWith(5);
    });

    it('legacy null-data branch surfaces data === null', async () => {
      vi.mocked(apiClient.horsesApi.getColor).mockResolvedValueOnce(null);

      const { result } = renderHook(() => useHorseCoatColor(101), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBeNull();
    });

    it('error branch surfaces network error', async () => {
      vi.mocked(apiClient.horsesApi.getColor).mockRejectedValueOnce(new Error('boom'));

      const { result } = renderHook(() => useHorseCoatColor(6), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it('skips fetch when horseId is falsy', () => {
      const { result } = renderHook(() => useHorseCoatColor(undefined), { wrapper });

      expect(result.current.isLoading).toBe(false);
      expect(apiClient.horsesApi.getColor).not.toHaveBeenCalled();
    });
  });
});
