/**
 * A 409 means the player's view is stale (Equoria-6p398.13).
 *
 * The listing was already bought, the rider's assignment already ended, the
 * rider already hired out from under her. Retrying the unchanged request can
 * never succeed, so the only useful response is to refresh the surface that
 * was acting on old data. Before this, each mutation's `onError` (where one
 * existed) only raised copy; the stale query stayed stale.
 *
 * Real hooks, real QueryClient, MSW at the network boundary. A query is "owned"
 * by a mutation when the mutation's own success path invalidates it, so those
 * are the keys a 409 must invalidate too.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider, type QueryKey } from '@tanstack/react-query';
import { useBuyHorse } from '../useMarketplace';
import {
  useAssignRider,
  useDeleteRiderAssignment,
  useDismissRider,
  useHireRider,
  riderKeys,
} from '../useRiders';
import { server } from '../../../test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function setup(keys: QueryKey[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  for (const key of keys) queryClient.setQueryData(key, { seeded: true });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const isStale = (key: QueryKey) => queryClient.getQueryState(key)?.isInvalidated === true;
  return { queryClient, wrapper, isStale };
}

const refusal = (status: number) =>
  HttpResponse.json({ success: false, message: 'raw server text', data: null }, { status });

const LISTINGS = ['marketplace', 'listings', undefined] as const;
const HORSES = ['horses'] as const;

describe('a 409 refreshes the surface that was acting on stale data (Equoria-6p398.13)', () => {
  it('buying a listing that is no longer purchasable invalidates the listings and the horse list', async () => {
    server.use(http.post(`${base}/api/v1/marketplace/buy/42`, () => refusal(409)));
    const { wrapper, isStale } = setup([LISTINGS, HORSES]);
    const { result } = renderHook(() => useBuyHorse(), { wrapper });

    await act(async () => {
      result.current.mutate(42);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(isStale(LISTINGS)).toBe(true);
    expect(isStale(HORSES)).toBe(true);
  });

  it('hiring a rider whose marketplace entry is gone invalidates the marketplace and the roster', async () => {
    server.use(http.post(`${base}/api/v1/riders/marketplace/hire`, () => refusal(409)));
    const { wrapper, isStale } = setup([riderKeys.marketplace(), riderKeys.user('u1')]);
    const { result } = renderHook(() => useHireRider(), { wrapper });

    await act(async () => {
      result.current.mutate('mp-1');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(isStale(riderKeys.marketplace())).toBe(true);
    expect(isStale(riderKeys.user('u1'))).toBe(true);
  });

  it('assigning a rider to a horse that is no longer the player’s invalidates assignments and riders', async () => {
    server.use(http.post(`${base}/api/v1/riders/assignments`, () => refusal(409)));
    const { wrapper, isStale } = setup([riderKeys.assignments(), riderKeys.user('u1')]);
    const { result } = renderHook(() => useAssignRider(), { wrapper });

    await act(async () => {
      result.current.mutate({ riderId: 1, horseId: 2 });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(isStale(riderKeys.assignments())).toBe(true);
    expect(isStale(riderKeys.user('u1'))).toBe(true);
  });

  it('ending an assignment that is no longer current invalidates the assignments', async () => {
    server.use(http.delete(`${base}/api/v1/riders/assignments/9`, () => refusal(409)));
    const { wrapper, isStale } = setup([riderKeys.assignments()]);
    const { result } = renderHook(() => useDeleteRiderAssignment(), { wrapper });

    await act(async () => {
      result.current.mutate(9);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(isStale(riderKeys.assignments())).toBe(true);
  });

  it('dismissing a rider whose state moved on invalidates the roster and assignments', async () => {
    server.use(http.delete(`${base}/api/v1/riders/5/dismiss`, () => refusal(409)));
    const { wrapper, isStale } = setup([riderKeys.assignments(), riderKeys.user('u1')]);
    const { result } = renderHook(() => useDismissRider(), { wrapper });

    await act(async () => {
      result.current.mutate(5);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(isStale(riderKeys.assignments())).toBe(true);
    expect(isStale(riderKeys.user('u1'))).toBe(true);
  });

  it('a server fault is not a stale view: a 500 leaves the cache alone', async () => {
    server.use(http.delete(`${base}/api/v1/riders/assignments/9`, () => refusal(500)));
    const { wrapper, isStale } = setup([riderKeys.assignments()]);
    const { result } = renderHook(() => useDeleteRiderAssignment(), { wrapper });

    await act(async () => {
      result.current.mutate(9);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(isStale(riderKeys.assignments())).toBe(false);
  });
});
