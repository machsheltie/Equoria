/**
 * Regression test for Equoria-bvddn.27 (useHireRider slice).
 *
 * apiClient.ts unwraps the backend `{ success, data }` envelope and returns
 * `data.data` directly (frontend/src/lib/http/apiClient.ts:249). The backend
 * hire endpoint (backend/modules/riders/controllers/riderMarketplaceController.mjs)
 * answers:
 *   { success: true, message: '...', data: { rider, cost, remainingMoney } }
 * so the value useHireRider's onSuccess actually receives is the UNWRAPPED
 * `{ rider, cost, remainingMoney }` object — not the `{ success, data }`
 * envelope the old generic type and `result.data.remainingMoney` read assumed.
 * That mismatch threw inside onSuccess (TypeError: Cannot read properties of
 * undefined), which put the mutation into TanStack's error path and skipped
 * the profile-cache money update — the player was charged but the nav balance
 * never moved.
 *
 * This test seeds the exact backend response shape via MSW (the network
 * boundary) and asserts the mutation resolves successfully and the ['profile']
 * cache money field is updated from the unwrapped result.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useHireRider } from '../useRiders';
import { server } from '../../../test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useHireRider (Equoria-bvddn.27)', () => {
  it('resolves successfully and updates the profile cache balance from the unwrapped backend response', async () => {
    // Exact shape returned by riderMarketplaceController.mjs on a successful hire.
    server.use(
      http.post(`${base}/api/v1/riders/marketplace/hire`, () =>
        HttpResponse.json({
          success: true,
          message: 'Rider hired successfully',
          data: {
            rider: { id: 501, name: 'Jordan Ashcroft', firstName: 'Jordan', lastName: 'Ashcroft' },
            cost: 750,
            remainingMoney: 4250,
          },
        })
      )
    );

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(['profile'], {
      user: { id: 'u1', username: 'rider-owner', money: 5000 },
    });

    const { result } = renderHook(() => useHireRider(), { wrapper: createWrapper(queryClient) });

    await act(async () => {
      result.current.mutate('mp-501');
    });

    // Before the fix this failed: the mutation landed in isError with a
    // TypeError from `result.data.remainingMoney` on an object with no `data`.
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.isError).toBe(false);

    // onSuccess must read the unwrapped shape directly.
    expect(result.current.data).toEqual({
      rider: { id: 501, name: 'Jordan Ashcroft', firstName: 'Jordan', lastName: 'Ashcroft' },
      cost: 750,
      remainingMoney: 4250,
    });

    // The profile cache's money must reflect the hire cost deduction.
    const cached = queryClient.getQueryData<{ user: { money: number } }>(['profile']);
    expect(cached?.user.money).toBe(4250);
  });
});
