/**
 * FoalDetailPage — a failed development answer must settle (Equoria-v61q2)
 *
 * Regression for the request storm on /foals/:id for a horse aged 14-20
 * days: GET /:foalId succeeds (the horse still exists as a foal record) but
 * GET /:foalId/development answers 404 "Horse is not a foal". The page used to
 * loop ~95 requests a second and never leave "Loading foal".
 *
 * Mechanism: the page shows its loading gate while the development query is
 * pending, then mounts FoalDevelopmentTracker, which subscribes to the same
 * query. The new observer re-fetched the errored query on mount, the query went
 * back to `pending`, the gate unmounted the tracker, the error came back, and
 * the tracker mounted again.
 *
 * Boundary-level: real FoalDetailPage, real useBreeding hooks, real breedingApi
 * over apiClient. Only the HTTP boundary is stubbed, via MSW.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { server } from '@/test/msw/server';
import { RewardToastProvider } from '@/components/feedback';
import { createAppQueryClient } from '@/lib/queryClient';
import FoalDetailPage from '../FoalDetailPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const FOAL_ID = 4242;
const foalPath = (suffix = '') => `${base}/api/v1/foals/${FOAL_ID}${suffix}`;

// A 19-day-old horse: the age band the storm was observed in.
const dob = new Date(Date.now() - 19 * 24 * 60 * 60 * 1000).toISOString();

// Exact backend message (backend/modules/horses/models/foalModel.mjs:56),
// mapped to 404 by foalController.mjs getFoalDevelopmentHandler.
const NOT_A_FOAL = 'Horse is not a foal (must be 1 year old or younger)';

/** Real time passes so a re-fetch loop, if present, has room to spin. */
const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('FoalDetailPage — failed development answer (Equoria-v61q2)', () => {
  let queryClient: QueryClient;
  let developmentRequests: number;

  /** Stub the foal routes; the development route answers `status` + `message`. */
  function stubFoalRoutes(status: number, message: string) {
    server.use(
      http.get(foalPath(), () =>
        HttpResponse.json({
          success: true,
          data: {
            id: FOAL_ID,
            name: 'TestFixture-Duskwind',
            sex: 'Colt',
            dateOfBirth: dob,
            ageInDays: 19,
            sireId: 100,
            damId: 101,
            userId: 'test-user-123',
            traits: [],
          },
        })
      ),
      http.get(foalPath('/development'), () => {
        developmentRequests += 1;
        return HttpResponse.json({ success: false, message }, { status });
      }),
      http.get(foalPath('/activities'), () => HttpResponse.json({ success: true, data: [] }))
    );
  }

  const renderPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <RewardToastProvider>
          <MemoryRouter initialEntries={[`/foals/${FOAL_ID}`]}>
            <Routes>
              <Route path="/foals/:id" element={<FoalDetailPage />} />
            </Routes>
          </MemoryRouter>
        </RewardToastProvider>
      </QueryClientProvider>
    );

  beforeEach(() => {
    developmentRequests = 0;
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('asks for development data once, never retries the 404, and leaves Loading', async () => {
    // The REAL app QueryClient, with its production retry policy.
    queryClient = createAppQueryClient();
    stubFoalRoutes(404, NOT_A_FOAL);

    renderPage();

    await waitFor(() => expect(developmentRequests).toBeGreaterThan(0));

    // Give a re-fetch loop time to show itself; the old page sent ~95/s.
    await settle(750);

    expect(developmentRequests).toBe(1);
    // The page reaches its existing error presentation for the development
    // panel: the backend's own message, shown by FoalDevelopmentTracker.
    expect(screen.queryByText(/loading foal/i)).not.toBeInTheDocument();
    expect(screen.getByText(NOT_A_FOAL)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /development/i })).toBeInTheDocument();
  });

  it('settles after a server error instead of re-mounting the tracker in a loop', async () => {
    // retry: false keeps the test fast (the app policy waits 1s/2s/4s between
    // 5xx retries); the loop under test is the mount re-fetch, not the retry.
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    stubFoalRoutes(500, 'Internal server error');

    renderPage();

    await waitFor(() => expect(developmentRequests).toBeGreaterThan(0));
    await settle(750);

    // A network error or 5xx may be re-fetched once when the tracker mounts
    // (it can be transient), but the page must not unmount the tracker for
    // that re-fetch and so must not loop.
    expect(developmentRequests).toBeLessThanOrEqual(2);
    expect(screen.queryByText(/loading foal/i)).not.toBeInTheDocument();
    expect(screen.getByText('Internal server error')).toBeInTheDocument();
  });
});
