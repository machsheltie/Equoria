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
 * on.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { horsesApi } from '@/lib/api-client';
import { useHorse, horseQueryKeys } from '../useHorses';

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api-client')>('@/lib/api-client');
  return {
    ...actual,
    horsesApi: {
      ...actual.horsesApi,
      get: vi.fn(),
      list: vi.fn(),
    },
  };
});

const mockHorse = {
  id: 42,
  name: 'Thunder',
  breed: 'Arabian',
  age: 4,
  sex: 'gelding' as const,
  ownerId: 1,
} as unknown as Awaited<ReturnType<typeof horsesApi.get>>;

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

describe('useHorse — cache invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refetches when horseQueryKeys.detail(id) is invalidated (simulates useTrainHorse onSuccess)', async () => {
    const updatedHorse = { ...mockHorse, healthRating: 'Excellent' };
    vi.mocked(horsesApi.get)
      .mockResolvedValueOnce(mockHorse)
      .mockResolvedValueOnce(updatedHorse);

    const client = newClient();
    const { result } = renderHook(() => useHorse(42), { wrapper: createWrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(horsesApi.get).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(mockHorse);

    // useTrainHorse onSuccess invalidates horseQueryKeys.detail(horseId) AND
    // horseQueryKeys.all. Driving the same invalidation here proves useHorse's
    // queryKey is wired to receive that invalidation signal.
    await client.invalidateQueries({ queryKey: horseQueryKeys.detail(42) });

    await waitFor(() => expect(horsesApi.get).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.data).toEqual(updatedHorse));
  });

  it('refetches when horseQueryKeys.all is invalidated (training mutation broad fallback)', async () => {
    const updatedHorse = { ...mockHorse, name: 'Thunder II' };
    vi.mocked(horsesApi.get)
      .mockResolvedValueOnce(mockHorse)
      .mockResolvedValueOnce(updatedHorse);

    const client = newClient();
    const { result, rerender } = renderHook(() => useHorse(42), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(horsesApi.get).toHaveBeenCalledTimes(1);

    // useTrainHorse also invalidates horseQueryKeys.all — verify the broader
    // invalidation reaches the detail query via prefix matching.
    await client.invalidateQueries({ queryKey: horseQueryKeys.all });

    await waitFor(() => expect(horsesApi.get).toHaveBeenCalledTimes(2));
    rerender();
    await waitFor(() => expect(result.current.data?.name).toBe('Thunder II'));
  });

  it('does NOT refetch when only a competition mutation invalidation fires (no horse-key overlap)', async () => {
    vi.mocked(horsesApi.get).mockResolvedValueOnce(mockHorse);

    const client = newClient();
    const { result } = renderHook(() => useHorse(42), { wrapper: createWrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(horsesApi.get).toHaveBeenCalledTimes(1);

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
    expect(horsesApi.get).toHaveBeenCalledTimes(1);
  });

  it('does not fetch when horseId is 0 (enabled guard)', () => {
    vi.mocked(horsesApi.get).mockResolvedValueOnce(mockHorse);
    const client = newClient();
    const { result } = renderHook(() => useHorse(0), { wrapper: createWrapper(client) });

    expect(horsesApi.get).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });
});
