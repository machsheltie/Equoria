/**
 * FoalDetailPage Lifecycle UI Tests (Equoria-bi6i; converted under Equoria-fefh2.12)
 *
 * Boundary-level: the page renders against the REAL useBreeding hooks
 * (real React Query + real breedingApi over apiClient) with the network
 * boundary stubbed by MSW (`server.use(http...)`) — NOT a
 * `vi.mock('@/hooks/api/useBreeding')`. This exercises the real
 * query-key construction, the `enabled` gating, the `{ success, data }`
 * envelope unwrap, the GET /development → flat-normalizer path, and the
 * mutation → CSRF round trip → wire-payload contract end-to-end.
 *
 * Verifies that FoalDetailPage offers NO "Reveal Traits" (the retired
 * POST /reveal-traits, Equoria-gu8jk), NO "Advance Day" (the retired
 * PUT /develop, Equoria-mwjst) and NO player-run enrichment, stage activity or
 * graduation (Equoria-fr2kg).
 *
 * Per 21R doctrine: no graceful skips, no fake values.
 *
 * The REAL wire shapes mirrored below are taken verbatim from the backend
 * controllers (backend/modules/breeding/controllers/foalController.mjs):
 *   - GET  /:foalId             → { success, data: { id, name, sex, dateOfBirth, ageInDays, sireId, damId, ... } }
 *   - GET  /:foalId/development  → { success, data: { foal, development: { currentDay, bondingLevel, stressLevel } } }
 *   - GET  /:foalId/activities   → { success, data: [ { id, activity, ... } ] }
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router';
import { describe, it, expect, beforeEach } from 'vitest';
import { server } from '@/test/msw/server';
import { RewardToastProvider } from '@/components/feedback';
import FoalDetailPage from '../FoalDetailPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const FOAL_ID = 42;
const foalPath = (suffix = '') => `${base}/api/v1/foals/${FOAL_ID}${suffix}`;

// A foal older than the old client's 104-real-week graduation gate. The
// retired "Graduate to Adult" button rendered for exactly this age, so the
// no-graduation assertion below runs where it used to appear.
const adultDob = new Date(Date.now() - 1100 * 24 * 60 * 60 * 1000).toISOString();
// A two-day-old foal: the retired stage-activity cards rendered for this age.
const newbornDob = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

/**
 * Register the happy-path MSW handlers shared by every test. The CSRF-token
 * GET is required because the api-client fetches a real token for every
 * mutation (no test bypass in production code). Individual tests override the
 * mutation endpoints with a later server.use(...) to capture the wire payload.
 */
function useDefaultHandlers(dateOfBirth: string = adultDob) {
  server.use(
    // api-client mutation CSRF round trip — real production path.
    http.get(`${base}/api/v1/auth/csrf-token`, () =>
      HttpResponse.json({ csrfToken: 'test-csrf-token' })
    ),

    // GET /:foalId — foal basic record (Foal shape).
    http.get(foalPath(), () =>
      HttpResponse.json({
        success: true,
        data: {
          id: FOAL_ID,
          name: 'TestFixture-Starlight',
          sex: 'Filly',
          dateOfBirth,
          ageInDays: 1100,
          sireId: 100,
          damId: 101,
          userId: 'test-user-123',
          traits: [],
        },
      })
    ),

    // GET /:foalId/development — REAL nested envelope: data.development.*.
    // normalizeFoalDevelopment flattens it.
    http.get(foalPath('/development'), () =>
      HttpResponse.json({
        success: true,
        data: {
          foal: { id: FOAL_ID, name: 'TestFixture-Starlight' },
          development: {
            currentDay: 3,
            bondingLevel: 50,
            stressLevel: 10,
          },
        },
      })
    ),

    // GET /:foalId/activities — empty activity log (data: []).
    http.get(foalPath('/activities'), () => HttpResponse.json({ success: true, data: [] }))
  );
}

