/**
 * featureFlags — honours the shared API base URL (Equoria-bvddn.41)
 *
 * fetchFeatureFlags() used a hardcoded relative URL ('/api/internal/feature-flags'),
 * unlike every other network call in the app, which goes through apiClient.ts's
 * API_BASE_URL (VITE_API_URL, empty on the monolithic Railway deploy, an
 * absolute origin for a split frontend/backend deploy). A relative URL always
 * resolves against the PAGE's own origin, so on a split deploy this request
 * silently hit the wrong origin instead of the configured API.
 *
 * The real API_BASE_URL is '' in this test environment (frontend/.env), which
 * makes a relative-vs-prefixed request byte-identical and unable to prove the
 * fix. So this suite mocks apiClient's API_BASE_URL to a distinctive
 * non-empty origin — the same seam production code reads from — and asserts
 * fetchFeatureFlags's request is actually prefixed with it. Fails pre-fix
 * (the hardcoded literal ignores the mock entirely).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// vi.mock factories are hoisted above the module's own top-level consts, so
// the distinct origin must be declared via vi.hoisted to be visible inside
// the factory (a plain top-level const throws a TDZ ReferenceError here).
const { DISTINCT_ORIGIN } = vi.hoisted(() => ({
  DISTINCT_ORIGIN: 'https://split-deploy-test-origin.example',
}));

vi.mock('@/lib/http/apiClient', () => ({ API_BASE_URL: DISTINCT_ORIGIN }));

import { useFeatureFlags } from '../featureFlags';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('fetchFeatureFlags — uses the shared API_BASE_URL (Equoria-bvddn.41)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requests <API_BASE_URL>/api/internal/feature-flags, not a bare relative path', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ flags: [] }),
    } as Response);

    const { result } = renderHook(() => useFeatureFlags(), { wrapper });

    // `initialData` makes the query look "fresh" on mount (no auto-fetch), so
    // force the real queryFn to run the way a stale-cache refetch would.
    await act(async () => {
      await result.current.refetch();
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      `${DISTINCT_ORIGIN}/api/internal/feature-flags`,
      expect.objectContaining({ credentials: 'include' })
    );
  });
});
