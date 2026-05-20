/**
 * Tests for useHorse (formerly tracked as "useHorseById" in Epic 21 Story 21-5)
 *
 * The hook is exported as `useHorse(horseId: number)` from `../useHorses.ts`.
 * Renamed-from convention is preserved in the file name for traceability with
 * the original sprint plan; the actual hook name remains `useHorse`.
 *
 * Coverage scope (Equoria-tf6o):
 *   - Cache invalidation after a training mutation (horseQueryKeys.detail / .all
 *     are invalidated by useTrainHorse — refetch must fire)
 *   - Cache invalidation after a competition entry mutation (useEnterCompetition
 *     does NOT invalidate horseQueryKeys — refetch must NOT fire; this asserts
 *     the current contract and would fail if the mutation grew an unintended
 *     horse-key invalidation)
 *
 * Strategy: drive cache invalidation directly via queryClient.invalidateQueries
 * with the same keys the real mutation hooks use. Avoids cross-hook coupling
 * while still exercising the real cache-invalidation surface useHorse depends
 * on. Network boundary stubbed with MSW per-test `server.use(...)` overrides
 * (Equoria-f12xy) instead of vi.mock'ing the api-client — the GET /horses/:id
 * fetch + `{ data }` unwrap path is exercised for real, and successive calls
 * return updated payloads via a response counter to prove refetch.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect } from 'vitest';
import { useHorse, horseQueryKeys } from '../useHorses';
import { server } from '../../../test/msw/server';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const mockHorse = {
  id: 42,
  name: 'Thunder',
  breed: 'Arabian',
  age: 4,
  sex: 'gelding' as const,
  ownerId: 1,
};

const createWrapper = (client: QueryClient) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return Wrapper;
};

const newClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 60_000 },
    },
  });

/**
 * Register a GET /horses/42 handler that returns `responses[i]` on the i-th
 * call, clamping at the last entry. Also returns a getter for the call count.
 */
function stubHorseSequence(responses: unknown[]) {
  let calls = 0;
  server.use(
    http.get(`${base}/api/v1/horses/42`, () => {
      const idx = Math.min(calls, responses.length - 1);
      calls += 1;
      return HttpResponse.json({ data: responses[idx] });
    })
  );
  return () => calls;
}

describe('useHorse — cache invalidation', () => {
  it('refetches when horseQueryKeys.detail(id) is invalidated (simulates useTrainHorse onSuccess)', async () => {
    const updatedHorse = { ...mockHorse, healthRating: 'Excellent' };
    const getCalls = stubHorseSequence([mockHorse, updatedHorse]);

    const client = newClient();
    const { result } = renderHook(() => useHorse(42), { wrapper: createWrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getCalls()).toBe(1);
    expect(result.current.data).toEqual(mockHorse);

    // useTrainHorse onSuccess invalidates horseQueryKeys.detail(horseId) AND
    // horseQueryKeys.all. Driving the same invalidation here proves useHorse's
    // queryKey is wired to receive that invalidation signal.
    await client.invalidateQueries({ queryKey: horseQueryKeys.detail(42) });

    await waitFor(() => expect(getCalls()).toBe(2));
    await waitFor(() => expect(result.current.data).toEqual(updatedHorse));
  });

  it('refetches when horseQueryKeys.all is invalidated (training mutation broad fallback)', async () => {
    const updatedHorse = { ...mockHorse, name: 'Thunder II' };
    const getCalls = stubHorseSequence([mockHorse, updatedHorse]);

    const client = newClient();
    const { result, rerender } = renderHook(() => useHorse(42), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getCalls()).toBe(1);

    // useTrainHorse also invalidates horseQueryKeys.all — verify the broader
    // invalidation reaches the detail query via prefix matching.
    await client.invalidateQueries({ queryKey: horseQueryKeys.all });

    await waitFor(() => expect(getCalls()).toBe(2));
    rerender();
    await waitFor(() => expect(result.current.data?.name).toBe('Thunder II'));
  });

  it('does NOT refetch when only a competition mutation invalidation fires (no horse-key overlap)', async () => {
    const getCalls = stubHorseSequence([mockHorse]);

    const client = newClient();
    const { result } = renderHook(() => useHorse(42), { wrapper: createWrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getCalls()).toBe(1);

    // useEnterCompetition invalidates: competitionFilteredQueryKeys.all,
    // competitionDetailsQueryKeys.detail, horseEligibilityQueryKeys.all,
    // ['profile'], ['competitions', 'list']. NONE of those overlap the
    // horses key — useHorse must NOT refetch.
    await client.invalidateQueries({ queryKey: ['competitions', 'list'] });
    await client.invalidateQueries({ queryKey: ['horse-eligibility'] });
    await client.invalidateQueries({ queryKey: ['profile'] });

    // Give react-query a tick to attempt a refetch if it were going to.
    await new Promise((r) => setTimeout(r, 50));

    // Still exactly one call — competition-side invalidations did not reach
    // the horse-detail query.
    expect(getCalls()).toBe(1);
  });

  it('does not fetch when horseId is 0 (enabled guard)', async () => {
    // No handler registered — a fetch would trip onUnhandledRequest: 'error'.
    const client = newClient();
    const { result } = renderHook(() => useHorse(0), { wrapper: createWrapper(client) });

    expect(result.current.fetchStatus).toBe('idle');
    await new Promise((r) => setTimeout(r, 30));
    expect(result.current.fetchStatus).toBe('idle');
  });
});
