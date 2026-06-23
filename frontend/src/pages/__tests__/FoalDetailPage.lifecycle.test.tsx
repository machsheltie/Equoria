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
 * Verifies that FoalDetailPage exposes the 5 foal lifecycle primary
 * actions called out in docs/beta-route-truth-table.md for the
 * /breeding row:
 *
 *   - POST /api/v1/foals/:foalId/enrich          → "Enrich" button
 *   - POST /api/v1/foals/:foalId/reveal-traits   → "Reveal Traits" button
 *   - PUT  /api/v1/foals/:foalId/develop         → "Advance Day" button
 *   - POST /api/v1/foals/:foalId/graduate        → "Graduate to Adult" (age-gated)
 *   - POST /api/v1/foals/:foalId/activity        → activity-select → Confirm
 *
 * Per 21R doctrine: no graceful skips, no fake values. These mutations
 * MUST be reachable through the production UI from the /foals/:id route.
 *
 * The REAL wire shapes mirrored below are taken verbatim from the backend
 * controllers (backend/modules/breeding/controllers/foalController.mjs):
 *   - GET  /:foalId             → { success, data: { id, name, sex, dateOfBirth, ageInDays, sireId, damId, ... } }
 *   - GET  /:foalId/development  → { success, data: { foal, development: { currentDay, bondingLevel, stressLevel, completedActivities, maxDay, enrichmentDay, enrichmentWindowOpen }, availableEnrichmentActivities } }
 *   - GET  /:foalId/activities   → { success, data: [ { id, activity, ... } ] }
 *   - POST /:foalId/reveal-traits → { success, data: { traits, revealed, hidden } }
 *   - POST /:foalId/enrich       → { success, data: { foal, activity, updatedLevels, changes } }
 *   - PUT  /:foalId/develop      → { success, data: { currentDay, bondingLevel, stressLevel, completedActivities, maxDay } }
 *   - POST /:foalId/graduate     → { success, data: { horse, graduation } }
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeEach } from 'vitest';
import { server } from '@/test/msw/server';
import { RewardToastProvider } from '@/components/feedback';
import FoalDetailPage from '../FoalDetailPage';

const base = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const FOAL_ID = 42;
const foalPath = (suffix = '') => `${base}/api/v1/foals/${FOAL_ID}${suffix}`;

// Pick a dateOfBirth that makes the foal 3+ years old so the Graduate
// button (age-gated at 104 weeks) is visible in the test.
const adultDob = new Date(Date.now() - 1100 * 24 * 60 * 60 * 1000).toISOString();

/**
 * Register the happy-path MSW handlers shared by every test. The CSRF-token
 * GET is required because the api-client fetches a real token for every
 * mutation (no test bypass in production code). Individual tests override the
 * mutation endpoints with a later server.use(...) to capture the wire payload.
 */
function useDefaultHandlers() {
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
          dateOfBirth: adultDob,
          ageInDays: 1100,
          sireId: 100,
          damId: 101,
          userId: 'test-user-123',
          traits: [],
        },
      })
    ),

    // GET /:foalId/development — REAL nested envelope: data.development.* with
    // sibling availableEnrichmentActivities. normalizeFoalDevelopment flattens it.
    http.get(foalPath('/development'), () =>
      HttpResponse.json({
        success: true,
        data: {
          foal: { id: FOAL_ID, name: 'TestFixture-Starlight' },
          development: {
            currentDay: 3,
            bondingLevel: 50,
            stressLevel: 10,
            completedActivities: {},
            maxDay: 6,
            enrichmentDay: 3,
            enrichmentWindowOpen: true,
          },
          availableEnrichmentActivities: [
            { type: 'gentle_touch', name: 'Gentle Touch' },
            { type: 'soft_voice', name: 'Soft Voice' },
          ],
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

  it('renders the Reveal Traits button and wires it to the reveal-traits boundary', async () => {
    const user = userEvent.setup();
    let revealHit = false;
    server.use(
      http.post(foalPath('/reveal-traits'), () => {
        revealHit = true;
        return HttpResponse.json({
          success: true,
          data: { traits: [], revealed: [], hidden: [] },
        });
      })
    );

    renderPage();

    const btn = await screen.findByRole('button', { name: /reveal traits/i });
    expect(btn).toBeInTheDocument();

    await user.click(btn);
    await waitFor(() => expect(revealHit).toBe(true));
  });

  it('renders the Enrich button and sends only the activity type via the enrich boundary', async () => {
    const user = userEvent.setup();
    let enrichBody: unknown = null;
    server.use(
      http.post(foalPath('/enrich'), async ({ request }) => {
        enrichBody = await request.json();
        return HttpResponse.json({
          success: true,
          message: 'Enrichment activity "Gentle Touch" completed successfully',
          data: {
            foal: { id: FOAL_ID, name: 'TestFixture-Starlight' },
            activity: { name: 'Gentle Touch' },
            updatedLevels: { bondScore: 55, stressLevel: 8 },
            changes: { bondChange: 5, stressChange: -2 },
          },
        });
      })
    );

    renderPage();

    const btn = await screen.findByRole('button', { name: /^enrich$/i });
    expect(btn).toBeInTheDocument();

    // Enrich opens a picker of the day's real activities; choosing one sends
    // only the activity type (the backend derives the day, Equoria-g89vy).
    await user.click(btn);
    const choice = await screen.findByRole('button', { name: /gentle touch/i });
    await user.click(choice);

    await waitFor(() => expect(enrichBody).toEqual({ activity: 'gentle_touch' }));
  });

  it('renders the Advance Day button and sends the real currentDay field via the develop boundary', async () => {
    const user = userEvent.setup();
    let developBody: unknown = null;
    server.use(
      http.put(foalPath('/develop'), async ({ request }) => {
        developBody = await request.json();
        return HttpResponse.json({
          success: true,
          data: {
            currentDay: 4,
            bondingLevel: 50,
            stressLevel: 10,
            completedActivities: {},
            maxDay: 6,
          },
        });
      })
    );

    renderPage();

    const btn = await screen.findByRole('button', { name: /advance day/i });
    expect(btn).toBeInTheDocument();

    await user.click(btn);
    // Equoria-n3yw6: must send the whitelisted backend field `currentDay`
    // (incremented from 3 → 4), NOT a fabricated `progress`.
    await waitFor(() => expect(developBody).toEqual({ currentDay: 4 }));
  });

  it('renders the Graduate to Adult button (age-gated) and wires it to the graduate boundary', async () => {
    const user = userEvent.setup();
    let graduateHit = false;
    server.use(
      http.post(foalPath('/graduate'), () => {
        graduateHit = true;
        return HttpResponse.json({
          success: true,
          message: 'TestFixture-Starlight has graduated!',
          data: {
            horse: { id: FOAL_ID, name: 'TestFixture-Starlight', breed: 'Thoroughbred' },
            graduation: { clearedAssignments: 0, bondScore: 50, isFirstGraduation: false },
          },
        });
      })
    );

    renderPage();

    const btn = await screen.findByRole('button', { name: /graduate to adult/i });
    expect(btn).toBeInTheDocument();

    await user.click(btn);
    await waitFor(() => expect(graduateHit).toBe(true));
  });

  it('exposes an activity selection flow (logFoalActivity) via DevelopmentTracker', async () => {
    renderPage();

    // The activity-selection UI is provided by the nested DevelopmentTracker
    // child — assert it renders so the activity → confirm → mutate flow
    // is reachable for the user.
    expect(await screen.findByTestId('development-tracker')).toBeInTheDocument();
  });
});
