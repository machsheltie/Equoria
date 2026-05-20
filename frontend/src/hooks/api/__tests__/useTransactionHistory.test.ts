/**
 * useTransactionHistory Hook Tests
 *
 * Verifies the hook fetches the persisted transaction ledger.
 *
 * Network boundary stubbed with MSW per-test `server.use(...)` overrides
 * (Equoria-f12xy) instead of vi.mock'ing the api-client. This exercises the
 * REAL api-client request/unwrap/error path against
 * GET /api/v1/users/transactions. The previous `toHaveBeenCalledWith(page,
 * pageSize)` mock-call assertions are reframed as MSW request-query
 * inspection (the page/pageSize the hook forwards land on the wire as
 * `?page=&pageSize=`), proving the same wiring without faking the boundary.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect } from 'vitest';
import React from 'react';
import { useTransactionHistory } from '../useTransactionHistory';
import { server } from '../../../test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

const sampleResponse = {
  transactions: [
    {
      id: 1,
      type: 'credit',
      amount: 500,
      category: 'weekly_reward',
      description: 'Weekly reward claim',
      balanceAfter: 1500,
      metadata: {},
      timestamp: '2026-04-14T12:00:00.000Z',
    },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
};

describe('useTransactionHistory', () => {
  it('fetches persisted transactions for the authenticated user', async () => {
    let capturedQuery: URLSearchParams | undefined;
    server.use(
      http.get(`${base}/api/v1/users/transactions`, ({ request }) => {
        capturedQuery = new URL(request.url).searchParams;
        return HttpResponse.json({ data: sampleResponse });
      })
    );

    const { result } = renderHook(() => useTransactionHistory(1), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Default pagination forwarded onto the wire (was: toHaveBeenCalledWith(1, 20)).
    expect(capturedQuery?.get('page')).toBe('1');
    expect(capturedQuery?.get('pageSize')).toBe('20');
    expect(result.current.data?.transactions[0]).toMatchObject({
      id: 1,
      type: 'credit',
      amount: 500,
      description: 'Weekly reward claim',
    });
  });

  it('stays idle when disabled by missing user id', async () => {
    let requested = false;
    server.use(
      http.get(`${base}/api/v1/users/transactions`, () => {
        requested = true;
        return HttpResponse.json({ data: sampleResponse });
      })
    );

    const { result } = renderHook(() => useTransactionHistory(undefined), {
      wrapper: createWrapper(),
    });

    // The enabled:false guard means the queryFn never runs and no request is made.
    expect(result.current.isLoading).toBe(false);
    expect(result.current.fetchStatus).toBe('idle');
    await new Promise((r) => setTimeout(r, 50));
    expect(requested).toBe(false);
  });

  it('passes pagination to the API client', async () => {
    let capturedQuery: URLSearchParams | undefined;
    server.use(
      http.get(`${base}/api/v1/users/transactions`, ({ request }) => {
        capturedQuery = new URL(request.url).searchParams;
        return HttpResponse.json({ data: { ...sampleResponse, page: 3, pageSize: 10 } });
      })
    );

    const { result } = renderHook(() => useTransactionHistory(1, 3, 10), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Was: toHaveBeenCalledWith(3, 10) — now proven via the wire query string.
    expect(capturedQuery?.get('page')).toBe('3');
    expect(capturedQuery?.get('pageSize')).toBe('10');
  });
});
