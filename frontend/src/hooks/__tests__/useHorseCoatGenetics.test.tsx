/**
 * Unit Tests: Horse Coat-Color Genetics Hooks (Epic 31E-4, Equoria-1wed)
 *
 * Tests React Query hooks for coat-color genetics:
 * - useHorseCoatGenetics
 * - useHorseCoatColor
 *
 * Network boundary is stubbed with MSW (per-test `server.use(...)` overrides)
 * rather than vi.mock'ing the api-client module (Equoria-f12xy). This exercises
 * the REAL api-client fetch + `{ data }` unwrap path and the hooks' own
 * pure-logic surface (enabled-guard, null-data branch, error branch, query
 * key) against a stubbed fetch — the doctrine-compliant replacement for the
 * grandfathered api-client vi.mock.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useHorseCoatGenetics, useHorseCoatColor } from '../useHorseCoatGenetics';
import { server } from '../../test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
  });

  describe('useHorseCoatGenetics', () => {
    it('loading → success branch returns genotype + phenotype', async () => {
      const payload = {
        horseId: 1,
        horseName: 'Test',
        colorGenotype: { E_Extension: 'e/e', A_Agouti: 'a/a' },
        phenotype: { colorName: 'Chestnut' },
      };
      server.use(
        http.get(`${base}/api/v1/horses/1/genetics`, () => HttpResponse.json({ data: payload }))
      );

      const { result } = renderHook(() => useHorseCoatGenetics(1), { wrapper });

      // Loading state immediately
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(payload);
      // Cache must be addressable under the canonical key.
      expect(queryClient.getQueryData(['horse-coat-genetics', 1])).toEqual(payload);
    });

    it('legacy null-data branch surfaces data === null without throwing', async () => {
      server.use(
        http.get(`${base}/api/v1/horses/99/genetics`, () => HttpResponse.json({ data: null }))
      );

      const { result } = renderHook(() => useHorseCoatGenetics(99), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('error branch surfaces network error', async () => {
      server.use(
        http.get(`${base}/api/v1/horses/2/genetics`, () =>
          HttpResponse.json({ message: 'Network error' }, { status: 500 })
        )
      );

      const { result } = renderHook(() => useHorseCoatGenetics(2), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeTruthy();
    });

    it('skips fetch when horseId is falsy (enabled:false)', async () => {
      // No handler registered — if the hook fetched, MSW would error
      // (onUnhandledRequest: 'error'). Staying idle proves enabled:false.
      const { result } = renderHook(() => useHorseCoatGenetics(null), { wrapper });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.fetchStatus).toBe('idle');
      // Give react-query a tick to (not) fire a request.
      await new Promise((r) => setTimeout(r, 30));
      expect(result.current.fetchStatus).toBe('idle');
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
      server.use(
        http.get(`${base}/api/v1/horses/5/color`, () => HttpResponse.json({ data: payload }))
      );

      const { result } = renderHook(() => useHorseCoatColor(5), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(payload);
      expect(queryClient.getQueryData(['horse-coat-color', 5])).toEqual(payload);
    });

    it('legacy null-data branch surfaces data === null', async () => {
      server.use(
        http.get(`${base}/api/v1/horses/101/color`, () => HttpResponse.json({ data: null }))
      );

      const { result } = renderHook(() => useHorseCoatColor(101), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBeNull();
    });

    it('error branch surfaces network error', async () => {
      server.use(
        http.get(`${base}/api/v1/horses/6/color`, () =>
          HttpResponse.json({ message: 'boom' }, { status: 500 })
        )
      );

      const { result } = renderHook(() => useHorseCoatColor(6), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it('skips fetch when horseId is falsy', async () => {
      const { result } = renderHook(() => useHorseCoatColor(undefined), { wrapper });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.fetchStatus).toBe('idle');
      await new Promise((r) => setTimeout(r, 30));
      expect(result.current.fetchStatus).toBe('idle');
    });
  });
});
