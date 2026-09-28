/**
 * QueryClient retry policy (Equoria-bvddn.37).
 *
 * Before this fix `createAppQueryClient()` used the TanStack Query default
 * retry (3x for EVERY error, including 4xx). A 401 after a failed refresh is
 * the server's final answer, not a transient failure — retrying it fired
 * three more refresh-token POSTs per failed query, which could storm the
 * auth rate limit, and stacked ~7s of exponential-backoff delay onto the
 * /login redirect driven by lib/sessionEnd.ts.
 *
 * These tests drive the REAL app QueryClient (`createAppQueryClient`) with a
 * REAL `useQuery`, MSW answering at the network boundary. Fake timers skip
 * the real exponential-backoff delay between retries without touching the
 * production retryDelay.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider, useQuery, type QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { apiClient } from '@/lib/http/apiClient';
import authSessionState from '@/lib/authSessionState';
import { createAppQueryClient } from '@/lib/queryClient';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const ENDPOINT = '/api/v1/stable-ledger';

function wrapper(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function useLedger() {
  return useQuery({
    queryKey: ['stable-ledger', 'retry-test'],
    queryFn: () => apiClient.get<{ hay: number }>(ENDPOINT),
  });
}

beforeEach(() => {
  authSessionState.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createAppQueryClient retry policy (Equoria-bvddn.37)', () => {
  it.each([
    ['401', 401, { success: false, message: 'Token expired', status: 'error' }],
    ['403', 403, { success: false, message: 'Forbidden', status: 'error' }],
    ['404', 404, { success: false, message: 'Not found', status: 'error' }],
  ])('a %s query is attempted exactly once (no retry storm)', async (_label, status, body) => {
    let calls = 0;
    server.use(
      http.get(`${base}${ENDPOINT}`, () => {
        calls += 1;
        return HttpResponse.json(body, { status });
      }),
      http.post(`${base}/api/v1/auth/refresh-token`, () =>
        HttpResponse.json({ success: false, message: 'Invalid refresh token' }, { status: 401 })
      )
    );

    const client = createAppQueryClient();
    const { result } = renderHook(() => useLedger(), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isError).toBe(true));
    // Give any retry timer a chance to fire before asserting the final count.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(calls).toBe(1);
  });

  it('a 500 query is retried up to 3 times before failing', async () => {
    let calls = 0;
    server.use(
      http.get(`${base}${ENDPOINT}`, () => {
        calls += 1;
        return HttpResponse.json(
          { success: false, message: 'Internal error', status: 'error' },
          { status: 500 }
        );
      })
    );

    const client = createAppQueryClient();
    const { result } = renderHook(() => useLedger(), { wrapper: wrapper(client) });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    // 1 initial attempt + 3 retries.
    expect(calls).toBe(4);
  });
});