describe('FoalDetailPage — lifecycle UI (Equoria-bi6i)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    useDefaultHandlers();
  });

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

  // Equoria-gu8jk. OLD CONTRACT: a "Reveal Traits" button POSTed
  // /reveal-traits, so the PLAYER moved the foal's hidden traits into view on
  // demand. NEW RULING (owner, 2026-10-20): players must never write traits for
  // themselves — grooms will activate them — so the page offers no reveal
  // control and never calls /reveal-traits.
  it('offers no Reveal Traits control and never calls the reveal-traits boundary', async () => {
    let revealHit = false;
    server.use(
      http.post(foalPath('/reveal-traits'), () => {
        revealHit = true;
        return HttpResponse.json({ success: false }, { status: 404 });
      })
    );

    renderPage();

    expect(await screen.findByTestId('development-tracker')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reveal/i })).not.toBeInTheDocument();
    expect(revealHit).toBe(false);
  });

  // Equoria-fr2kg. OLD CONTRACT: an "Enrich" button opened a picker of the
  // day 0-6 activities and POSTed the choice to /enrich, so the PLAYER
  // performed foal enrichment. NEW RULING (owner, 2026-10-14/15): foal
  // enrichment is the groom's job and the player-run enrichment was an AI
  // invention, so the page offers no Enrich control and never calls /enrich.
  it('offers no Enrich control and never calls the enrich boundary', async () => {
    let enrichHit = false;
    server.use(
      http.post(foalPath('/enrich'), () => {
        enrichHit = true;
        return HttpResponse.json({ success: false }, { status: 404 });
      })
    );

    renderPage();

    expect(await screen.findByTestId('development-tracker')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^enrich/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/choose an enrichment activity/i)).not.toBeInTheDocument();
    expect(enrichHit).toBe(false);
  });

  // Equoria-mwjst. OLD CONTRACT (vulnerable): an "Advance Day" button sent
  // PUT /develop { currentDay: day + 1 }, and the server stored whatever day,
  // bond and stress the client chose. CORRECTED CONTRACT (owner ruling
  // 2026-10-05: no advance day, foals wait out the full week): the page offers
  // no way to set or advance the development day, and never calls /develop.
  it('offers no Advance Day control and never calls the develop boundary', async () => {
    let developHit = false;
    server.use(
      http.put(foalPath('/develop'), () => {
        developHit = true;
        return HttpResponse.json({ success: false }, { status: 404 });
      })
    );

    renderPage();

    // The foal development UI has rendered (the page is loaded) ...
    expect(await screen.findByTestId('development-tracker')).toBeInTheDocument();
    // ... and none of them advances the day.
    expect(screen.queryByRole('button', { name: /advance day/i })).not.toBeInTheDocument();
    expect(developHit).toBe(false);
  });

  // Equoria-fr2kg. OLD CONTRACT: a foal past 104 real weeks showed "Graduate
  // to Adult", which POSTed /graduate and played a "Graduation Day!"
  // cinematic. NEW RULING (owner, 2026-10-14/15): there is no graduation; it
  // was an AI invention. The page offers no Graduate control at any age and
  // never calls /graduate.
  it('offers no Graduate control, even past the old 104-week gate, and never calls the graduate boundary', async () => {
    let graduateHit = false;
    server.use(
      http.post(foalPath('/graduate'), () => {
        graduateHit = true;
        return HttpResponse.json({ success: false }, { status: 404 });
      })
    );

    renderPage();

    expect(await screen.findByTestId('development-tracker')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /graduat/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/graduated/i)).not.toBeInTheDocument();
    expect(graduateHit).toBe(false);
  });

  // Equoria-fr2kg. OLD CONTRACT: the DevelopmentTracker listed per-stage
  // activities ("Available activities") that the player selected and
  // confirmed, POSTing /activity. NEW RULING (owner, 2026-10-14/15): grooms,
  // not players, do the foal's activities. The page lists no player
  // activities and never calls /activity.
  it('lists no player-selectable foal activities and never calls the activity boundary', async () => {
    useDefaultHandlers(newbornDob);
    let activityHit = false;
    server.use(
      http.post(foalPath('/activity'), () => {
        activityHit = true;
        return HttpResponse.json({ success: false }, { status: 404 });
      })
    );

    renderPage();

    expect(await screen.findByTestId('development-tracker')).toBeInTheDocument();
    expect(screen.queryByText(/available activities/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/confirm activity/i)).not.toBeInTheDocument();
    expect(activityHit).toBe(false);
  });
});
